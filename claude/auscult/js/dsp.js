// dsp.js
// Pure signal processing. No browser APIs, so the same code runs in the app
// and in the Node test suite.

const windowCache = new Map();

/**
 * Absolute floor for level features (dBFS). Real microphones and 16-bit converters have noise floors
 * far above this; anything quieter is numerical leakage whose value depends on bin width, so it is
 * clamped to keep such meaningless differences out of the anomaly score.
 */
export const LEVEL_FLOOR_DB = -120;

/** Hann window of length n (cached). */
export function hann(n) {
  let w = windowCache.get(n);
  if (!w) {
    w = new Float64Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    windowCache.set(n, w);
  }
  return w;
}

/** In-place iterative radix-2 FFT. re and im must have the same power-of-two length. */
export function fft(re, im) {
  const n = re.length;
  if (n & (n - 1)) throw new Error(`FFT length must be a power of two, got ${n}`);
  // Bit reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  // Butterflies
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wlr = Math.cos(ang);
    const wli = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wr = 1, wi = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
        const nwr = wr * wlr - wi * wli;
        wi = wr * wli + wi * wlr;
        wr = nwr;
      }
    }
  }
}

/** In-place inverse FFT (scaled by 1/n). */
export function ifft(re, im) {
  const n = re.length;
  for (let i = 0; i < n; i++) im[i] = -im[i];
  fft(re, im);
  for (let i = 0; i < n; i++) { re[i] /= n; im[i] = -im[i] / n; }
}

/**
 * Single-sided amplitude spectrum of a real frame, Hann windowed and
 * amplitude-corrected so a sine of amplitude A shows a peak of about A.
 * Returns Float64Array of length n/2 + 1.
 */
export function amplitudeSpectrum(frame) {
  const n = frame.length;
  const w = hann(n);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  let wsum = 0;
  for (let i = 0; i < n; i++) { re[i] = frame[i] * w[i]; wsum += w[i]; }
  fft(re, im);
  const half = n >> 1;
  const mag = new Float64Array(half + 1);
  for (let k = 0; k <= half; k++) {
    const scale = (k === 0 || k === half) ? 1 : 2;
    mag[k] = (scale * Math.hypot(re[k], im[k])) / wsum;
  }
  return mag;
}

/** Frequency of bin k. */
export const binHz = (k, sr, n) => (k * sr) / n;
/** Nearest bin for a frequency. */
export const hzBin = (hz, sr, n) => Math.round((hz * n) / sr);

/**
 * Log-spaced band definitions as bin ranges [lo, hi) plus their centre Hz.
 * Bands are defined in Hz, so features stay comparable across sample rates.
 */
export function makeBands(sr, n, { count = 24, fmin = 20, fmax = 12000 } = {}) {
  const nyquist = sr / 2 - sr / n;
  const bands = [];
  let prevHi = Math.max(1, hzBin(fmin, sr, n));
  for (let i = 0; i < count; i++) {
    // Anchor band edges to fixed physical frequencies [fmin, fmax] regardless of sample rate
    // so band indices always represent the same physical Hz range across devices.
    const fHiTarget = fmin * Math.pow(fmax / fmin, (i + 1) / count);
    const fLoTarget = fmin * Math.pow(fmax / fmin, i / count);
    const valid = fLoTarget < nyquist;
    const clampedHiHz = Math.min(fHiTarget, nyquist);
    const lo = prevHi;
    const hi = valid ? Math.max(lo + 1, hzBin(clampedHiHz, sr, n)) : lo;
    const fLo = valid ? binHz(lo, sr, n) : fLoTarget;
    const fH = valid ? binHz(hi, sr, n) : fHiTarget;
    bands.push({ lo, hi, fLo, fHi: fH, fc: Math.sqrt(Math.max(fLoTarget, 1) * fHiTarget), valid });
    if (valid) prevHi = hi;
  }
  return bands;
}

/**
 * Extract the feature set for one frame.
 * Returns time-domain statistics, spectral shape descriptors and band energies (dB).
 */
export function extractFeatures(frame, sr, bands) {
  const n = frame.length;
  // Time domain
  let mean = 0;
  for (let i = 0; i < n; i++) mean += frame[i];
  mean /= n;
  let m2 = 0, m4 = 0, peak = 0;
  for (let i = 0; i < n; i++) {
    const d = frame[i] - mean;
    const d2 = d * d;
    m2 += d2; m4 += d2 * d2;
    const a = Math.abs(d);
    if (a > peak) peak = a;
  }
  m2 /= n; m4 /= n;
  const rms = Math.sqrt(m2);
  const rmsDb = Math.max(LEVEL_FLOOR_DB, 20 * Math.log10(rms + 1e-12));
  const crest = rms > 1e-9 ? peak / rms : 0;
  const kurtosis = m2 > 1e-18 ? m4 / (m2 * m2) : 0;

  // Frequency domain
  const spectrum = amplitudeSpectrum(frame);
  const kMin = Math.max(1, hzBin(10, sr, n));
  let pSum = 0, fpSum = 0, logSum = 0, count = 0, peakK = kMin, peakVal = 0;
  for (let k = kMin; k < spectrum.length - 1; k++) {
    const p = spectrum[k] * spectrum[k] + 1e-20;
    pSum += p;
    fpSum += p * binHz(k, sr, n);
    logSum += Math.log(p);
    count++;
    if (spectrum[k] > peakVal) { peakVal = spectrum[k]; peakK = k; }
  }
  const centroidHz = pSum > 0 ? fpSum / pSum : 0;
  const flatness = count > 0 ? Math.exp(logSum / count) / (pSum / count) : 0;

  const bandDb = new Float64Array(bands.length);
  for (let b = 0; b < bands.length; b++) {
    if (bands[b].valid === false) {
      bandDb[b] = NaN;
      continue;
    }
    let s = 0;
    for (let k = bands[b].lo; k < bands[b].hi && k < spectrum.length; k++) s += spectrum[k] * spectrum[k];
    bandDb[b] = Math.max(LEVEL_FLOOR_DB, 10 * Math.log10(s + 1e-20));
  }

  return {
    rms, rmsDb, crest, kurtosis, centroidHz, flatness,
    peakHz: binHz(peakK, sr, n),
    bandDb, spectrum,
  };
}

/**
 * Envelope (demodulated) spectrum. Keeps only [loHz, hiHz] of the signal,
 * forms the analytic signal (Hilbert transform via FFT), takes its magnitude
 * and returns the amplitude spectrum of that envelope. Repetitive impacts
 * from bearing defects excite high-frequency resonances; their repetition
 * rate shows up here as clean peaks even when invisible in the raw spectrum.
 */
export function envelopeSpectrum(frame, sr, loHz = 1500, hiHz = 8000) {
  return envelopeAnalysis(frame, sr, loHz, hiHz).spectrum;
}

/**
 * Band-pass + Hilbert analysis in one FFT pass.
 * Returns:
 *  spectrum: amplitude spectrum of the envelope
 *  kurtosis: kurtosis of the band-passed signal ("spectral kurtosis" of the band).
 *            About 3 for random noise, rises sharply with repetitive impacts.
 *  levelDb:  RMS level of the band-passed signal
 * No window is applied before the band-pass: the low-frequency machine tones that
 * would leak are hundreds of bins away, and windowing would distort the kurtosis.
 * 5% of each frame edge is ignored for the statistics to avoid wrap-around artefacts.
 */
export function envelopeAnalysis(frame, sr, loHz = 1500, hiHz = 8000) {
  const n = frame.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = frame[i];
  fft(re, im);
  const kLo = Math.max(1, hzBin(loHz, sr, n));
  // The Nyquist bin must not be doubled (it has no negative-frequency twin), so stop one bin short of it.
  const kHi = Math.min((n >> 1) - 1, hzBin(Math.min(hiHz, sr / 2), sr, n));
  re[0] = 0; im[0] = 0;
  for (let k = 1; k < n; k++) {
    if (k >= kLo && k <= kHi) { re[k] *= 2; im[k] *= 2; }
    else { re[k] = 0; im[k] = 0; }
  }
  ifft(re, im);
  // re is now the band-passed signal, |re + j im| its envelope
  const edge = Math.floor(n * 0.05);
  // Central moments over the interior: the band-passed signal has zero mean over the full frame,
  // but not exactly over a sub-interval, so subtract the interior mean.
  let mu = 0, cnt = n - 2 * edge;
  for (let i = edge; i < n - edge; i++) mu += re[i];
  mu /= cnt;
  let m2 = 0, m4 = 0;
  for (let i = edge; i < n - edge; i++) {
    const d = re[i] - mu, v2 = d * d;
    m2 += v2; m4 += v2 * v2;
  }
  m2 /= cnt; m4 /= cnt;
  const env = new Float64Array(n);
  let m = 0;
  for (let i = 0; i < n; i++) { env[i] = Math.hypot(re[i], im[i]); m += env[i]; }
  m /= n;
  for (let i = 0; i < n; i++) env[i] -= m;
  return {
    spectrum: amplitudeSpectrum(env),
    kurtosis: m2 > 1e-20 ? m4 / (m2 * m2) : 0,
    levelDb: Math.max(LEVEL_FLOOR_DB, 10 * Math.log10(m2 + 1e-20)),
  };
}

/**
 * Rolling element bearing defect frequencies (Hz).
 * balls: number of rolling elements, ballDiam and pitchDiam in the same unit,
 * angleDeg: contact angle.
 */
export function bearingFrequencies({ rpm, balls, ballDiam, pitchDiam, angleDeg = 0 }) {
  if (!(rpm > 0 && balls > 0 && ballDiam > 0 && pitchDiam > ballDiam)) return null;
  const fr = rpm / 60;
  const r = (ballDiam / pitchDiam) * Math.cos((angleDeg * Math.PI) / 180);
  return {
    fr,
    FTF: (fr / 2) * (1 - r),
    BPFO: ((balls * fr) / 2) * (1 - r),
    BPFI: ((balls * fr) / 2) * (1 + r),
    BSF: ((pitchDiam / (2 * ballDiam)) * fr) * (1 - r * r),
  };
}

/** Largest value of arr within +/- tolHz of hz. arr is a spectrum of length n/2+1. */
export function peakNear(arr, sr, n, hz, tolHz) {
  const lo = Math.max(1, Math.floor(((hz - tolHz) * n) / sr));
  const hi = Math.min(arr.length - 1, Math.ceil(((hz + tolHz) * n) / sr));
  let best = 0, bestK = lo;
  for (let k = lo; k <= hi; k++) if (arr[k] > best) { best = arr[k]; bestK = k; }
  return { value: best, hz: binHz(bestK, sr, n) };
}

/** Median of arr over [hz - span, hz + span] excluding the centre +/- guard, a local noise floor. */
export function localFloor(arr, sr, n, hz, spanHz = 40, guardHz = 8) {
  const vals = [];
  const lo = Math.max(1, Math.floor(((hz - spanHz) * n) / sr));
  const hi = Math.min(arr.length - 1, Math.ceil(((hz + spanHz) * n) / sr));
  for (let k = lo; k <= hi; k++) {
    const f = binHz(k, sr, n);
    if (Math.abs(f - hz) > guardHz) vals.push(arr[k]);
  }
  if (!vals.length) return 0;
  vals.sort((a, b) => a - b);
  return vals[Math.floor(vals.length / 2)];
}

/** Linear-interpolated value of a spectrum (from another sr/n) at hz. */
export function valueAtHz(arr, sr, n, hz) {
  const x = (hz * n) / sr;
  const i = Math.floor(x);
  if (i < 0 || i >= arr.length - 1) return 0;
  const t = x - i;
  return arr[i] * (1 - t) + arr[i + 1] * t;
}

/** Strongest local peaks of a spectrum above minHz. */
export function topPeaks(arr, sr, n, { count = 5, minHz = 10, maxHz = 1000 } = {}) {
  const peaks = [];
  const lo = Math.max(2, hzBin(minHz, sr, n));
  const hi = Math.min(arr.length - 2, hzBin(maxHz, sr, n));
  for (let k = lo; k <= hi; k++) {
    if (arr[k] > arr[k - 1] && arr[k] >= arr[k + 1]) peaks.push({ hz: binHz(k, sr, n), value: arr[k], k });
  }
  peaks.sort((a, b) => b.value - a.value);
  return peaks.slice(0, count);
}
