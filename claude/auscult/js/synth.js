// synth.js
// A physically-flavoured machine sound simulator: an induction motor driving a
// load, with injectable faults. Used for demos (no machine needed) and as the
// ground truth in the test suite. Pure JS, no browser APIs.

import { bearingFrequencies } from './dsp.js';

/** Small seeded PRNG (mulberry32) so tests are deterministic. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FAULTS = {
  none: 'Healthy',
  imbalance: 'Rotor imbalance',
  misalignment: 'Shaft misalignment',
  looseness: 'Mechanical looseness',
  bearing_outer: 'Bearing outer race defect',
  bearing_inner: 'Bearing inner race defect',
  cavitation: 'Pump cavitation',
  electrical: 'Electrical (2x line frequency)',
};

/** Common deep-groove ball bearings: balls, ball diameter, pitch diameter (mm). */
export const BEARINGS = {
  '6205': { balls: 9, ballDiam: 7.94, pitchDiam: 39.04, angleDeg: 0 },
  '6206': { balls: 9, ballDiam: 9.53, pitchDiam: 46.5, angleDeg: 0 },
  '6305': { balls: 8, ballDiam: 10.32, pitchDiam: 44.2, angleDeg: 0 },
  '6308': { balls: 8, ballDiam: 15.08, pitchDiam: 65.0, angleDeg: 0 },
  '6310': { balls: 8, ballDiam: 19.05, pitchDiam: 80.0, angleDeg: 0 },
};

export class MachineSim {
  constructor({ sr = 48000, rpm = 1480, lineHz = 50, bearing = BEARINGS['6205'], seed = 7 } = {}) {
    this.sr = sr;
    this.rpm = rpm;
    this.lineHz = lineHz;
    this.bearing = bearing;
    this.rand = rng(seed);
    this.fault = 'none';
    this.severity = 0;
    this.t = 0; // samples elapsed
    this.phase = new Float64Array(16); // per-harmonic phase
    this.linePhase = 0;
    this.slotPhase = 0;
    // pink noise state (Paul Kellet)
    this.pk = new Float64Array(7);
    // resonator state (structural resonance excited by impacts)
    this.res = { y1: 0, y2: 0 };
    this.res2 = { y1: 0, y2: 0 };
    this.nextImpact = 0;
    this.burst = 0;
    this.speedWander = 0;
    this.setResonance(3200, 350);
  }

  setFault(fault, severity = 0.6) {
    if (!(fault in FAULTS)) throw new Error(`Unknown fault ${fault}`);
    this.fault = fault;
    this.severity = Math.max(0, Math.min(1, severity));
  }

  setResonance(hz, bw) {
    const r = Math.exp((-Math.PI * bw) / this.sr);
    this.resA1 = 2 * r * Math.cos((2 * Math.PI * hz) / this.sr);
    this.resA2 = -r * r;
    this.resGain = (1 - r * r) * 1.0;
    // second resonance for the cavitation hiss
    const r2 = Math.exp((-Math.PI * 1800) / this.sr);
    this.res2A1 = 2 * r2 * Math.cos((2 * Math.PI * 5200) / this.sr);
    this.res2A2 = -r2 * r2;
  }

  gauss() {
    // Box-Muller
    const u = Math.max(1e-12, this.rand());
    const v = this.rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  pink(white) {
    const b = this.pk;
    b[0] = 0.99886 * b[0] + white * 0.0555179;
    b[1] = 0.99332 * b[1] + white * 0.0750759;
    b[2] = 0.969 * b[2] + white * 0.153852;
    b[3] = 0.8665 * b[3] + white * 0.3104856;
    b[4] = 0.55 * b[4] + white * 0.5329522;
    b[5] = -0.7616 * b[5] - white * 0.016898;
    const out = b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + white * 0.5362;
    b[6] = white * 0.115926;
    return out * 0.11;
  }

  /** Render the next `count` samples. Phase is continuous across calls. */
  render(count) {
    const out = new Float32Array(count);
    const sr = this.sr;
    const sev = this.fault === 'none' ? 0 : this.severity;
    const f = this.fault;

    // Harmonic amplitudes of running speed (1x .. 12x)
    const amps = new Float64Array(13);
    amps[1] = 0.05; amps[2] = 0.018; amps[3] = 0.008; amps[4] = 0.004;
    for (let h = 5; h <= 12; h++) amps[h] = 0.0015 / (h - 3);
    if (f === 'imbalance') amps[1] *= 1 + 5 * sev;
    if (f === 'misalignment') { amps[2] *= 1 + 7 * sev; amps[3] *= 1 + 4 * sev; amps[1] *= 1 + 0.8 * sev; }
    if (f === 'looseness') for (let h = 2; h <= 12; h++) amps[h] *= 1 + 10 * sev;

    let lineAmp = 0.025;
    if (f === 'electrical') lineAmp *= 1 + 6 * sev;

    const bf = bearingFrequencies({ rpm: this.rpm, ...this.bearing });
    const impactHz = f === 'bearing_outer' ? bf.BPFO : f === 'bearing_inner' ? bf.BPFI : 0;
    const impactAmp = 0.9 * sev;

    for (let i = 0; i < count; i++) {
      // slow speed wander (+/- 0.3%), as in a real motor under load
      if ((this.t & 1023) === 0) this.speedWander = 0.995 * this.speedWander + 0.0004 * this.gauss();
      const fr = (this.rpm / 60) * (1 + this.speedWander);

      let x = 0;
      for (let h = 1; h <= 12; h++) {
        this.phase[h] += (2 * Math.PI * h * fr) / sr;
        if (this.phase[h] > 2 * Math.PI) this.phase[h] -= 2 * Math.PI;
        x += amps[h] * Math.sin(this.phase[h] + h * 0.7);
      }
      // half-order subharmonics for looseness
      if (f === 'looseness') {
        x += 0.02 * sev * Math.sin(this.phase[1] / 2) + 0.012 * sev * Math.sin(1.5 * this.phase[1]);
      }

      // electrical hum at 2x line frequency with sidebands at +/- 2x slip
      this.linePhase += (2 * Math.PI * 2 * this.lineHz) / sr;
      if (this.linePhase > 2 * Math.PI) this.linePhase -= 2 * Math.PI;
      x += lineAmp * Math.sin(this.linePhase);
      if (f === 'electrical') x += 0.25 * lineAmp * Math.sin(this.linePhase * 3);

      // rotor slot / fan blade tone (constant for the machine)
      this.slotPhase += (2 * Math.PI * 28 * fr) / sr;
      if (this.slotPhase > 2 * Math.PI) this.slotPhase -= 2 * Math.PI;
      x += 0.006 * Math.sin(this.slotPhase);

      // broadband background: pink noise + a little white hiss
      const w = this.gauss();
      x += 0.05 * this.pink(w) + 0.004 * this.gauss();

      // impacts exciting the structural resonance
      let excite = 0;
      if (impactHz > 0) {
        if (this.t >= this.nextImpact) {
          let a = impactAmp * (0.8 + 0.4 * this.rand());
          // inner race defect rotates through the load zone: modulate by shaft position
          if (f === 'bearing_inner') a *= 0.35 + 0.65 * Math.max(0, Math.cos(this.phase[1]));
          excite = a;
          const period = sr / impactHz;
          this.nextImpact = this.t + period * (1 + 0.01 * this.gauss()); // 1% slip jitter
        }
      }
      // mild random contact noise even when healthy
      excite += 0.0015 * this.gauss();
      const y = this.resA1 * this.res.y1 + this.resA2 * this.res.y2 + this.resGain * excite;
      this.res.y2 = this.res.y1; this.res.y1 = y;
      x += y;

      // cavitation: random collapsing bubble bursts of broadband high-frequency noise
      if (f === 'cavitation') {
        if (this.burst <= 0 && this.rand() < 0.0012 * (0.5 + sev)) this.burst = Math.floor(sr * (0.002 + 0.004 * this.rand()));
        let e = 0;
        if (this.burst > 0) { e = 0.5 * sev * this.gauss(); this.burst--; }
        e += 0.04 * sev * this.gauss();
        const y2 = this.res2A1 * this.res2.y1 + this.res2A2 * this.res2.y2 + e * 0.5;
        this.res2.y2 = this.res2.y1; this.res2.y1 = y2;
        x += y2;
      }

      out[i] = x;
      this.t++;
    }
    return out;
  }
}
