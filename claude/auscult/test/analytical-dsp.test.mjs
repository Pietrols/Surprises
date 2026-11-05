// Independent analytical DSP & mathematical verification fixtures contributed by OpenCode.
// Does not rely on MachineSim; uses closed-form mathematical signals to test DSP invariants.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  hann,
  fft,
  ifft,
  amplitudeSpectrum,
  extractFeatures,
  makeBands,
  envelopeAnalysis,
  bearingFrequencies,
  peakNear,
  valueAtHz,
} from '../js/dsp.js';
import { BEARINGS } from '../js/synth.js';

const SR = 48000;
const N = 8192;

test('Parseval energy theorem holds exactly for radix-2 FFT', () => {
  const n = 2048;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  let timeEnergy = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.sin(0.07 * i) + 0.4 * Math.cos(0.31 * i) - 0.25 * ((i % 17) - 8);
    re[i] = x;
    timeEnergy += x * x;
  }
  fft(re, im);
  let freqEnergy = 0;
  for (let k = 0; k < n; k++) {
    freqEnergy += re[k] * re[k] + im[k] * im[k];
  }
  freqEnergy /= n;
  assert.ok(Math.abs(timeEnergy - freqEnergy) / timeEnergy < 1e-12, `Parseval mismatch: ${timeEnergy} vs ${freqEnergy}`);
});

test('FFT linearity: FFT(a*x + b*y) == a*FFT(x) + b*FFT(y)', () => {
  const n = 1024;
  const xRe = new Float64Array(n), xIm = new Float64Array(n);
  const yRe = new Float64Array(n), yIm = new Float64Array(n);
  const zRe = new Float64Array(n), zIm = new Float64Array(n);
  const a = 2.35, b = -1.7;
  for (let i = 0; i < n; i++) {
    xRe[i] = Math.cos((2 * Math.PI * 19 * i) / n);
    yRe[i] = Math.sin((2 * Math.PI * 73 * i) / n);
    zRe[i] = a * xRe[i] + b * yRe[i];
  }
  fft(xRe, xIm);
  fft(yRe, yIm);
  fft(zRe, zIm);
  for (let k = 0; k < n; k++) {
    assert.ok(Math.abs(zRe[k] - (a * xRe[k] + b * yRe[k])) < 1e-9);
    assert.ok(Math.abs(zIm[k] - (a * xIm[k] + b * yIm[k])) < 1e-9);
  }
});

test('Hann window scallop loss between bins is bounded by theoretical 1.42 dB', () => {
  // Worst-case frequency sits exactly half-way between two FFT bins: k + 0.5
  const kBin = 140;
  const fExactBin = (kBin * SR) / N;
  const fHalfBin = ((kBin + 0.5) * SR) / N;

  const sExact = new Float64Array(N);
  const sHalf = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    sExact[i] = Math.sin((2 * Math.PI * fExactBin * i) / SR);
    sHalf[i] = Math.sin((2 * Math.PI * fHalfBin * i) / SR);
  }

  const magExact = amplitudeSpectrum(sExact);
  const magHalf = amplitudeSpectrum(sHalf);

  const pExact = peakNear(magExact, SR, N, fExactBin, 10).value;
  const pHalf = peakNear(magHalf, SR, N, fHalfBin, 10).value;

  assert.ok(Math.abs(pExact - 1.0) < 1e-3, `on-bin amplitude should be 1.0, got ${pExact}`);
  const lossDb = -20 * Math.log10(pHalf / pExact);
  // Hann window theoretical max scallop loss is ~1.423 dB (amplitude ~0.849)
  assert.ok(lossDb > 1.35 && lossDb < 1.46, `expected ~1.42 dB scallop loss, got ${lossDb.toFixed(3)} dB`);
});

test('Hilbert envelope demodulates exact analytical sinusoid AM modulation at f_m', () => {
  // x(t) = (1 + m * cos(2*pi*f_m*t)) * cos(2*pi*f_c*t)
  // Analytic envelope is 1 + m * cos(2*pi*f_m*t); after DC removal, peak at f_m has amplitude m.
  const fc = 4000;
  const fm = 117.1875; // exact integer bin: 20 * 48000 / 8192 = 117.1875 Hz
  const m = 0.45;
  const x = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    x[i] = (1 + m * Math.cos(2 * Math.PI * fm * t)) * Math.cos(2 * Math.PI * fc * t);
  }
  const env = envelopeAnalysis(x, SR, 1500, 8000);
  const p = peakNear(env.spectrum, SR, N, fm, 6);
  assert.ok(Math.abs(p.hz - fm) < 1e-6, `expected peak at ${fm} Hz, got ${p.hz}`);
  assert.ok(Math.abs(p.value - m) < 0.02, `expected envelope modulation amplitude ${m}, got ${p.value}`);
});

test('bearing kinematic identity: BPFO + BPFI == balls * fr for all presets and contact angles', () => {
  for (const [name, geom] of Object.entries(BEARINGS)) {
    for (const angleDeg of [0, 15, 25]) {
      const bf = bearingFrequencies({ rpm: 1750, ...geom, angleDeg });
      assert.ok(bf, `bearing ${name} valid`);
      assert.ok(
        Math.abs(bf.BPFO + bf.BPFI - geom.balls * bf.fr) < 1e-12,
        `${name} at ${angleDeg} deg violated BPFO + BPFI = Z * fr`
      );
      assert.ok(
        Math.abs(bf.FTF / bf.fr - bf.BPFO / (geom.balls * bf.fr)) < 1e-12,
        `${name} violated BPFO = Z * FTF`
      );
    }
  }
});

test('spectral flatness is ~0 for pure sinusoid and approaches 1 for flat spectrum', () => {
  const bands = makeBands(SR, N);
  const pure = new Float64Array(N);
  for (let i = 0; i < N; i++) pure[i] = Math.sin((2 * Math.PI * 1000 * i) / SR);
  const fPure = extractFeatures(pure, SR, bands);
  assert.ok(fPure.flatness < 1e-4, `pure tone flatness should be ~0, got ${fPure.flatness}`);

  // Impulse at sample N/2 has flat magnitude spectrum across all bins
  const delta = new Float64Array(N);
  delta[N >> 1] = 1.0;
  const fDelta = extractFeatures(delta, SR, bands);
  assert.ok(fDelta.flatness > 0.99, `impulse flatness should be ~1, got ${fDelta.flatness}`);
});

test('valueAtHz linear interpolation is exact on linear ramps and out-of-bounds safe', () => {
  const n = 1000, sr = 1000; // 1 Hz per bin
  const arr = Float64Array.from({ length: 501 }, (_, k) => k * 2.5);
  assert.ok(Math.abs(valueAtHz(arr, sr, n, 100.4) - 251.0) < 1e-9);
  assert.equal(valueAtHz(arr, sr, n, -5), 0);
  assert.equal(valueAtHz(arr, sr, n, 900), 0);
});

test('identical sound at 111.328125 Hz never triggers a false electrical alarm (Codex fixture #1)', async () => {
  const { makeContext, analyzeFrame, BaselineBuilder, assess } = await import('../js/model.js');
  const ctx = makeContext(48000);
  const frame = new Float64Array(8192);
  for (let i = 0; i < 8192; i++) frame[i] = 0.05 * Math.sin((2 * Math.PI * 111.328125 * i) / 48000);
  const f = analyzeFrame(frame, ctx);
  const bb = new BaselineBuilder(ctx);
  for (let i = 0; i < 20; i++) bb.add(f);
  const baseline = bb.build();
  const res = assess(f, baseline, ctx, { lineHz: 50 });
  assert.equal(res.status, 'healthy', `expected healthy on identical frame, got ${res.status}: ${res.findings.map((x) => x.title).join(', ')}`);
  assert.equal(res.findings.length, 0);
});

test('makeBands keeps physical band frequencies aligned across 48 kHz and 16 kHz (Codex fixture #2)', () => {
  const b48 = makeBands(48000, 8192);
  const b16 = makeBands(16000, 8192);
  const idx48 = b48.findIndex((b) => b.valid && b.fLo <= 3000 && b.fHi > 3000);
  const idx16 = b16.findIndex((b) => b.valid && b.fLo <= 3000 && b.fHi > 3000);
  assert.equal(idx48, idx16, `3 kHz tone must land in the same band index at 48 kHz (${idx48}) and 16 kHz (${idx16})`);
  assert.equal(b16[23].valid, false, 'top bands above 8 kHz Nyquist at 16 kHz must be marked invalid rather than compressed');
});

