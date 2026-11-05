// app.js
// Wires the engine, the audio sources, storage and the charts to the page.

import { makeContext, analyzeFrame, BaselineBuilder, Accumulator, assess } from './model.js';
import { bearingFrequencies } from './dsp.js';
import { MicSource, SimSource, FileSource } from './sources.js';
import { FAULTS, BEARINGS, MachineSim } from './synth.js';
import * as store from './store.js';
import { drawSpectrum, drawEnvelope, drawBands, drawTrend } from './charts.js';

const FRAMES_PER_SECOND = 10;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = store.load();
const run = {
  mode: 'idle', // idle | learning | monitoring
  source: null,
  ctx: null,
  builder: null,
  target: 0,
  acc: null,
  frames: 0,
  last: null, // last analysed frame
  result: null, // last assessment
  file: null,
  demo: false,
  drawQueued: false,
};

// ---------- helpers ----------

const current = () => state.machines.find((m) => m.id === state.currentId) || null;

function persist() {
  const r = store.save(state);
  if (!r.ok) notify(r.error, true);
}

function machineParams(m) {
  let bearing = null;
  if (m.bearingPreset && m.bearingPreset !== 'custom') bearing = BEARINGS[m.bearingPreset] || null;
  else if (m.bearingPreset === 'custom' && m.bearing) bearing = m.bearing;
  return { rpm: m.rpm, lineHz: m.lineHz, bearing };
}

const zoneOf = (h) => (h >= 85 ? 'A' : h >= 70 ? 'B' : h >= 40 ? 'C' : 'D');
const fmtDate = (iso) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

let noticeTimer;
function notify(text, isError = false, sticky = false) {
  const el = $('notice');
  el.textContent = text;
  el.classList.toggle('error', isError);
  el.hidden = !text;
  clearTimeout(noticeTimer);
  if (text && !sticky) noticeTimer = setTimeout(() => { el.hidden = true; }, isError ? 12000 : 8000);
}

function confirmDialog(text, okLabel = 'Confirm') {
  const d = $('confirmDialog');
  $('confirmText').textContent = text;
  $('confirmOk').textContent = okLabel;
  return new Promise((resolve) => {
    d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true });
    d.showModal();
  });
}

// ---------- rendering ----------

function render() {
  const m = current();
  $('welcome').hidden = !!m;
  $('workspace').hidden = !m;
  renderMachineSelect();
  if (!m) { drawWelcome(); return; }
  renderNameplate(m);
  renderHistory(m);
  renderReadout();
  renderFindings();
  queueDraw();
}

function renderMachineSelect() {
  const sel = $('machineSelect');
  sel.innerHTML = state.machines.length
    ? state.machines.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}${m.tag ? ` (${esc(m.tag)})` : ''}</option>`).join('')
    : '<option value="">No machines yet</option>';
  sel.value = state.currentId || '';
  sel.disabled = !state.machines.length || run.mode !== 'idle';
}

function renderNameplate(m) {
  const p = machineParams(m);
  const bf = p.bearing && p.rpm ? bearingFrequencies({ rpm: p.rpm, ...p.bearing }) : null;
  const rows = [
    ['Tag', m.tag], ['Location', m.location],
    ['Speed', m.rpm ? `${m.rpm} rpm (${(m.rpm / 60).toFixed(1)} Hz)` : 'Not set'],
    ['Mains', `${m.lineHz} Hz`],
    ['Bearing', m.bearingPreset === 'custom' ? 'Custom geometry' : m.bearingPreset || 'Unknown'],
    ['Defect freqs', bf ? `BPFO ${bf.BPFO.toFixed(1)}, BPFI ${bf.BPFI.toFixed(1)}, BSF ${bf.BSF.toFixed(1)}, FTF ${bf.FTF.toFixed(1)} Hz` : ''],
    ['Point', m.point],
    ['Baseline', m.baseline ? `${fmtDate(m.baseline.createdAt)}, ${Math.round(m.baseline.frames / FRAMES_PER_SECOND)} s` : 'Not learned yet'],
  ].filter(([, v]) => v);
  $('nameplate').innerHTML = `<dd class="np-name">${esc(m.name)}</dd>` + rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
}

function renderHistory(m) {
  const items = [...m.history].reverse().slice(0, 50);
  $('historyLog').innerHTML = items.length
    ? items.map((h) => `<li><span class="lh" data-zone="${esc(h.zone)}">${esc(h.health)}</span><span><span class="lt">${esc(fmtDate(h.t))} · ${esc(h.source)}</span><br><span class="lf">${esc((h.findings || [])[0] || 'No fault pattern')}</span></span></li>`).join('')
    : '';
  $('btnCsv').disabled = !m.history.length;
  drawTrend($('trendCanvas'), m.history);
}

function renderReadout() {
  const m = current();
  const r = run.result;
  const readout = document.querySelector('.readout');
  const needle = $('needle');
  let title, text, status = 'none', health = null;

  if (run.mode === 'learning') {
    const secs = Math.floor((run.builder?.count || 0) / FRAMES_PER_SECOND);
    title = 'Learning the healthy sound';
    text = `Hold the phone still at the measuring point. ${secs} of ${Math.round(run.target / FRAMES_PER_SECOND)} s.`;
  } else if (!m?.baseline) {
    title = 'No baseline yet';
    text = 'Run the machine at its normal speed and load, then learn its healthy sound.';
  } else if (run.mode === 'monitoring' && (!r || run.acc.count < 10)) {
    title = 'Listening';
    text = 'Collecting a few seconds of sound before judging.';
  } else if (r) {
    status = r.status;
    health = r.health;
    const top = r.findings[0];
    if (r.status === 'healthy') {
      title = 'Healthy';
      text = top && top.severity === 1 ? `${top.title}. ${top.action}` : `Sounds like it did when the baseline was learned on ${fmtDate(m.baseline.createdAt)}.`;
    } else if (r.status === 'watch') {
      title = 'Watch this machine';
      text = top ? `${top.title}. Plan an inspection and re-measure soon.` : 'The sound has drifted from its healthy baseline. Plan an inspection.';
    } else {
      title = 'Act now';
      text = top ? `${top.title}. Inspect before the next shift.` : 'The sound is far from its healthy baseline.';
    }
  } else {
    title = 'Ready';
    text = 'Start monitoring to compare the sound with the healthy baseline.';
  }

  readout.dataset.status = status;
  $('healthNum').textContent = health ?? '--';
  $('verdictTitle').textContent = title;
  $('verdictText').textContent = text;
  $('zones').classList.toggle('dim', health == null);
  needle.hidden = health == null;
  if (health != null) {
    needle.style.left = `${Math.max(0.5, Math.min(99.5, health))}%`;
    $('zones').setAttribute('aria-label', `Zone ${zoneOf(health)}, health ${health} of 100`);
  }

  const busy = run.mode !== 'idle';
  $('btnLearn').hidden = busy;
  $('btnMonitor').hidden = busy;
  $('btnStop').hidden = !busy;
  $('btnMonitor').disabled = !m?.baseline;
  $('btnSave').disabled = busy || !r;
  $('btnReport').disabled = !r;
  $('learnSeconds').disabled = busy;
  $('progress').hidden = run.mode !== 'learning';
  if (run.mode === 'learning') $('progressBar').style.width = `${(100 * (run.builder?.count || 0)) / run.target}%`;
  for (const id of ['btnNewMachine', 'btnEditMachine', 'fileRestore']) $(id).disabled = busy;
  document.querySelectorAll('input[name="source"]').forEach((el) => { el.disabled = busy; });
  $('fileAudio').disabled = busy;
  renderMachineSelect();
}

function renderFindings() {
  const r = run.result;
  const ul = $('findings');
  const m = current();
  if (!r) {
    ul.innerHTML = `<li class="empty">${m?.baseline ? 'Findings appear while monitoring.' : 'Findings need a healthy baseline to compare against.'}</li>`;
    return;
  }
  if (!r.findings.length) {
    ul.innerHTML = '<li class="empty">No fault pattern found. Every band, harmonic and impact frequency is inside its healthy range.</li>';
    return;
  }
  ul.innerHTML = r.findings.map((f) => `
    <li class="finding" data-sev="${f.severity}">
      <h3>${esc(f.title)}</h3>
      <p class="evidence">${esc(f.evidence)}</p>
      <p class="action"><strong>Next:</strong> ${esc(f.action)}</p>
    </li>`).join('');
}

function queueDraw() {
  if (run.drawQueued) return;
  run.drawQueued = true;
  requestAnimationFrame(() => { run.drawQueued = false; drawCharts(); });
}

function markerSet(m, sr) {
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const p = machineParams(m);
  const out = [];
  if (p.rpm) {
    const fr = p.rpm / 60;
    out.push({ hz: fr, label: '1x', color: css('--ink-faint') }, { hz: 2 * fr, label: '2x', color: css('--ink-faint') });
  }
  const bf = p.bearing && p.rpm ? bearingFrequencies({ rpm: p.rpm, ...p.bearing }) : null;
  if (bf) {
    out.push(
      { hz: bf.BPFO, label: 'BPFO', color: css('--zone-d') },
      { hz: bf.BPFI, label: 'BPFI', color: css('--zone-c') },
      { hz: bf.BSF, label: 'BSF', color: css('--steel') },
      { hz: bf.FTF, label: 'FTF', color: css('--zone-b') },
    );
  }
  return out;
}

function drawCharts() {
  const m = current();
  if (!m) return;
  const view = run.acc?.count ? run.acc.average() : run.last;
  const sr = run.ctx?.sr || m.baseline?.sr || 48000;
  const n = run.ctx?.n || m.baseline?.n || 8192;
  drawSpectrum($('specCanvas'), { spectrum: view?.spectrum, sr, n, baseline: m.baseline });
  drawEnvelope($('envCanvas'), { envelope: view?.envelope, sr, n, baseline: m.baseline, markers: markerSet(m, sr) });
  drawBands($('bandCanvas'), { zBands: run.result?.zBands, bandFc: m.baseline?.bandFc || [] });
}

function drawLevel(frame) {
  let s = 0, peak = 0;
  for (let i = 0; i < frame.length; i++) { s += frame[i] * frame[i]; peak = Math.max(peak, Math.abs(frame[i])); }
  const db = 20 * Math.log10(Math.sqrt(s / frame.length) + 1e-9);
  const pct = Math.max(0, Math.min(100, ((db + 80) / 80) * 100));
  const bar = $('levelBar');
  bar.style.width = `${pct}%`;
  bar.classList.toggle('clip', peak > 0.98);
  $('levelText').textContent = `${db.toFixed(0)} dBFS`;
  return { db, peak };
}

// ---------- welcome hero: a real simulated vibration trace with bearing impacts ----------

function drawWelcome() {
  const canvas = $('welcomeCanvas');
  if (!canvas.clientWidth) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sim = new MachineSim({ sr: 24000, seed: 3 });
  sim.setFault('bearing_outer', 0.9);
  const x = sim.render(Math.round(24000 * 0.09));
  let max = 0;
  for (const v of x) max = Math.max(max, Math.abs(v));
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  g.strokeStyle = css('--ink');
  g.lineWidth = 1.2;
  g.beginPath();
  for (let i = 0; i < x.length; i++) {
    const px = (i / (x.length - 1)) * w;
    const py = h / 2 - (x[i] / max) * (h / 2 - 4);
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.stroke();
}

// ---------- audio pipeline ----------

function makeSource() {
  const kind = document.querySelector('input[name="source"]:checked').value;
  if (kind === 'mic') return new MicSource();
  if (kind === 'sim') {
    const s = new SimSource(machineParams(current()));
    s.setFault($('simFault').value, Number($('simSeverity').value));
    s.setListen($('simListen').checked);
    return s;
  }
  if (!run.file) throw new Error('Choose a recording first.');
  return new FileSource(run.file);
}

async function startSource(onFrame, onEnd) {
  const src = makeSource();
  run.source = src;
  run.ctx = null;
  run.acq = { kind: src.kind, label: src.label };
  await src.start((frame) => {
    if (!run.ctx || run.ctx.sr !== src.sr) run.ctx = makeContext(src.sr);
    onFrame(frame);
  }, onEnd);
  run.acq.sr = src.sr;
  const m = current();
  if (m?.baseline && src.sr !== m.baseline.sr) {
    notify(`This device records at ${src.sr / 1000} kHz but the baseline was learned at ${m.baseline.sr / 1000} kHz. Readings still work but are less precise; re-learn on this device for best results.`);
  }
}

async function startLearning() {
  const m = current();
  if (!m) return;
  if (m.baseline) {
    const ok = await confirmDialog(`Replace the healthy baseline learned on ${fmtDate(m.baseline.createdAt)}? Saved readings stay, but future readings will compare against the new sound.`, 'Replace baseline');
    if (!ok) return;
  }
  run.mode = 'learning';
  run.result = null;
  run.acc = null;
  run.builder = null;
  run.target = Number($('learnSeconds').value) * FRAMES_PER_SECOND;
  let quietWarned = false;
  renderFindings();
  try {
    await startSource((frame) => {
      if (run.mode !== 'learning') return;
      // Bands depend on the sample rate, so the builder must use the live source's context.
      if (!run.builder || run.builder.ctx !== run.ctx) run.builder = new BaselineBuilder(run.ctx);
      const lv = drawLevel(frame);
      if (lv.db < -78 && !quietWarned && run.builder.count > 10) {
        quietWarned = true;
        notify('The input is almost silent. Check that the microphone is allowed and not covered.', true);
      }
      if (lv.peak > 0.98) notify('The input is clipping. Move the phone a little further from the machine.', true);
      const f = analyzeFrame(frame, run.ctx);
      run.last = f;
      run.builder.add(f);
      if (run.builder.count >= run.target) finishLearning();
      else renderReadout();
      queueDraw();
    }, () => finishLearning(true));
    if (run.mode === 'learning') renderReadout();
  } catch (e) {
    stopAll();
    notify(e?.name === 'NotAllowedError' ? 'Microphone permission was refused. Allow it in the browser settings for this site and try again.' : e.message || String(e), true);
  }
}

function finishLearning(fromFileEnd = false) {
  if (run.mode !== 'learning') return;
  const m = current();
  const builder = run.builder;
  stopAll();
  if (!builder || builder.count < 20) {
    notify('Not enough sound to learn from. Record at least 5 seconds.', true);
    return;
  }
  try {
    m.baseline = builder.build();
  } catch (e) {
    notify(e.message, true);
    return;
  }
  persist();
  render();
  const secs = Math.round(builder.count / FRAMES_PER_SECOND);
  if (run.demo) {
    notify('Healthy sound learned. Monitoring now. In the simulator panel, change Condition to a fault and watch the reading respond.', false, true);
    startMonitoring();
  } else {
    notify(`Healthy sound learned from ${secs} s${fromFileEnd ? ' of the recording' : ''}. Start monitoring to compare.`);
  }
}

async function startMonitoring() {
  const m = current();
  if (!m?.baseline) return;
  run.mode = 'monitoring';
  run.acc = new Accumulator(30);
  run.frames = 0;
  run.result = null;
  renderReadout();
  renderFindings();
  try {
    await startSource((frame) => {
      if (run.mode !== 'monitoring') return;
      drawLevel(frame);
      const f = analyzeFrame(frame, run.ctx);
      run.last = f;
      run.acc.push(f);
      run.frames++;
      // Judge on a 3 second running average, refreshed twice a second.
      if (run.acc.count >= 10 && run.frames % 5 === 0) {
        run.result = assess(run.acc.average(), m.baseline, run.ctx, machineParams(m));
        renderReadout();
        renderFindings();
      } else if (run.acc.count < 10) renderReadout();
      queueDraw();
    }, () => {
      // Recording finished: judge it as a whole and keep it as a reading.
      if (run.acc?.count >= 10) run.result = assess(run.acc.average(), m.baseline, run.ctx, machineParams(m));
      stopAll();
      if (run.result) { saveReading(`Recording: ${run.file?.name || ''}`); notify('Recording analysed and saved to the trend.'); }
      else notify('The recording was too short to judge. Record at least 5 seconds.', true);
    });
  } catch (e) {
    stopAll();
    notify(e?.name === 'NotAllowedError' ? 'Microphone permission was refused. Allow it in the browser settings for this site and try again.' : e.message || String(e), true);
  }
}

function stopAll() {
  try { run.source?.stop(); } catch { /* already stopped */ }
  run.source = null;
  run.mode = 'idle';
  render();
}

function saveReading(note = '') {
  const m = current();
  const r = run.result;
  if (!m || !r) return;
  const sourceName = { mic: 'Microphone', sim: 'Simulator', file: 'Recording' }[document.querySelector('input[name="source"]:checked').value];
  store.addReading(m, {
    t: new Date().toISOString(),
    source: sourceName,
    health: r.health,
    zone: zoneOf(r.health),
    status: r.status,
    score: Math.round(r.statScore * 100) / 100,
    findings: r.findings.map((f) => f.title),
    note,
  });
  persist();
  renderHistory(m);
}

// ---------- report ----------

/** Draw a chart on a temporary fixed-size canvas so report images are sharp at A4 width. */
function chartImage(draw, height = 260) {
  const c = document.createElement('canvas');
  c.style.cssText = `position:fixed;left:-10000px;top:0;width:760px;height:${height}px`;
  document.body.appendChild(c);
  draw(c);
  const url = c.toDataURL('image/png');
  c.remove();
  return url;
}

function openReport() {
  const m = current();
  const r = run.result;
  if (!m || !r) return;
  // Render the charts in the light theme so the printed report reads on white paper.
  const root = document.documentElement;
  const prevTheme = root.dataset.theme;
  root.dataset.theme = 'light';
  const view = run.acc?.count ? run.acc.average() : run.last;
  const sr = run.ctx?.sr || m.baseline.sr, n = run.ctx?.n || m.baseline.n;
  const spec = chartImage((c) => drawSpectrum(c, { spectrum: view?.spectrum, sr, n, baseline: m.baseline }));
  const env = chartImage((c) => drawEnvelope(c, { envelope: view?.envelope, sr, n, baseline: m.baseline, markers: markerSet(m, sr) }));
  const bands = chartImage((c) => drawBands(c, { zBands: r.zBands, bandFc: m.baseline.bandFc }), 200);
  const trend = m.history.length ? chartImage((c) => drawTrend(c, m.history), 180) : '';
  if (prevTheme) root.dataset.theme = prevTheme; else delete root.dataset.theme;

  const zone = zoneOf(r.health);
  const zoneText = { A: 'As new', B: 'Acceptable', C: 'Plan maintenance', D: 'Act now' }[zone];
  const zoneColor = { A: '#2E8B57', B: '#86A92F', C: '#D99A12', D: '#C8372D' }[zone];
  const p = machineParams(m);
  const bf = p.bearing && p.rpm ? bearingFrequencies({ rpm: p.rpm, ...p.bearing }) : null;
  const rows = [
    ['Tag', m.tag], ['Location', m.location], ['Speed', m.rpm ? `${m.rpm} rpm` : 'Not set'],
    ['Bearing', m.bearingPreset || 'Unknown'], ['Measuring point', m.point],
    ['Baseline learned', fmtDate(m.baseline.createdAt)], ['Reading taken', fmtDate(new Date().toISOString())],
  ].filter(([, v]) => v);
  const acq = run.acq || {};
  const simulated = acq.kind === 'sim';
  const acqRows = [
    ['Sound source', simulated ? 'Built-in simulator (synthetic data, not a measurement)' : acq.kind === 'file' ? `Recording: ${acq.label}` : `Live microphone: ${acq.label || 'default'}`],
    ['Sample rate', acq.sr ? `${acq.sr / 1000} kHz` : ''],
    ['Window judged', run.acc?.count ? `${(run.acc.count / FRAMES_PER_SECOND).toFixed(1)} s running average` : ''],
    ['Baseline', `${(m.baseline.frames / FRAMES_PER_SECOND).toFixed(0)} s at ${m.baseline.sr / 1000} kHz, learned ${fmtDate(m.baseline.createdAt)}`],
    ['Thresholds', `watch at score ${m.baseline.calib.warn}, act at ${m.baseline.calib.alarm} (self-calibrated from the baseline); this reading scored ${r.statScore.toFixed(2)}`],
  ].filter(([, v]) => v);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Condition screening: ${esc(m.name)}</title>
<style>
  body{font:15px/1.5 Arial,Helvetica,sans-serif;color:#1D2733;max-width:820px;margin:24px auto;padding:0 20px;background:#fff}
  h1{font-size:24px;margin:0 0 4px} h2{font-size:17px;margin:28px 0 8px;border-bottom:1px solid #D5DCE3;padding-bottom:4px}
  .muted{color:#4A5868} table{border-collapse:collapse;width:100%} td{padding:4px 8px 4px 0;vertical-align:top} td:first-child{color:#4A5868;width:170px}
  .verdict{display:flex;gap:20px;align-items:center;margin-top:16px;padding:14px;border:1px solid #D5DCE3;border-radius:8px}
  .num{font-size:48px;font-weight:700;color:${zoneColor};line-height:1} .zone{display:inline-block;padding:2px 10px;border-radius:4px;background:${zoneColor};color:#fff;font-weight:700}
  .f{border-left:4px solid #7B8796;padding:2px 0 2px 10px;margin:10px 0} .f3{border-color:#C8372D}.f2{border-color:#D99A12}.f1{border-color:#86A92F}
  .f b{display:block} img{width:100%;max-width:760px;border:1px solid #E6EAEF;border-radius:6px;margin-top:6px}
  .print{margin:16px 0;padding:8px 16px;font-weight:600;cursor:pointer} @media print{.print{display:none} body{margin:0}}
  footer{margin-top:32px;font-size:12px;color:#7B8796}
</style></head><body>
<button class="print" onclick="window.print()">Print or save as PDF</button>
${simulated ? '<p style="padding:10px 12px;background:#FDF0D5;border:1px solid #D99A12;border-radius:6px;font-weight:600">Demonstration report: this reading comes from the built-in machine simulator, not from a real machine.</p>' : ''}
<h1>Acoustic condition screening</h1>
<p class="muted">${esc(m.name)}</p>
<div class="verdict"><div class="num">${r.health}</div><div><span class="zone">Zone ${zone}: ${zoneText}</span>
<p style="margin:8px 0 0">${esc(r.findings[0] ? r.findings[0].title : 'No fault pattern found; the sound matches the healthy baseline.')}</p></div></div>
<h2>Machine</h2><table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}
${bf ? `<tr><td>Bearing defect frequencies</td><td>BPFO ${bf.BPFO.toFixed(1)} Hz, BPFI ${bf.BPFI.toFixed(1)} Hz, BSF ${bf.BSF.toFixed(1)} Hz, FTF ${bf.FTF.toFixed(1)} Hz</td></tr>` : ''}</table>
<h2>Acquisition</h2><table>${acqRows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
<h2>Findings and recommended actions</h2>
<p class="muted">Findings are acoustic signatures that point to likely causes. Confirm by inspection before major work. A change in speed, load, neighbouring machines or microphone position can also move the sound.</p>
${r.findings.length ? r.findings.map((f) => `<div class="f f${f.severity}"><b>${esc(f.title)}</b><span class="muted">${esc(f.evidence)}</span><br>Recommended: ${esc(f.action)}</div>`).join('') : '<p>No fault pattern found. All frequency bands, running speed harmonics and bearing defect frequencies are inside their healthy ranges.</p>'}
<h2>Spectrum against healthy baseline</h2><img src="${spec}" alt="Spectrum">
<h2>Envelope spectrum (impact rhythm)</h2><img src="${env}" alt="Envelope spectrum">
<h2>Change per frequency band</h2><img src="${bands}" alt="Band deviation">
${trend ? `<h2>Health trend</h2><img src="${trend}" alt="Health trend">` : ''}
<h2>Method</h2><p class="muted">Acoustic condition assessment by comparison with a statistical baseline of the same machine at the same measuring point. Features: overall level, crest factor, kurtosis, spectral centroid and flatness, 24 log-spaced band energies, and the kurtosis and envelope spectrum of the 1.5 to 8 kHz band. Running speed harmonics, 2x line frequency and bearing defect frequencies are checked individually. Zones follow the A to D convention of ISO 10816 for readability; this is an acoustic screening, not a calibrated vibration measurement, and findings should be confirmed by inspection.</p>
<footer>Generated by Auscult on ${esc(fmtDate(new Date().toISOString()))}.</footer>
</body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) store.download(`report-${(m.tag || m.name).replace(/[^\w-]+/g, '_')}.html`, html, 'text/html');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---------- machine form ----------

function openForm(m) {
  const f = $('machineForm');
  f.hidden = false;
  $('btnEditMachine').setAttribute('aria-expanded', 'true');
  $('nameplate').hidden = true;
  f.name.value = m.name;
  f.tag.value = m.tag;
  f.location.value = m.location;
  f.rpm.value = m.rpm || '';
  f.lineHz.value = String(m.lineHz || 50);
  f.bearingPreset.value = m.bearingPreset || '';
  f.point.value = m.point;
  const b = m.bearing || {};
  f.balls.value = b.balls ?? '';
  f.ballDiam.value = b.ballDiam ?? '';
  f.pitchDiam.value = b.pitchDiam ?? '';
  f.angleDeg.value = b.angleDeg ?? 0;
  $('customBearing').hidden = f.bearingPreset.value !== 'custom';
  $('btnDeleteMachine').hidden = !state.machines.some((x) => x.id === m.id);
  f.name.focus();
}

function closeForm() {
  $('machineForm').hidden = true;
  $('nameplate').hidden = false;
  $('btnEditMachine').setAttribute('aria-expanded', 'false');
}

function readForm() {
  const f = $('machineForm');
  const preset = f.bearingPreset.value;
  let bearing = null;
  if (preset === 'custom') {
    bearing = { balls: Number(f.balls.value), ballDiam: Number(f.ballDiam.value), pitchDiam: Number(f.pitchDiam.value), angleDeg: Number(f.angleDeg.value) || 0 };
    if (!(bearing.balls >= 3 && bearing.ballDiam > 0 && bearing.pitchDiam > bearing.ballDiam)) {
      throw new Error('Enter the number of rolling elements, and a pitch diameter larger than the ball diameter.');
    }
  }
  const rpm = Number(f.rpm.value) || 0;
  if (rpm && (rpm < 30 || rpm > 20000)) throw new Error('Shaft speed should be between 30 and 20000 rpm.');
  return {
    name: f.name.value.trim() || 'Untitled machine',
    tag: f.tag.value.trim(),
    location: f.location.value.trim(),
    rpm,
    lineHz: Number(f.lineHz.value) || 50,
    bearingPreset: preset,
    bearing,
    point: f.point.value.trim(),
  };
}

// ---------- events ----------

function wire() {
  $('machineSelect').addEventListener('change', (e) => {
    state.currentId = e.target.value;
    run.result = null; run.last = null; run.acc = null;
    persist();
    closeForm();
    render();
  });

  const addMachine = () => {
    const m = store.newMachine({ name: '' });
    m.draft = true; // removed again if the form is cancelled
    state.machines.push(m);
    state.currentId = m.id;
    run.result = null; run.last = null; run.acc = null;
    render();
    openForm({ ...m, name: '' });
    $('btnDeleteMachine').hidden = false;
  };
  $('btnNewMachine').addEventListener('click', addMachine);
  $('btnFirstMachine').addEventListener('click', addMachine);

  $('btnEditMachine').addEventListener('click', () => {
    if ($('machineForm').hidden) openForm(current()); else closeForm();
  });
  $('btnCancelEdit').addEventListener('click', () => {
    const m = current();
    if (m?.draft) {
      state.machines = state.machines.filter((x) => x.id !== m.id);
      state.currentId = state.machines[0]?.id || null;
      persist();
    }
    closeForm();
    render();
  });
  $('bearingPreset').addEventListener('change', (e) => { $('customBearing').hidden = e.target.value !== 'custom'; });

  $('machineForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const m = current();
    let fields;
    try { fields = readForm(); } catch (err) { notify(err.message, true); return; }
    const speedChanged = m.baseline && m.rpm && fields.rpm && m.rpm !== fields.rpm;
    Object.assign(m, fields);
    delete m.draft;
    persist();
    closeForm();
    render();
    notify(speedChanged ? 'Saved. The speed changed, so harmonics are now checked at the new speed; re-learn the baseline if the machine itself runs differently.' : 'Machine saved.');
  });

  $('btnDeleteMachine').addEventListener('click', async () => {
    const m = current();
    const ok = await confirmDialog(`Delete "${m.name}" with its baseline and ${m.history.length} saved readings? Export a backup first if you might need them.`, 'Delete machine');
    if (!ok) return;
    state.machines = state.machines.filter((x) => x.id !== m.id);
    state.currentId = state.machines[0]?.id || null;
    run.result = null; run.last = null;
    persist();
    closeForm();
    render();
  });

  document.querySelectorAll('input[name="source"]').forEach((el) => el.addEventListener('change', () => {
    const v = document.querySelector('input[name="source"]:checked').value;
    document.querySelectorAll('.source-pane').forEach((p) => { p.hidden = p.dataset.pane !== v; });
  }));

  $('simFault').innerHTML = Object.entries(FAULTS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  const applySim = () => {
    $('simSevOut').textContent = `${Math.round(Number($('simSeverity').value) * 100)}%`;
    if (run.source?.kind === 'sim') run.source.setFault($('simFault').value, Number($('simSeverity').value));
  };
  $('simFault').addEventListener('change', applySim);
  $('simSeverity').addEventListener('input', applySim);
  $('simListen').addEventListener('change', (e) => { if (run.source?.kind === 'sim') run.source.setListen(e.target.checked); });

  $('fileAudio').addEventListener('change', (e) => {
    run.file = e.target.files[0] || null;
    $('fileName').textContent = run.file ? run.file.name : '';
  });

  $('btnLearn').addEventListener('click', () => { run.demo = false; startLearning(); });
  $('btnMonitor').addEventListener('click', () => { run.demo = false; notify(''); startMonitoring(); });
  $('btnStop').addEventListener('click', () => { notify(''); if (run.mode === 'learning') { stopAll(); notify('Learning stopped. The previous baseline is unchanged.'); } else stopAll(); });
  $('btnSave').addEventListener('click', () => { saveReading(); notify('Reading saved to the trend.'); });
  $('btnReport').addEventListener('click', openReport);
  $('btnCsv').addEventListener('click', () => {
    const m = current();
    store.download(`readings-${(m.tag || m.name).replace(/[^\w-]+/g, '_')}.csv`, store.historyCSV(m), 'text/csv');
  });
  $('btnBackup').addEventListener('click', () => {
    store.download(`auscult-backup-${new Date().toISOString().slice(0, 10)}.json`, store.backupText(state));
  });
  $('fileRestore').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { added, replaced } = store.restore(state, await file.text());
      if (!state.currentId && state.machines.length) state.currentId = state.machines[0].id;
      persist();
      render();
      notify(`Backup restored: ${added} machines added, ${replaced} updated.`);
    } catch (err) { notify(err.message, true); }
  });

  $('btnDemo').addEventListener('click', () => {
    let m = state.machines.find((x) => x.tag === 'P-201 SIM');
    if (!m) {
      m = store.newMachine({ name: 'Cooling water pump', tag: 'P-201 SIM', location: 'Built-in simulator', rpm: 1480, lineHz: 50, bearingPreset: '6205', point: 'Drive-end bearing housing, top' });
      state.machines.push(m);
    }
    m.baseline = null;
    state.currentId = m.id;
    persist();
    render();
    document.querySelector('input[name="source"][value="sim"]').checked = true;
    document.querySelectorAll('.source-pane').forEach((p) => { p.hidden = p.dataset.pane !== 'sim'; });
    $('simFault').value = 'none';
    $('learnSeconds').value = '10';
    run.demo = true;
    startLearning();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (current()) { queueDraw(); drawTrend($('trendCanvas'), current().history); } else drawWelcome(); }, 120);
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => render());
  window.addEventListener('beforeunload', () => run.source?.stop());
}

// Drop a machine that was added but never saved before the page was closed.
state.machines = state.machines.filter((m) => !m.draft);
if (!state.machines.some((m) => m.id === state.currentId)) state.currentId = state.machines[0]?.id || null;

wire();
render();
// Fonts can change chart label metrics once loaded.
document.fonts?.ready.then(() => { if (current()) queueDraw(); else drawWelcome(); });
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
