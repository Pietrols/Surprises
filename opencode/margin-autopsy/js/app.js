// app.js
// Wires the Margin Autopsy engine, interactive scope surgery table, histogram canvas,
// and printable Client Scope & Boundary Schedule.

import { parseScopeText, analyzeLineItem, runAutopsy } from './engine.js';
import { SCENARIOS } from './scenarios.js';

const STORAGE_KEY = 'margin_autopsy_state_v2';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CURRENCY_SYM = { USD: '$', ZMW: 'K', EUR: '€', GBP: '£' };

const state = {
  scenarioId: SCENARIOS[0].id,
  projectName: SCENARIOS[0].name,
  currency: SCENARIOS[0].currency || 'USD',
  quotePrice: SCENARIOS[0].quotePrice,
  targetRate: SCENARIOS[0].targetRate,
  hardCost: SCENARIOS[0].hardCost,
  iterations: 2000,
  scopeText: SCENARIOS[0].scopeText,
  items: [],
  report: null,
};

function fmtMoney(n, cur = state.currency) {
  const sym = CURRENCY_SYM[cur] || '$';
  const abs = Math.abs(Math.round(n)).toLocaleString();
  return n < 0 ? `-${sym}${abs}` : `${sym}${abs}`;
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length) {
        Object.assign(state, parsed);
        state.items = state.items.map((it) => analyzeLineItem(it));
        return true;
      }
    }
  } catch { /* ignore storage errors */ }
  return false;
}

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        scenarioId: state.scenarioId,
        projectName: state.projectName,
        currency: state.currency,
        quotePrice: state.quotePrice,
        targetRate: state.targetRate,
        hardCost: state.hardCost,
        iterations: state.iterations,
        scopeText: state.scopeText,
        items: state.items,
      })
    );
  } catch { /* ignore */ }
}

let toastTimer;
function notify(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

function syncInputsFromState() {
  $('projectName').value = state.projectName;
  $('currencySelect').value = state.currency || 'USD';
  $('quotePrice').value = state.quotePrice;
  $('targetRate').value = state.targetRate;
  $('hardCost').value = state.hardCost;
  $('simRuns').value = String(state.iterations);
  $('scopeTextarea').value = state.scopeText;
}

function recompute() {
  state.report = runAutopsy(state.items, {
    quotePrice: state.quotePrice,
    targetRate: state.targetRate,
    hardCost: state.hardCost,
    currency: state.currency,
    iterations: state.iterations,
  });
  saveState();
  renderAll();
}

function renderAll() {
  const r = state.report;
  if (!r) return;
  const sym = CURRENCY_SYM[state.currency] || '$';

  const netRev = r.config.activeNetRevenue;
  const paperRate = r.activeBaseHours > 0 ? Math.round(netRev / r.activeBaseHours) : 0;
  $('quotedRatePill').textContent = `Phase-1 Net: ${fmtMoney(netRev)} · Max ${r.current.maxHoursForTarget}h @ ${fmtMoney(r.config.targetRate)}/hr`;
  $('itemCountLabel').textContent = `${state.items.length} deliverables analyzed`;

  // Verdict card
  const vc = $('verdictCard');
  vc.dataset.status = r.verdictStatus;
  $('verdictBadge').textContent =
    r.verdictStatus === 'critical'
      ? 'CRITICAL SCOPE-DRIFT TRAP'
      : r.verdictStatus === 'watch'
      ? 'FRAGILE MARGIN (TAIL RISK)'
      : 'MARGIN PROTECTED AT P90';
  $('verdictTitle').textContent = r.verdictTitle;

  const p90Profit = r.current.economicMargin.profitP90;
  const subParts = [
    `At p90 tail effort (${r.current.hours.p90}h), your realized Phase-1 rate is ${fmtMoney(r.current.effectiveRate.p10)}/hr (${
      p90Profit >= 0 ? `${fmtMoney(p90Profit)} above` : `${fmtMoney(Math.abs(p90Profit))} below`
    } your ${fmtMoney(r.config.targetRate)}/hr floor).`,
  ];
  if (r.config.carvedOutQuoteReduction > 0) {
    subParts.push(`Phase-1 fee proportionally adjusted to ${fmtMoney(r.config.activeQuotePrice)} (−${fmtMoney(r.config.carvedOutQuoteReduction)} carved into ${fmtMoney(r.phase2Value)} Phase-2 option).`);
  }
  if (r.hoursSavedP90 > 0) {
    subParts.push(`Scope surgery removed ${r.hoursSavedP90}h of unpriced p90 overrun.`);
  }
  $('verdictSub').textContent = subParts.join(' ');

  $('safeBidVal').textContent = fmtMoney(r.safeFixedPrice);
  $('safeBidNote').textContent =
    r.phase2Value > 0
      ? `Phase 1 + ${fmtMoney(r.phase2Value)} Phase-2 option`
      : `to lock ${fmtMoney(r.config.targetRate)}/hr at p90`;

  // Metrics strip
  $('mBaseHours').textContent = `${r.activeBaseHours} hrs`;
  $('mPaperRate').textContent = `${fmtMoney(paperRate)}/hr on paper (${r.quotedBaseHours}h total)`;

  $('mP50Hours').textContent = `${r.current.hours.p50} hrs`;
  $('mP50Rate').textContent = `${fmtMoney(r.current.effectiveRate.p50)}/hr realized median`;

  $('mP90Hours').textContent = `${r.current.hours.p90} hrs`;
  $('mP90Rate').textContent = `${fmtMoney(r.current.effectiveRate.p10)}/hr in p90 tail`;

  $('mProbUnder').textContent = `${r.current.probBelowTarget}%`;
  $('mShieldSaved').textContent =
    r.hoursSavedP90 > 0
      ? `Cut ${r.hoursSavedP90}h overrun (was ${r.unshielded.probBelowTarget}%)`
      : `Unshielded (${sym}) · click Auto-Shield`;

  renderDrivers(r);
  renderTable(r);
  renderShields(r);
  drawHistogram($('histCanvas'), r);
}

function renderDrivers(r) {
  const top = r.drivers.slice(0, 4);
  $('driversList').innerHTML = top
    .map(
      (d) => `
    <li class="driver-item">
      <div class="driver-top">
        <span>#${d.index} ${esc(d.title)}</span>
        <span class="mono">+${d.overrunHours}h</span>
      </div>
      <div class="driver-meta">
        Base ${d.baseHours}h → Raw p90 ${d.p90Hours}h (${fmtMoney(d.overrunCost)} unpriced drag · ${d.sharePct}% of tail)
      </div>
      <div class="driver-bar"><div style="width:${Math.min(100, Math.max(8, d.sharePct))}%"></div></div>
    </li>`
    )
    .join('');
}

function renderTable(r) {
  const tbody = $('scopeTableBody');
  tbody.innerHTML = r.items
    .map((it) => {
      const badges = it.matchedRules.length
        ? it.matchedRules
            .map(
              (rule) =>
                `<span class="rule-badge ${it.riskLevel === 'critical' ? 'crit' : ''}" title="${esc(rule.reason)}">${esc(rule.label)}</span>`
            )
            .join('')
        : `<span class="rule-badge clean">Clean / Bounded</span>`;

      return `
      <tr data-id="${esc(it.id)}">
        <td class="mono">${it.index}</td>
        <td>
          <div><strong>${esc(it.title)}</strong></div>
          <div class="rule-badges">${badges}</div>
        </td>
        <td>
          <input type="number" class="hrs-input" data-action="hours" data-id="${esc(it.id)}" min="1" max="500" step="1" value="${it.baseHours}" aria-label="Base hours for item ${it.index}">
        </td>
        <td class="mono">${it.raw.p50}h / <strong>${it.raw.p90}h</strong></td>
        <td>
          <select class="mode-select" data-action="mode" data-id="${esc(it.id)}" aria-label="Contractual mode for item ${it.index}">
            <option value="core" ${it.mode === 'core' ? 'selected' : ''}>Core Fixed (Absorb Risk)</option>
            <option value="allowance" ${it.mode === 'allowance' ? 'selected' : ''}>Capped Allowance (${it.capHours}h cap)</option>
            <option value="phase2" ${it.mode === 'phase2' ? 'selected' : ''}>Phase-2 Paid Option</option>
          </select>
        </td>
        <td class="mono">
          <strong>${it.effective.p90}h</strong>
          ${it.mode !== 'core' ? `<span style="display:block;font-size:11px;color:var(--accent)">−${(it.raw.p90 - it.effective.p90).toFixed(1)}h shielded</span>` : ''}
        </td>
      </tr>`;
    })
    .join('');
}

function renderShields(r) {
  const cards = [];
  for (const it of r.items) {
    for (const s of it.shields) {
      cards.push({
        itemIndex: it.index,
        itemTitle: it.title,
        mode: it.mode,
        label: s.label,
        reason: s.reason,
        clause: s.clause,
      });
    }
  }
  $('shieldsGrid').innerHTML = cards
    .map(
      (c, i) => `
    <article class="shield-card">
      <div>
        <div class="shield-head">
          <span class="shield-title">#${c.itemIndex} · ${esc(c.label)}</span>
          <button class="link-btn" type="button" data-copy-idx="${i}">Copy</button>
        </div>
        <p class="shield-why">${esc(c.reason)}</p>
      </div>
      <blockquote class="shield-clause" id="clause_${i}">${esc(c.clause)}</blockquote>
    </article>`
    )
    .join('');
}

function drawHistogram(canvas, r) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 720;
  const h = canvas.clientHeight || 210;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const bins = r.current.histogram;
  if (!bins.length) return;

  const pad = { l: 42, r: 20, t: 24, b: 30 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  const maxCount = Math.max(1, ...bins.map((b) => b.count));
  const minH = bins[0].lo;
  const maxH = bins[bins.length - 1].hi;
  const xOf = (hrs) => pad.l + ((hrs - minH) / Math.max(1, maxH - minH)) * plotW;

  const bw = plotW / bins.length;
  const threshold = r.current.maxHoursForTarget;

  bins.forEach((b, i) => {
    const bh = (b.count / maxCount) * plotH;
    const x = pad.l + i * bw + 2;
    const y = pad.t + plotH - bh;
    g.fillStyle = b.mid > threshold ? css('--danger') : css('--accent');
    g.globalAlpha = 0.82;
    g.fillRect(x, y, Math.max(2, bw - 4), bh);
  });
  g.globalAlpha = 1;

  const markers = [
    { hrs: r.current.hours.p50, label: `p50 (${r.current.hours.p50}h)`, color: css('--blue') },
    { hrs: r.current.hours.p90, label: `p90 (${r.current.hours.p90}h)`, color: css('--warn') },
    { hrs: threshold, label: `Target Floor (${threshold}h)`, color: css('--danger') },
  ];

  g.font = `600 11px ${css('--font-sans') || 'sans-serif'}`;
  markers.forEach((m, idx) => {
    if (m.hrs < minH || m.hrs > maxH) return;
    const x = Math.round(xOf(m.hrs)) + 0.5;
    g.strokeStyle = m.color;
    g.lineWidth = 1.5;
    g.setLineDash([4, 3]);
    g.beginPath();
    g.moveTo(x, pad.t - 4);
    g.lineTo(x, pad.t + plotH);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = m.color;
    g.textAlign = x > w - 90 ? 'right' : x < 90 ? 'left' : 'center';
    g.fillText(m.label, x, 13 + (idx % 2) * 10);
  });

  g.fillStyle = css('--ink-muted');
  g.font = `11px ${css('--font-mono') || 'monospace'}`;
  g.textAlign = 'center';
  for (let i = 0; i <= 5; i++) {
    const val = Math.round(minH + ((maxH - minH) * i) / 5);
    const x = xOf(val);
    g.fillText(`${val}h`, x, h - 8);
  }
}

function openClientSchedule() {
  const r = state.report;
  if (!r) return;
  const coreItems = r.items.filter((it) => it.mode !== 'phase2');
  const phase2Items = r.items.filter((it) => it.mode === 'phase2');
  const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Scope & Boundary Schedule — ${esc(state.projectName)}</title>
<style>
  body { font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0F172A; max-width: 840px; margin: 28px auto; padding: 0 24px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; color: #334155; border-bottom: 2px solid #E2E8F0; padding-bottom: 6px; margin-top: 26px; }
  .meta { display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 18px; margin-top: 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border-bottom: 1px solid #E2E8F0; padding: 9px 8px; text-align: left; vertical-align: top; }
  th { font-size: 12px; color: #475569; }
  .tag { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 4px; background: #E0F2FE; color: #0369A1; }
  .clause { margin: 6px 0 0; font-size: 12.5px; color: #334155; background: #F8FAFC; border-left: 3px solid #059669; padding: 6px 10px; }
  .print-btn { margin-bottom: 16px; padding: 8px 16px; font-weight: 600; cursor: pointer; }
  @media print { .print-btn { display: none; } body { margin: 0; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  <h1>Statement of Work: Scope &amp; Boundary Schedule</h1>
  <p style="color:#475569;margin:0">${esc(state.projectName)} · Prepared ${esc(dateStr)}</p>

  <div class="meta">
    <div><strong>Phase 1 Fixed Fee:</strong> ${fmtMoney(r.config.activeQuotePrice)}</div>
    <div><strong>Phase 1 Baseline Allocation:</strong> ${r.activeBaseHours} hrs</div>
    <div><strong>Optional Phase 2 Estimate:</strong> ${phase2Items.length ? fmtMoney(r.phase2Value) : 'None'}</div>
  </div>

  <h2>1. Phase 1 Deliverables &amp; Contractual Guardrails</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Deliverable &amp; Acceptance Boundary</th><th>Basis</th><th>Allocation</th></tr>
    </thead>
    <tbody>
      ${coreItems
        .map(
          (it) => `
        <tr>
          <td>${it.index}</td>
          <td>
            <strong>${esc(it.title)}</strong>
            ${it.shields.map((s) => `<div class="clause"><strong>${esc(s.label)}:</strong> ${esc(s.clause)}</div>`).join('')}
          </td>
          <td><span class="tag">${it.mode === 'allowance' ? `Capped Allowance (${it.capHours}h max)` : 'Fixed Scope'}</span></td>
          <td>${it.baseHours} hrs</td>
        </tr>`
        )
        .join('')}
    </tbody>
  </table>

  ${
    phase2Items.length
      ? `
  <h2>2. Phase 2 Optional Modules (Excluded from Phase 1 Fixed Fee)</h2>
  <table>
    <thead><tr><th>#</th><th>Optional Deliverable</th><th>Estimated Effort (p50)</th><th>Indicative Budget</th></tr></thead>
    <tbody>
      ${phase2Items
        .map(
          (it) => `
        <tr>
          <td>${it.index}</td>
          <td><strong>${esc(it.title)}</strong></td>
          <td>${it.raw.p50} hrs</td>
          <td>${fmtMoney(it.raw.p50 * r.config.targetRate)}</td>
        </tr>`
        )
        .join('')}
    </tbody>
  </table>`
      : ''
  }

  <h2>3. Change-Control Protocol</h2>
  <p style="font-size:13px;color:#334155">Capped Allowance items include up to the stated maximum hours; work beyond the cap or outside the enumerated boundaries above is handled via a written Change Order at ${fmtMoney(r.config.targetRate)}/hr or deferred to Phase 2.</p>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function wireEvents() {
  const sel = $('scenarioSelect');
  sel.innerHTML = SCENARIOS.map((s) => {
    const sym = CURRENCY_SYM[s.currency || 'USD'] || '$';
    return `<option value="${esc(s.id)}">${esc(s.name)} (${sym}${s.quotePrice.toLocaleString()})</option>`;
  }).join('');
  sel.value = state.scenarioId;

  sel.addEventListener('change', (e) => {
    const sc = SCENARIOS.find((x) => x.id === e.target.value);
    if (!sc) return;
    state.scenarioId = sc.id;
    state.projectName = sc.name;
    state.currency = sc.currency || 'USD';
    state.quotePrice = sc.quotePrice;
    state.targetRate = sc.targetRate;
    state.hardCost = sc.hardCost;
    state.scopeText = sc.scopeText;
    state.items = parseScopeText(sc.scopeText);
    syncInputsFromState();
    recompute();
    notify(`Loaded scenario: ${sc.name}`);
  });

  const onParamInput = () => {
    state.projectName = $('projectName').value.trim() || 'Untitled Project';
    state.currency = $('currencySelect').value || 'USD';
    state.quotePrice = Number($('quotePrice').value) || 1000;
    state.targetRate = Number($('targetRate').value) || 100;
    state.hardCost = Number($('hardCost').value) || 0;
    state.iterations = Number($('simRuns').value) || 2000;
    recompute();
  };

  for (const id of ['projectName', 'currencySelect', 'quotePrice', 'targetRate', 'hardCost', 'simRuns']) {
    $(id).addEventListener('input', onParamInput);
  }

  $('btnParseScope').addEventListener('click', () => {
    state.scopeText = $('scopeTextarea').value;
    state.items = parseScopeText(state.scopeText);
    recompute();
    notify('Scope text re-parsed.');
  });

  $('scopeTextarea').addEventListener('change', () => {
    state.scopeText = $('scopeTextarea').value;
    state.items = parseScopeText(state.scopeText);
    recompute();
  });

  $('scopeTableBody').addEventListener('change', (e) => {
    const id = e.target.dataset.id;
    const action = e.target.dataset.action;
    const idx = state.items.findIndex((x) => x.id === id);
    if (idx < 0) return;
    if (action === 'hours') {
      state.items[idx] = analyzeLineItem({ ...state.items[idx], baseHours: Number(e.target.value) || 4 });
    } else if (action === 'mode') {
      state.items[idx] = analyzeLineItem({ ...state.items[idx], mode: e.target.value });
    }
    recompute();
  });

  $('btnAutoSurgery').addEventListener('click', () => {
    const sortedRisk = [...state.items].sort((a, b) => b.raw.overrunP90 - a.raw.overrunP90);
    const worstId = sortedRisk[0]?.id;
    state.items = state.items.map((it) => {
      if (it.id === worstId && it.riskScore >= 55) {
        return analyzeLineItem({ ...it, mode: 'phase2' });
      }
      if (it.riskScore >= 35) {
        return analyzeLineItem({ ...it, mode: 'allowance' });
      }
      return it;
    });
    recompute();
    notify('Auto-Shield applied: worst trap moved to Phase-2 Option and high-risk items capped.');
  });

  $('btnResetModes').addEventListener('click', () => {
    state.items = state.items.map((it) => analyzeLineItem({ ...it, mode: 'core' }));
    recompute();
    notify('All deliverables reset to Core Fixed scope.');
  });

  $('btnCopyShields').addEventListener('click', async () => {
    const lines = [];
    for (const it of state.report.items) {
      for (const s of it.shields) {
        lines.push(`• [Item #${it.index} — ${it.title}] ${s.clause}`);
      }
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      notify('Copied all Change-Order Shield clauses to clipboard.');
    } catch {
      notify('Clipboard unavailable in this context.');
    }
  });

  $('shieldsGrid').addEventListener('click', async (e) => {
    const idx = e.target.dataset.copyIdx;
    if (idx == null) return;
    const el = $(`clause_${idx}`);
    if (!el) return;
    try {
      await navigator.clipboard.writeText(el.textContent);
      notify('Clause copied to clipboard.');
    } catch {
      notify('Clipboard unavailable.');
    }
  });

  $('btnExportJson').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `margin-autopsy-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

  $('btnPrintSchedule').addEventListener('click', openClientSchedule);
  window.addEventListener('resize', () => {
    if (state.report) drawHistogram($('histCanvas'), state.report);
  });
}

if (!loadSaved()) {
  state.items = parseScopeText(state.scopeText);
}
syncInputsFromState();
wireEvents();
recompute();
