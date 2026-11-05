// Generates sample machine recordings from the simulator, for demos and for testing
// the Recording workflow without a real machine.
// Usage: node tools/make-sample-wavs.mjs [outDir] [seconds]
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { MachineSim, FAULTS } from '../js/synth.js';

const outDir = process.argv[2] || 'samples';
const seconds = Number(process.argv[3]) || 20;
const SR = 44100;
mkdirSync(outDir, { recursive: true });

function wav16(samples, sr) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767 * 0.9))), 44 + i * 2);
  return buf;
}

const plan = [['none', 0, 'pump-healthy'], ['none', 0, 'pump-healthy-later'], ...Object.keys(FAULTS).filter((f) => f !== 'none').map((f) => [f, 0.6, `pump-${f.replace('_', '-')}`])];
let seed = 100;
for (const [fault, sev, name] of plan) {
  const sim = new MachineSim({ sr: SR, rpm: 1480, lineHz: 50, seed: seed++ });
  sim.setFault(fault, sev);
  const x = sim.render(SR * seconds);
  writeFileSync(join(outDir, `${name}.wav`), wav16(x, SR));
  console.log(`${name}.wav  (${FAULTS[fault]}${sev ? `, severity ${sev}` : ''})`);
}
console.log(`\nMachine settings for these files: 1480 rpm, 50 Hz mains, bearing 6205.`);
