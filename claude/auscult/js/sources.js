// sources.js
// Three interchangeable audio sources. Each one calls onFrame(Float64Array of FRAME samples)
// about ten times per second and exposes its sample rate as `sr`.

import { FRAME } from './model.js';
import { MachineSim } from './synth.js';

const HOP_SECONDS = 0.1;

/** Live microphone. Browser voice processing is switched off so the raw machine sound is measured. */
export class MicSource {
  constructor() { this.kind = 'mic'; }
  async start(onFrame) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser cannot open the microphone. Use Chrome or Safari over https (or localhost).');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    this.ctx = new AudioContext();
    this.sr = this.ctx.sampleRate;
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = FRAME;
    this.analyser.smoothingTimeConstant = 0;
    // Route through a silent gain so the graph is pulled on every browser without playing the mic back.
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    src.connect(this.analyser);
    this.analyser.connect(mute);
    mute.connect(this.ctx.destination);
    const buf = new Float32Array(FRAME);
    this.timer = setInterval(() => {
      this.analyser.getFloatTimeDomainData(buf);
      onFrame(Float64Array.from(buf));
    }, HOP_SECONDS * 1000);
    const track = this.stream.getAudioTracks()[0];
    this.label = track?.label || 'Microphone';
  }
  stop() {
    clearInterval(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close();
  }
}

/** Built-in machine simulator, optionally audible through the speaker. */
export class SimSource {
  constructor(machine) {
    this.kind = 'sim';
    this.machine = machine;
    this.listen = false;
    this.label = 'Simulator';
  }
  async start(onFrame) {
    this.ctx = new AudioContext();
    this.sr = this.ctx.sampleRate;
    this.sim = new MachineSim({
      sr: this.sr,
      rpm: this.machine.rpm || 1480,
      lineHz: this.machine.lineHz || 50,
      bearing: this.machine.bearing || undefined,
      seed: Math.floor(Math.random() * 1e9),
    });
    if (this.pendingFault) this.sim.setFault(...this.pendingFault);
    this.ring = new Float64Array(FRAME);
    this.produced = 0;
    this.t0 = performance.now();
    this.nextPlay = 0;
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.7;
    this.gain.connect(this.ctx.destination);
    // Prime the ring buffer so the first frame is complete.
    this.push(this.sim.render(FRAME));
    this.timer = setInterval(() => {
      const due = Math.floor(((performance.now() - this.t0) / 1000) * this.sr) - this.produced;
      if (due <= 0) return;
      const chunk = this.sim.render(Math.min(due, this.sr)); // never more than 1 s at once (tab was asleep)
      this.produced += due;
      this.push(chunk);
      if (this.listen) this.play(chunk);
      onFrame(this.ring.slice());
    }, HOP_SECONDS * 1000);
  }
  push(chunk) {
    const n = chunk.length;
    if (n >= FRAME) { this.ring.set(chunk.subarray(n - FRAME)); return; }
    this.ring.copyWithin(0, n);
    this.ring.set(chunk, FRAME - n);
  }
  play(chunk) {
    const buf = this.ctx.createBuffer(1, chunk.length, this.sr);
    // Scale up so it is clearly audible on a phone speaker, with a soft clip for safety.
    const out = buf.getChannelData(0);
    for (let i = 0; i < chunk.length; i++) out[i] = Math.tanh(chunk[i] * 4);
    const node = this.ctx.createBufferSource();
    node.buffer = buf;
    node.connect(this.gain);
    const at = Math.max(this.nextPlay, this.ctx.currentTime + 0.05);
    node.start(at);
    this.nextPlay = at + buf.duration;
  }
  setFault(fault, severity) {
    this.pendingFault = [fault, severity];
    this.sim?.setFault(fault, severity);
  }
  setListen(on) {
    this.listen = on;
    if (on) this.ctx?.resume();
  }
  stop() {
    clearInterval(this.timer);
    this.ctx?.close();
  }
}

/** A recording (WAV, MP3, M4A voice memo...) analysed faster than real time. */
export class FileSource {
  constructor(file) {
    this.kind = 'file';
    this.file = file;
    this.label = file.name;
    this.stopped = false;
  }
  async start(onFrame, onEnd) {
    const ctx = new AudioContext();
    this.sr = ctx.sampleRate;
    let audio;
    try {
      audio = await ctx.decodeAudioData(await this.file.arrayBuffer());
    } catch {
      ctx.close();
      throw new Error(`Could not read "${this.file.name}". Use a WAV, MP3, M4A or OGG recording.`);
    }
    ctx.close();
    const len = audio.length;
    const mono = new Float64Array(len);
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const ch = audio.getChannelData(c);
      for (let i = 0; i < len; i++) mono[i] += ch[i] / audio.numberOfChannels;
    }
    if (len < FRAME) throw new Error('The recording is too short. Record at least 5 seconds.');
    const hop = Math.round(this.sr * HOP_SECONDS);
    this.duration = len / this.sr;
    let count = 0;
    for (let start = 0; start + FRAME <= len && !this.stopped; start += hop) {
      onFrame(mono.slice(start, start + FRAME));
      if (++count % 15 === 0) await new Promise((r) => setTimeout(r, 0)); // keep the page responsive
    }
    if (!this.stopped) onEnd?.();
  }
  stop() { this.stopped = true; }
}
