// charts.js
// Small canvas plots. Colours come from CSS custom properties so light and dark themes both work.

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Size a canvas to its CSS box at device pixel ratio and return a ready 2D context. */
function setup(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  g.font = `12px ${css('--font-body') || 'sans-serif'}`;
  return { g, w, h };
}

const PAD = { l: 46, r: 10, t: 10, b: 24 };
const toDb = (a) => 20 * Math.log10(a + 1e-9);

function grid(g, w, h, xTicks, yTicks, xPos, yPos) {
  g.strokeStyle = css('--grid');
  g.fillStyle = css('--ink-faint');
  g.lineWidth = 1;
  g.textAlign = 'center';
  g.textBaseline = 'top';
  for (const t of xTicks) {
    const x = Math.round(xPos(t.v)) + 0.5;
    g.beginPath(); g.moveTo(x, PAD.t); g.lineTo(x, h - PAD.b); g.stroke();
    g.fillText(t.label, x, h - PAD.b + 6);
  }
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  for (const t of yTicks) {
    const y = Math.round(yPos(t.v)) + 0.5;
    g.beginPath(); g.moveTo(PAD.l, y); g.lineTo(w - PAD.r, y); g.stroke();
    g.fillText(t.label, PAD.l - 6, y);
  }
}

function empty(g, w, h, text) {
  g.fillStyle = css('--ink-faint');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2);
}

/** Amplitude spectrum on a log frequency axis, current over baseline. */
export function drawSpectrum(canvas, { spectrum, sr, n, baseline }) {
  const { g, w, h } = setup(canvas);
  const fmin = 20, fmax = Math.min(12000, sr / 2 || 12000);
  const dbMin = -110, dbMax = -10;
  const xPos = (f) => PAD.l + ((Math.log10(f) - Math.log10(fmin)) / (Math.log10(fmax) - Math.log10(fmin))) * (w - PAD.l - PAD.r);
  const yPos = (d) => PAD.t + ((dbMax - Math.max(dbMin, Math.min(dbMax, d))) / (dbMax - dbMin)) * (h - PAD.t - PAD.b);
  const xt = [50, 100, 200, 500, 1000, 2000, 5000, 10000].filter((f) => f < fmax).map((v) => ({ v, label: v >= 1000 ? `${v / 1000}k` : `${v}` }));
  const yt = [-100, -80, -60, -40, -20].map((v) => ({ v, label: v === -20 ? '-20 dB' : `${v}` }));
  grid(g, w, h, xt, yt, xPos, yPos);

  const trace = (arr, asr, an, fill) => {
    g.beginPath();
    let started = false;
    const k0 = Math.max(1, Math.floor((fmin * an) / asr));
    const k1 = Math.min(arr.length - 1, Math.ceil((fmax * an) / asr));
    // Decimate to about one point per pixel, keeping the peak in each pixel column.
    let lastX = -1, colMax = -Infinity;
    for (let k = k0; k <= k1; k++) {
      const x = xPos((k * asr) / an);
      const d = toDb(arr[k]);
      if (Math.floor(x) === lastX) { colMax = Math.max(colMax, d); continue; }
      if (lastX >= 0) {
        const y = yPos(colMax);
        if (!started) { g.moveTo(lastX, fill ? h - PAD.b : y); if (fill) g.lineTo(lastX, y); started = true; } else g.lineTo(lastX, y);
      }
      lastX = Math.floor(x); colMax = d;
    }
    if (fill) { g.lineTo(lastX, h - PAD.b); g.closePath(); g.fill(); } else g.stroke();
  };

  if (baseline?.spectrum) {
    g.fillStyle = css('--baseline-fill');
    trace(baseline.spectrum, baseline.sr, baseline.n, true);
  }
  if (spectrum) {
    g.strokeStyle = css('--trace');
    g.lineWidth = 1.5;
    trace(spectrum, sr, n, false);
  } else if (!baseline) empty(g, w, h, 'Start the microphone, simulator or a recording to see the spectrum');
}

/** Envelope spectrum 0..maxHz with labelled markers. */
export function drawEnvelope(canvas, { envelope, sr, n, baseline, markers = [], maxHz = 500 }) {
  const { g, w, h } = setup(canvas);
  if (!envelope) { empty(g, w, h, 'Envelope spectrum appears while listening'); return; }
  const k1 = Math.min(envelope.length - 1, Math.ceil((maxHz * n) / sr));
  let top = 1e-9;
  for (let k = 2; k <= k1; k++) top = Math.max(top, envelope[k]);
  top *= 1.45; // headroom for the marker labels
  const xPos = (f) => PAD.l + (f / maxHz) * (w - PAD.l - PAD.r);
  const yPos = (v) => PAD.t + (1 - Math.min(1, v / top)) * (h - PAD.t - PAD.b);
  const xt = [50, 100, 150, 200, 250, 300, 350, 400, 450].filter((f) => f < maxHz).map((v) => ({ v, label: `${v}` }));
  grid(g, w, h, xt, [{ v: 0, label: '0' }], xPos, yPos);

  // markers: each label goes in the first of three rows where it does not collide with another
  g.font = `600 11px ${css('--font-body')}`;
  const rows = [[], [], []];
  const labelTop = PAD.t - 4;
  const visible = markers.filter((m) => m.hz > 0 && m.hz < maxHz).sort((a, b) => a.hz - b.hz);
  for (const m of visible) {
    const x = Math.round(xPos(m.hz)) + 0.5;
    const half = g.measureText(m.label).width / 2 + 3;
    let row = rows.findIndex((r) => r.every(([a, b]) => x + half < a || x - half > b));
    if (row < 0) row = 2;
    rows[row].push([x - half, x + half]);
    g.strokeStyle = m.color;
    g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(x, labelTop + (row + 1) * 13); g.lineTo(x, h - PAD.b); g.stroke();
    g.setLineDash([]);
    g.fillStyle = m.color;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillText(m.label, x, labelTop + row * 13);
  }

  if (baseline?.envelope) {
    g.strokeStyle = css('--baseline-line');
    g.lineWidth = 1;
    g.beginPath();
    const bk1 = Math.min(baseline.envelope.length - 1, Math.ceil((maxHz * baseline.n) / baseline.sr));
    for (let k = 1; k <= bk1; k++) {
      const x = xPos((k * baseline.sr) / baseline.n), y = yPos(baseline.envelope[k]);
      k === 1 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }
  g.strokeStyle = css('--trace');
  g.lineWidth = 1.5;
  g.beginPath();
  for (let k = 1; k <= k1; k++) {
    const x = xPos((k * sr) / n), y = yPos(envelope[k]);
    k === 1 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.stroke();
  g.fillStyle = css('--ink-faint');
  g.textAlign = 'right';
  g.textBaseline = 'bottom';
  g.font = `12px ${css('--font-body')}`;
  g.fillText('Hz', w - PAD.r, h - 2);
}

/** Per-band deviation from baseline in standard deviations. */
export function drawBands(canvas, { zBands, bandFc }) {
  const { g, w, h } = setup(canvas);
  if (!zBands) { empty(g, w, h, 'Band changes appear once a baseline exists'); return; }
  const lim = 8;
  const yPos = (z) => PAD.t + ((lim - Math.max(-lim, Math.min(lim, z))) / (2 * lim)) * (h - PAD.t - PAD.b);
  const bw = (w - PAD.l - PAD.r) / zBands.length;
  const xt = bandFc.map((fc, i) => ({ fc, i })).filter((_, i) => i % 4 === 0)
    .map(({ fc, i }) => ({ v: i, label: fc >= 1000 ? `${(fc / 1000).toFixed(1)}k` : `${fc}` }));
  grid(g, w, h, xt, [-6, -3, 0, 3, 6].map((v) => ({ v, label: `${v > 0 ? '+' : ''}${v}σ` })), (i) => PAD.l + (i + 0.5) * bw, yPos);
  const y0 = yPos(0);
  zBands.forEach((z, i) => {
    const a = Math.abs(z);
    g.fillStyle = a > 6 ? css('--zone-d') : a > 3 ? css('--zone-c') : a > 2 ? css('--zone-b') : css('--ink-faint');
    const y = yPos(z);
    g.fillRect(PAD.l + i * bw + 1, Math.min(y, y0), Math.max(1, bw - 2), Math.max(1, Math.abs(y - y0)));
  });
}

/** Health over time from saved readings. */
export function drawTrend(canvas, history) {
  const { g, w, h } = setup(canvas);
  if (!history?.length) { empty(g, w, h, 'Saved readings build a health trend here'); return; }
  const pts = history.slice(-60);
  const t0 = new Date(pts[0].t).getTime();
  const t1 = Math.max(t0 + 1, new Date(pts[pts.length - 1].t).getTime());
  const xPos = (t) => PAD.l + ((t - t0) / (t1 - t0)) * (w - PAD.l - PAD.r - 6) + 3;
  const yPos = (v) => PAD.t + (1 - v / 100) * (h - PAD.t - PAD.b);
  // zone bands behind the line
  const zones = [[85, 100, '--zone-a'], [70, 85, '--zone-b'], [40, 70, '--zone-c'], [0, 40, '--zone-d']];
  g.globalAlpha = 0.12;
  for (const [lo, hi, c] of zones) { g.fillStyle = css(c); g.fillRect(PAD.l, yPos(hi), w - PAD.l - PAD.r, yPos(lo) - yPos(hi)); }
  g.globalAlpha = 1;
  const fmt = (t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  grid(g, w, h, pts.length > 1 ? [{ v: t0, label: fmt(t0) }, { v: t1, label: fmt(t1) }] : [], [0, 40, 70, 100].map((v) => ({ v, label: `${v}` })), xPos, yPos);
  g.strokeStyle = css('--trace');
  g.lineWidth = 2;
  g.beginPath();
  pts.forEach((p, i) => { const x = xPos(new Date(p.t).getTime()), y = yPos(p.health); i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.stroke();
  pts.forEach((p) => {
    g.fillStyle = css(p.health >= 85 ? '--zone-a' : p.health >= 70 ? '--zone-b' : p.health >= 40 ? '--zone-c' : '--zone-d');
    g.beginPath(); g.arc(xPos(new Date(p.t).getTime()), yPos(p.health), 3.5, 0, Math.PI * 2); g.fill();
  });
}
