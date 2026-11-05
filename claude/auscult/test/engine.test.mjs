// Run with: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fft, ifft, amplitudeSpectrum, extractFeatures, makeBands, bearingFrequencies, envelopeSpectrum, peakNear, localFloor } from '../js/dsp.js';
import { MachineSim, BEARINGS, rng } from '../js/synth.js';
import { makeContext, analyzeFrame, BaselineBuilder, scoreFrame, Accumulator, diagnose, assess, FRAME } from '../js/model.js';

const SR = 48000;

function sine(n, hz, amp = 1, sr = SR) {
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = amp * Math.sin((2 * Math.PI * hz * i) / sr);
  return x;
}

test('FFT then IFFT returns the original signal', () => {
  const r = rng(3);
  const n = 1024;
  const re = Float64Array.from({ length: n }, () => r() - 0.5);
  const orig = re.slice();
  const im = new Float64Array(n);
  fft(re, im);
  ifft(re, im);
  for (let i = 0; i < n; i++) assert.ok(Math.abs(re[i] - orig[i]) < 1e-9);
});

test('amplitude spectrum reports sine amplitude and frequency', () => {
  const n = FRAME;
  const hz = 1000;
  const mag = amplitudeSpectrum(sine(n, hz, 0.5));
  const p = peakNear(mag, SR, n, hz, 20);
  assert.ok(Math.abs(p.hz - hz) < SR / n, `peak at ${p.hz}`);
  assert.ok(Math.abs(p.value - 0.5) < 0.05, `amplitude ${p.value}`);
});

test('kurtosis: sine about 1.5, gaussian about 3, impulses much higher', () => {
  const bands = makeBands(SR, FRAME);
  const s = extractFeatures(sine(FRAME, 440), SR, bands);
  assert.ok(Math.abs(s.kurtosis - 1.5) < 0.05, `sine kurtosis ${s.kurtosis}`);

  const r = rng(9);
  const g = new Float64Array(FRAME);
  for (let i = 0; i < FRAME; i++) {
    const u = Math.max(1e-12, r()), v = r();
    g[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const gf = extractFeatures(g, SR, bands);
  assert.ok(Math.abs(gf.kurtosis - 3) < 0.3, `gaussian kurtosis ${gf.kurtosis}`);

  const imp = g.map((x) => x * 0.1);
  for (let i = 0; i < FRAME; i += 500) imp[i] += 3;
  assert.ok(extractFeatures(imp, SR, bands).kurtosis > 10);
});

test('band energies of the same physical sound agree across sample rates (48 vs 44.1 kHz)', () => {
  // Constant noise PSD per Hz plus a tone: what a microphone sees regardless of the device's rate.
  const S = 1e-7, n = FRAME, T = 12;
  const run = (sr) => {
    const r = rng(4), bands = makeBands(sr, n), acc = new Float64Array(bands.length);
    const sigma = Math.sqrt((S * sr) / 2);
    for (let t = 0; t < T; t++) {
      const x = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const u = Math.max(1e-12, r()), v = r();
        x[i] = 0.1 * Math.sin((2 * Math.PI * 1000 * (i + t * n)) / sr) + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      }
      const f = extractFeatures(x, sr, bands);
      for (let b = 0; b < bands.length; b++) acc[b] += f.bandDb[b] / T;
    }
    return { bands, acc };
  };
  const a = run(48000), b = run(44100);
  for (const hz of [300, 1000, 3000, 6000]) {
    const ia = a.bands.findIndex((B) => B.fLo <= hz && B.fHi > hz);
    const ib = b.bands.findIndex((B) => B.fLo <= hz && B.fHi > hz);
    assert.ok(Math.abs(a.acc[ia] - b.acc[ib]) < 0.5, `${hz} Hz band differs by ${(a.acc[ia] - b.acc[ib]).toFixed(2)} dB`);
  }
});

test('envelope analysis never doubles the Nyquist bin, even when the band reaches sr/2', async () => {
  const { envelopeAnalysis } = await import('../js/dsp.js');
  const sr = 16000, n = 1024;
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = i % 2 ? -1 : 1; // pure Nyquist tone
  const res = envelopeAnalysis(x, sr, 1500, 8000);
  assert.ok(res.levelDb < -100, `Nyquist energy leaked into the band: ${res.levelDb.toFixed(1)} dB`);
});

test('spectral centroid tracks a pure tone', () => {
  const f = extractFeatures(sine(FRAME, 3000), SR, makeBands(SR, FRAME));
  assert.ok(Math.abs(f.centroidHz - 3000) < 50, `centroid ${f.centroidHz}`);
});

test('bearing defect frequencies for a 6205 at 1480 rpm', () => {
  const bf = bearingFrequencies({ rpm: 1480, ...BEARINGS['6205'] });
  // Reference: BPFO = 3.58 x fr, BPFI = 5.42 x fr for a 6205
  assert.ok(Math.abs(bf.BPFO / bf.fr - 3.585) < 0.02, `BPFO order ${bf.BPFO / bf.fr}`);
  assert.ok(Math.abs(bf.BPFI / bf.fr - 5.415) < 0.02, `BPFI order ${bf.BPFI / bf.fr}`);
  assert.ok(bf.FTF < bf.fr / 2);
});

test('envelope spectrum exposes impact repetition rate', () => {
  const n = FRAME;
  const x = new Float64Array(n);
  const r = rng(5);
  const rate = 87;
  // carrier at 4 kHz, bursts every 1/87 s, plus noise
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const phase = (t * rate) % 1;
    x[i] = Math.exp(-phase * 60) * Math.sin(2 * Math.PI * 4000 * t) + 0.2 * (r() - 0.5);
  }
  const env = envelopeSpectrum(x, SR, 1500, 8000);
  const p = peakNear(env, SR, n, rate, 6);
  const floor = localFloor(env, SR, n, rate, 45, 10);
  assert.ok(p.value / floor > 5, `envelope SNR ${p.value / floor}`);
});

// ---- End-to-end engine tests on the machine simulator ----

const MACHINE = { rpm: 1480, lineHz: 50, bearing: BEARINGS['6205'] };

function frames(sim, count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(sim.render(FRAME));
  return out;
}

function learn(seed = 1) {
  const ctx = makeContext(SR);
  const sim = new MachineSim({ sr: SR, ...MACHINE, seed });
  const bb = new BaselineBuilder(ctx);
  for (const fr of frames(sim, 60)) bb.add(analyzeFrame(fr, ctx));
  return { ctx, baseline: bb.build() };
}

const { ctx, baseline } = learn(1);

function monitor(fault, severity, seed = 42, count = 30) {
  const sim = new MachineSim({ sr: SR, ...MACHINE, seed });
  sim.setFault(fault, severity);
  const acc = new Accumulator(count);
  const statuses = [];
  for (const fr of frames(sim, count)) {
    const a = analyzeFrame(fr, ctx);
    acc.push(a);
    statuses.push(scoreFrame(a, baseline).status);
  }
  const avg = acc.average();
  const scored = scoreFrame(avg, baseline);
  const dx = diagnose(avg, scored, baseline, ctx, MACHINE);
  return { statuses, scored, dx };
}

test('baseline has sane calibration', () => {
  const c = baseline.calib;
  assert.ok(c.p50 > 0 && c.p50 < c.warn && c.warn < c.alarm, JSON.stringify(c));
});

test('a different healthy run of the same machine stays healthy', () => {
  const { statuses, dx } = monitor('none', 0, 99, 40);
  const healthy = statuses.filter((s) => s === 'healthy').length / statuses.length;
  assert.ok(healthy >= 0.9, `only ${(healthy * 100).toFixed(0)}% frames healthy: ${statuses.join(',')}`);
  const serious = dx.findings.filter((f) => f.severity >= 2);
  assert.equal(serious.length, 0, `false alarms: ${serious.map((f) => f.title).join('; ')}`);
});

const CASES = [
  ['imbalance', ['imbalance']],
  ['misalignment', ['misalignment']],
  ['looseness', ['looseness']],
  ['bearing_outer', ['bearing_BPFO']],
  ['bearing_inner', ['bearing_BPFI']],
  ['bearing_ball', ['bearing_BSF']],
  ['cavitation', ['cavitation']],
  ['electrical', ['electrical']],
];

for (const [fault, expected] of CASES) {
  test(`detects and names ${fault}`, () => {
    const { statuses, scored, dx } = monitor(fault, 0.7);
    const flagged = statuses.filter((s) => s !== 'healthy').length / statuses.length;
    assert.ok(flagged >= 0.8, `${fault}: only ${(flagged * 100).toFixed(0)}% frames flagged (score ${scored.score.toFixed(2)})`);
    const codes = dx.findings.map((f) => f.code);
    assert.ok(expected.includes(codes[0]) || codes.slice(0, 2).some((c) => expected.includes(c)),
      `${fault}: expected ${expected} near the top, got ${dx.findings.map((f) => `${f.code}(${f.severity})`).join(', ')}`);
  });
}

test('mild faults degrade health less than severe ones', () => {
  const mild = monitor('bearing_outer', 0.25).scored;
  const severe = monitor('bearing_outer', 0.9).scored;
  assert.ok(severe.health < mild.health, `mild ${mild.health} vs severe ${severe.health}`);
});

test('early warning: a mild outer race defect is named before the overall score alarms', () => {
  const sim = new MachineSim({ sr: SR, ...MACHINE, seed: 77 });
  sim.setFault('bearing_outer', 0.3);
  const acc = new Accumulator(30);
  for (const fr of frames(sim, 30)) acc.push(analyzeFrame(fr, ctx));
  const a = assess(acc.average(), baseline, ctx, MACHINE);
  assert.notEqual(a.status, 'healthy', `status ${a.status}`);
  assert.equal(a.findings[0].code, 'bearing_BPFO');
});

test('looseness is not mislabelled as misalignment', () => {
  const { dx } = monitor('looseness', 0.7);
  assert.equal(dx.findings[0].code, 'looseness', dx.findings.map((f) => f.code).join(','));
});

test('rolling element defect is found at 2x BSF and its cage sidebands are not reported as other faults', () => {
  for (const seed of [6, 7]) {
    const sim = new MachineSim({ sr: SR, ...MACHINE, seed });
    sim.setFault('bearing_ball', 0.7);
    const acc = new Accumulator(30);
    for (const fr of frames(sim, 30)) acc.push(analyzeFrame(fr, ctx));
    const a = assess(acc.average(), baseline, ctx, MACHINE);
    const bearingCodes = a.findings.map((f) => f.code).filter((c) => c.startsWith('bearing_'));
    assert.deepEqual(bearingCodes, ['bearing_BSF'], `seed ${seed}: ${bearingCodes.join(',')}`);
  }
});

test('16 kHz devices: invalid bands survive a save/reload and faults are still named', () => {
  const sr = 16000, c = makeContext(sr);
  assert.ok(c.bands.some((b) => b.valid === false), 'expected bands above Nyquist to be marked invalid');
  const s = new MachineSim({ sr, ...MACHINE, seed: 1 });
  const bb = new BaselineBuilder(c);
  for (let i = 0; i < 60; i++) bb.add(analyzeFrame(s.render(FRAME), c));
  const reloaded = JSON.parse(JSON.stringify(bb.build())); // NaN becomes null in JSON
  const mon = (fault, sev) => {
    const sim = new MachineSim({ sr, ...MACHINE, seed: 9 });
    sim.setFault(fault, sev);
    const acc = new Accumulator(30);
    for (let i = 0; i < 30; i++) acc.push(analyzeFrame(sim.render(FRAME), c));
    return assess(acc.average(), reloaded, c, MACHINE);
  };
  const healthy = mon('none', 0);
  assert.equal(healthy.status, 'healthy');
  assert.ok(Number.isFinite(healthy.score));
  assert.equal(mon('bearing_outer', 0.7).findings[0].code, 'bearing_BPFO');
});

test('a 48 kHz baseline monitored on a 16 kHz device: no false alarm, faults still caught', () => {
  const reloaded = JSON.parse(JSON.stringify(baseline));
  const sr = 16000, c = makeContext(sr);
  const mon = (fault, sev) => {
    const sim = new MachineSim({ sr, ...MACHINE, seed: 9 });
    sim.setFault(fault, sev);
    const acc = new Accumulator(30);
    for (let i = 0; i < 30; i++) acc.push(analyzeFrame(sim.render(FRAME), c));
    return assess(acc.average(), reloaded, c, MACHINE);
  };
  assert.equal(mon('none', 0).status, 'healthy');
  assert.equal(mon('bearing_outer', 0.7).findings[0].code, 'bearing_BPFO');
});

// Independent fixtures from Codex's review (coordination/reviews/CODEX.md), kept verbatim in spirit.
const pureSine = (sr, hz, a) => Float64Array.from({ length: FRAME }, (_, i) => a * Math.sin((2 * Math.PI * hz * i) / sr));

test('Codex fixture 1: an identical frame never alarms (111.328125 Hz, lineHz 50)', () => {
  const c = makeContext(48000);
  const f = analyzeFrame(pureSine(48000, 111.328125, 0.05), c);
  const bb = new BaselineBuilder(c);
  for (let i = 0; i < 20; i++) bb.add(f);
  const base = JSON.parse(JSON.stringify(bb.build()));
  for (const m of [{ lineHz: 50 }, { lineHz: 50, rpm: 3340 }, { lineHz: 50, ...MACHINE }]) {
    const a = assess(f, base, c, m);
    assert.equal(a.status, 'healthy', `${JSON.stringify(m)}: ${a.findings.map((x) => x.evidence).join(' | ')}`);
    assert.equal(a.findings.length, 0);
  }
});

test('Codex fixture 2: the same 3 kHz tone scores as unchanged at 48 and 16 kHz', () => {
  const c48 = makeContext(48000), c16 = makeContext(16000);
  const f48 = analyzeFrame(pureSine(48000, 3000, 0.05), c48);
  const bb = new BaselineBuilder(c48);
  for (let i = 0; i < 20; i++) bb.add(f48);
  const base = bb.build();
  const f16 = analyzeFrame(pureSine(16000, 3000, 0.05), c16);
  const idx = (c) => c.bands.findIndex((b) => b.fLo <= 3000 && b.fHi > 3000);
  assert.equal(idx(c48), idx(c16), 'tone must fall in the same band index at both rates');
  const s = scoreFrame(f16, base);
  assert.ok(s.score < base.calib.warn, `score ${s.score.toFixed(2)} should be below warn ${base.calib.warn}`);
});

test('baseline is JSON serialisable and survives a round trip', () => {
  const copy = JSON.parse(JSON.stringify(baseline));
  const sim = new MachineSim({ sr: SR, ...MACHINE, seed: 5 });
  const a = analyzeFrame(sim.render(FRAME), ctx);
  assert.equal(scoreFrame(a, copy).score.toFixed(6), scoreFrame(a, baseline).score.toFixed(6));
  assert.ok(JSON.stringify(baseline).length < 200000, 'baseline should fit comfortably in local storage');
});
