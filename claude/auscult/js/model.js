// model.js
// Baseline learning, anomaly scoring, health index and fault diagnosis.
// Pure JS: shared by the app and the tests.

import {
  makeBands, extractFeatures, envelopeAnalysis, bearingFrequencies,
  peakNear, localFloor, valueAtHz, topPeaks,
} from './dsp.js';

export const FRAME = 8192;
export const ENV_BAND = [1500, 8000];

// Scalar features and the smallest standard deviation we trust for each.
// The floors stop a very steady baseline from turning tiny wobbles into alarms.
const SCALARS = [
  { key: 'rmsDb', floor: 0.8, weight: 1.5, label: 'Overall level' },
  { key: 'crest', floor: 0.25, weight: 1.5, label: 'Crest factor', oneSided: true },
  { key: 'kurtosis', floor: 0.35, weight: 2, label: 'Kurtosis (impulsiveness)', oneSided: true },
  { key: 'centroidKHz', floor: 0.08, weight: 1, label: 'Spectral centroid' },
  { key: 'flatness', floor: 0.015, weight: 1, label: 'Spectral flatness' },
  // Statistics of the 1.5 to 8 kHz band, where bearing and gear impacts ring
  { key: 'hfKurtosis', floor: 0.3, weight: 3, label: 'High-band kurtosis', oneSided: true },
  { key: 'hfLevelDb', floor: 1.0, weight: 1, label: 'High-band level' },
];
const BAND_FLOOR_DB = 1.5;

/** Context for a given sample rate: band layout, cached. */
export function makeContext(sr) {
  return { sr, n: FRAME, bands: makeBands(sr, FRAME) };
}

/** Full per-frame analysis: features + envelope spectrum. */
export function analyzeFrame(frame, ctx) {
  const f = extractFeatures(frame, ctx.sr, ctx.bands);
  f.centroidKHz = f.centroidHz / 1000;
  const env = envelopeAnalysis(frame, ctx.sr, ENV_BAND[0], ENV_BAND[1]);
  f.envelope = env.spectrum;
  f.hfKurtosis = env.kurtosis;
  f.hfLevelDb = env.levelDb;
  return f;
}

function vectorOf(f) {
  return [...SCALARS.map((s) => f[s.key]), ...f.bandDb];
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i];
}

/** Accumulates frames during baseline learning. */
export class BaselineBuilder {
  constructor(ctx) {
    this.ctx = ctx;
    this.vectors = [];
    this.specSum = null;
    this.envSum = null;
  }
  add(f) {
    this.vectors.push(vectorOf(f));
    if (!this.specSum) {
      this.specSum = new Float64Array(f.spectrum.length);
      this.envSum = new Float64Array(f.envelope.length);
    }
    for (let k = 0; k < f.spectrum.length; k++) this.specSum[k] += f.spectrum[k];
    for (let k = 0; k < f.envelope.length; k++) this.envSum[k] += f.envelope[k];
  }
  get count() { return this.vectors.length; }

  /** Finalise into a serialisable baseline object. */
  build() {
    const N = this.vectors.length;
    if (N < 20) throw new Error('Need at least 20 frames (about 2 seconds) to learn a baseline');
    const dims = this.vectors[0].length;
    const mu = new Array(dims).fill(0);
    const sd = new Array(dims).fill(0);
    for (const v of this.vectors) for (let d = 0; d < dims; d++) mu[d] += v[d] / N;
    for (const v of this.vectors) for (let d = 0; d < dims; d++) sd[d] += (v[d] - mu[d]) ** 2 / (N - 1);
    for (let d = 0; d < dims; d++) {
      const floor = d < SCALARS.length ? SCALARS[d].floor : BAND_FLOOR_DB;
      sd[d] = Math.max(Math.sqrt(sd[d]), floor);
    }
    const round = (x, p = 1e5) => Math.round(x * p) / p;
    const baseline = {
      version: 1,
      createdAt: new Date().toISOString(),
      sr: this.ctx.sr,
      n: this.ctx.n,
      frames: N,
      mu: mu.map((x) => round(x)),
      sd: sd.map((x) => round(x)),
      bandFc: this.ctx.bands.map((b) => Math.round(b.fc)),
      // 4 significant digits is plenty for a reference spectrum and keeps local storage small.
      spectrum: Array.from(this.specSum, (x) => Number((x / N).toPrecision(4))),
      // Defect frequencies of interest sit well below 1.2 kHz, so the envelope is stored only up to there.
      envelope: Array.from(this.envSum.subarray(0, Math.ceil((1200 * this.ctx.n) / this.ctx.sr) + 1), (x) => Number((x / N).toPrecision(4))),
    };
    // Self-calibrate thresholds from how the healthy frames score against themselves.
    const scores = this.vectors.map((v) => rawScore(v, baseline).score).sort((a, b) => a - b);
    const p50 = quantile(scores, 0.5);
    const p99 = quantile(scores, 0.99);
    baseline.calib = {
      p50: round(p50, 1e3),
      p99: round(p99, 1e3),
      warn: round(Math.max(p99 * 1.6, 2.2), 1e3),
      alarm: round(Math.max(p99 * 2.8, 3.8), 1e3),
    };
    return baseline;
  }
}

function rawScore(vec, baseline) {
  const z = vec.map((x, d) => {
    if (!Number.isFinite(x) || !Number.isFinite(baseline.mu[d])) return 0;
    return (x - baseline.mu[d]) / baseline.sd[d];
  });
  let num = 0, den = 0;
  for (let d = 0; d < z.length; d++) {
    if (!Number.isFinite(vec[d]) || !Number.isFinite(baseline.mu[d])) continue;
    let zz = z[d];
    if (d < SCALARS.length && SCALARS[d].oneSided) zz = Math.max(0, zz);
    const w = d < SCALARS.length ? SCALARS[d].weight : 1;
    num += w * zz * zz;
    den += w;
  }
  return { score: den > 0 ? Math.sqrt(num / den) : 0, z };
}

/** Map an anomaly score to a 0..100 health index and a status. */
export function healthOf(score, calib) {
  const { p50, warn, alarm } = calib;
  let h;
  if (score <= p50) h = 100;
  else if (score <= warn) h = 100 - (30 * (score - p50)) / (warn - p50);
  else if (score <= alarm) h = 70 - (30 * (score - warn)) / (alarm - warn);
  else h = Math.max(0, 40 - (40 * (score - alarm)) / alarm);
  const status = score >= alarm ? 'alarm' : score >= warn ? 'watch' : 'healthy';
  return { health: Math.round(h), status };
}

/** Score one analysed frame against a baseline. */
export function scoreFrame(f, baseline) {
  const { score, z } = rawScore(vectorOf(f), baseline);
  return {
    score,
    zScalar: Object.fromEntries(SCALARS.map((s, i) => [s.key, z[i]])),
    zBands: z.slice(SCALARS.length),
    ...healthOf(score, baseline.calib),
  };
}

/** Running average of spectra/envelopes/features for a monitoring window, so diagnosis is not done on one noisy frame. */
export class Accumulator {
  constructor(size = 30) { this.size = size; this.items = []; }
  push(f) { this.items.push(f); if (this.items.length > this.size) this.items.shift(); }
  clear() { this.items = []; }
  get count() { return this.items.length; }
  average() {
    const it = this.items;
    if (!it.length) return null;
    const avgArr = (key) => {
      const out = new Float64Array(it[0][key].length);
      for (const f of it) for (let k = 0; k < out.length; k++) out[k] += f[key][k] / it.length;
      return out;
    };
    const avg = { spectrum: avgArr('spectrum'), envelope: avgArr('envelope'), bandDb: avgArr('bandDb') };
    for (const s of SCALARS) avg[s.key] = mean(it.map((f) => f[s.key]));
    avg.centroidHz = avg.centroidKHz * 1000;
    return avg;
  }
}

const dB = (a, b) => 20 * Math.log10((a + 1e-12) / (b + 1e-12));

/**
 * Explainable rule-based diagnosis.
 * avg: averaged analysis from Accumulator; scored: scoreFrame(avg, baseline);
 * machine: { rpm, lineHz, bearing: { balls, ballDiam, pitchDiam, angleDeg } }.
 * Returns findings sorted by severity, each with evidence and an action.
 */
export function diagnose(avg, scored, baseline, ctx, machine = {}) {
  const findings = [];
  const { sr, n } = ctx;
  const bsr = baseline.sr, bn = baseline.n;
  const zs = scored.zScalar;
  const zb = scored.zBands;
  const fr = machine.rpm > 0 ? machine.rpm / 60 : 0;
  const tol = Math.max(1.5 * (sr / n), fr * 0.03);
  const add = (severity, title, evidence, action, code) => findings.push({ severity, title, evidence, action, code });

  // Running speed orders
  const orders = {};
  if (fr > 0) {
    for (const h of [1, 2, 3, 4, 5, 6]) {
      const now = peakNear(avg.spectrum, sr, n, h * fr, tol).value;
      let base = 0;
      for (let d = -tol; d <= tol; d += sr / n / 2) base = Math.max(base, valueAtHz(baseline.spectrum, bsr, bn, h * fr + d));
      orders[h] = { now, base, rise: dB(now, base) };
    }
    const o = orders;
    if (o[1].rise > 6 && o[1].rise > o[2].rise + 2) {
      add(o[1].rise > 12 ? 3 : 2, 'Imbalance suspected',
        `1x running speed (${fr.toFixed(1)} Hz) is up ${o[1].rise.toFixed(1)} dB on baseline while 2x is up ${o[2].rise.toFixed(1)} dB.`,
        'Check for material build-up on fan/impeller, missing balance weights, or a damaged blade. Schedule a balance check.', 'imbalance');
    }
    // Looseness: a "picket fence" of raised harmonics. Misalignment raises mainly 2x (and some 3x),
    // so check looseness first and only call misalignment if 2x stands out above the fence.
    const high = [3, 4, 5, 6];
    const highOrders = high.filter((h) => o[h].rise > 6).length;
    const fence = mean(high.map((h) => o[h].rise));
    const loose = highOrders >= 3;
    if (loose) {
      add(fence > 12 ? 3 : 2, 'Mechanical looseness suspected',
        `${highOrders} of the 3x to 6x running speed harmonics are up more than 6 dB (average ${fence.toFixed(1)} dB), a harmonic "picket fence".`,
        'Check hold-down bolts, base and pedestal cracks, bearing housing fit. Torque and re-inspect.', 'looseness');
    }
    if (o[2].rise > 6 && o[2].rise >= o[1].rise) {
      // With a harmonic fence present, looseness also lifts 2x, so misalignment is only a secondary possibility.
      const sev = loose ? 1 : o[2].rise > 12 ? 3 : 2;
      add(sev, loose ? 'Possible misalignment (secondary)' : 'Misalignment suspected',
        `2x running speed (${(2 * fr).toFixed(1)} Hz) is up ${o[2].rise.toFixed(1)} dB (1x: ${o[1].rise.toFixed(1)} dB, 3x: ${o[3].rise.toFixed(1)} dB).${loose ? ' Looseness also raises 2x, so fix looseness first and re-measure.' : ''}`,
        'Check coupling alignment and soft foot. Laser or dial-indicator alignment if confirmed.', 'misalignment');
    }
  }

  // Electrical: 2x line frequency
  const lineHz = machine.lineHz || 50;
  {
    const f2 = 2 * lineHz;
    const etol = 2 * (sr / n);
    const now = peakNear(avg.spectrum, sr, n, f2, etol).value;
    let base = 0;
    for (let d = -etol; d <= etol; d += sr / n / 2) base = Math.max(base, valueAtHz(baseline.spectrum, bsr, bn, f2 + d));
    const rise = dB(now, base);
    if (rise > 8) {
      add(rise > 14 ? 3 : 2, 'Electrical fault signature',
        `2x line frequency (${f2} Hz) is up ${rise.toFixed(1)} dB on baseline.`,
        'Possible stator eccentricity, loose windings, soft foot or supply imbalance. Check phase currents and voltage balance; thermal scan the motor.', 'electrical');
    }
  }

  // Bearing defect frequencies in the envelope spectrum
  const bf = fr > 0 && machine.bearing ? bearingFrequencies({ rpm: machine.rpm, ...machine.bearing }) : null;
  let bearingHit = false;
  if (bf) {
    const names = { BPFO: 'Outer race', BPFI: 'Inner race', BSF: 'Rolling element', FTF: 'Cage' };
    const cands = [];
    for (const key of ['BPFO', 'BPFI', 'BSF', 'FTF']) {
      // A damaged rolling element strikes the inner and the outer race once per spin revolution,
      // so its impacts repeat at 2x BSF; that is where its envelope peak usually is.
      const hz = key === 'BSF' ? 2 * bf.BSF : bf[key];
      if (hz < 5) continue;
      const etol = Math.max(1.5 * (sr / n), hz * 0.02);
      const p1 = peakNear(avg.envelope, sr, n, hz, etol);
      const floor1 = localFloor(avg.envelope, sr, n, hz, 45, etol + 2);
      let base1 = 0;
      for (let d = -etol; d <= etol; d += sr / n / 2) base1 = Math.max(base1, valueAtHz(baseline.envelope, bsr, bn, hz + d));
      const p2 = peakNear(avg.envelope, sr, n, 2 * hz, etol * 2);
      const floor2 = localFloor(avg.envelope, sr, n, 2 * hz, 45, 2 * etol + 2);
      const snr = p1.value / (floor1 + 1e-12);
      const growth = p1.value / (base1 + 1e-12);
      if (snr > 4 && growth > 2.5) {
        cands.push({ key, hz, etol, peakHz: p1.hz, snr, growth, harmonic: p2.value / (floor2 + 1e-12) > 2.5 });
      }
    }
    // Arbitration: the strongest candidate is the primary defect. Cage-rate (FTF) sidebands around it,
    // and the FTF line itself when a rolling element is damaged (the cage carries the ball through the
    // load zone), are evidence for the primary defect rather than separate faults.
    cands.sort((a, b) => b.snr - a.snr);
    const primary = cands[0];
    const isSideband = (c) => primary && c !== primary &&
      [1, 2, 3].some((k) => [-1, 1].some((sgn) => Math.abs(c.peakHz - (primary.peakHz + sgn * k * bf.FTF)) <= c.etol + sr / n));
    const kept = [], folded = [];
    for (const c of cands) {
      if (c === primary) kept.push(c);
      else if ((primary.key === 'BSF' && c.key === 'FTF') || isSideband(c) || c.snr < 0.5 * primary.snr) folded.push(c);
      else kept.push(c);
    }
    for (const c of kept) {
      bearingHit = true;
      const sev = c.snr > 10 && c.harmonic ? 3 : 2;
      const label = c.key === 'BSF' ? '2x BSF' : c.key;
      const extra = c === primary && folded.length
        ? ` Related peaks at ${folded.map((f) => `${f.peakHz.toFixed(1)} Hz`).join(', ')} are consistent with cage-rate (FTF ${bf.FTF.toFixed(1)} Hz) modulation of this defect.`
        : '';
      add(sev, `${names[c.key]} bearing defect signature`,
        `Envelope spectrum shows a peak at ${c.peakHz.toFixed(1)} Hz matching ${label} (${c.hz.toFixed(1)} Hz), ${c.snr.toFixed(1)}x above the local floor and ${c.growth.toFixed(1)}x baseline${c.harmonic ? ', with a 2x harmonic' : ''}.${extra}`,
        c.key === 'FTF'
          ? 'Cage problems often follow lubrication failure. Check grease condition and plan replacement.'
          : 'Plan bearing replacement at the next stop. Check lubrication now; increase monitoring to daily.', `bearing_${c.key}`);
    }
  }
  // Repetitive impacts without known bearing geometry (or not matching it)
  if (!bearingHit) {
    const peaks = topPeaks(avg.envelope, sr, n, { count: 3, minHz: 8, maxHz: 600 });
    for (const p of peaks) {
      const floor = localFloor(avg.envelope, sr, n, p.hz, 45, 6);
      const base = valueAtHz(baseline.envelope, bsr, bn, p.hz);
      if (p.value / (floor + 1e-12) > 5 && p.value / (base + 1e-12) > 3) {
        const ord = fr > 0 ? ` (${(p.hz / fr).toFixed(2)}x running speed)` : '';
        const nonInt = fr > 0 && Math.abs(p.hz / fr - Math.round(p.hz / fr)) > 0.15;
        add(2, 'Repetitive impacts detected',
          `Envelope spectrum peak at ${p.hz.toFixed(1)} Hz${ord}, ${(p.value / (floor + 1e-12)).toFixed(1)}x the local floor.${nonInt ? ' A non-integer order is typical of rolling element bearing defects.' : ''}`,
          machine.bearing ? 'Verify bearing type and speed entered for this machine; then inspect bearings and gears.' : 'Enter the bearing type and speed for this machine so the defect can be pinned to outer race, inner race, ball or cage.', 'impacts');
        break;
      }
    }
  }

  // Impulsiveness (overall or in the high band, where impacts ring)
  const kz = Math.max(zs.kurtosis, zs.hfKurtosis);
  if (kz > 4 && Math.max(avg.kurtosis, avg.hfKurtosis) > 3.8 && !bearingHit && zs.flatness < 3) {
    add(kz > 8 ? 3 : 2, 'Impulsive content rising',
      `High-band kurtosis is ${avg.hfKurtosis.toFixed(2)} (baseline about ${baseline.mu[5].toFixed(2)}), overall kurtosis ${avg.kurtosis.toFixed(2)}. Random machine noise sits near 3; repetitive impacts push it up.`,
      'Typical of early bearing damage, a cracked or chipped gear tooth, or rubbing. Listen at each bearing; check gearbox oil for metal.', 'impulsive');
  }

  // High-frequency energy rise (bands above 2 kHz)
  const hiIdx = baseline.bandFc.map((fc, i) => (fc >= 2000 ? i : -1)).filter((i) => i >= 0);
  const hiZ = hiIdx.length ? mean(hiIdx.map((i) => zb[i])) : 0;
  const loIdx = baseline.bandFc.map((fc, i) => (fc < 2000 ? i : -1)).filter((i) => i >= 0);
  const loZ = loIdx.length ? mean(loIdx.map((i) => zb[i])) : 0;

  if (zs.flatness > 3 && hiZ > 2.5) {
    add(hiZ > 6 ? 3 : 2, 'Cavitation or flow turbulence',
      `Broadband high-frequency noise is up (bands above 2 kHz average ${hiZ.toFixed(1)} sigma) and the spectrum is ${zs.flatness.toFixed(1)} sigma flatter than baseline.`,
      'For pumps: check suction pressure, strainer blockage, and NPSH margin; confirm the pump is not running far off its best efficiency point.', 'cavitation');
  } else if (hiZ > 3 && !bearingHit && hiZ > loZ + 1.5) {
    add(2, 'High-frequency energy rise',
      `Bands above 2 kHz average ${hiZ.toFixed(1)} sigma above baseline while lower bands average ${loZ.toFixed(1)} sigma.`,
      'Often the earliest sign of bearing wear or lubrication starvation. Re-grease per schedule and re-measure in 24 hours.', 'hf');
  }

  // Overall level change with unchanged shape: likely an operating condition, not a fault
  if (Math.abs(zs.rmsDb) > 4 && !findings.length) {
    const up = zs.rmsDb > 0;
    add(1, `Overall level ${up ? 'up' : 'down'}, spectrum shape similar`,
      `Overall level changed by ${(avg.rmsDb - baseline.mu[0]).toFixed(1)} dB but no specific fault pattern stands out.`,
      'Before concluding a fault: confirm the machine is at its usual speed and load, and the phone is at the marked measuring point and distance.', 'level');
  }

  if (!findings.length && scored.status !== 'healthy') {
    // Name the bands that moved most so the user knows where to look
    const ranked = zb.map((z, i) => ({ z, fc: baseline.bandFc[i] })).sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, 3);
    add(1, 'Sound signature has changed',
      `Largest changes around ${ranked.map((r) => `${r.fc >= 1000 ? (r.fc / 1000).toFixed(1) + ' kHz' : r.fc + ' Hz'} (${r.z > 0 ? '+' : ''}${r.z.toFixed(1)} sigma)`).join(', ')}.`,
      'No known pattern matched. Re-measure at the same point. If it persists, inspect the machine and add a note so future readings can learn from it.', 'unknown');
  }

  findings.sort((a, b) => b.severity - a.severity);
  return { findings, orders, bearing: bf };
}

/**
 * One call for the UI: score the averaged window, diagnose it, and combine both.
 * Specific diagnostic evidence (for example a bearing defect frequency in the
 * envelope) overrides a still-healthy statistical score, because a named fault
 * pattern is stronger evidence than a general drift: that is the early warning.
 */
export function assess(avg, baseline, ctx, machine) {
  const scored = scoreFrame(avg, baseline);
  const dx = diagnose(avg, scored, baseline, ctx, machine);
  const worst = dx.findings.reduce((m, f) => Math.max(m, f.severity), 0);
  let { health, status } = scored;
  if (worst >= 3) { status = 'alarm'; health = Math.min(health, 39); }
  else if (worst >= 2 && status === 'healthy') { status = 'watch'; health = Math.min(health, 69); }
  return { ...scored, health, status, statScore: scored.score, findings: dx.findings, orders: dx.orders, bearing: dx.bearing };
}
