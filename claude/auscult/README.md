# Auscult

**Machine health from a phone's microphone.** Hold a phone at the same spot on a motor, pump, fan, gearbox or conveyor drive for twenty seconds. Auscult learns how that machine sounds when it is healthy. From then on, every reading is compared with that baseline, given a 0 to 100 health index on the familiar ISO 10816 A/B/C/D zone strip, and, when the sound drifts, the likely fault is named with the evidence and the next action.

No hardware, no account, no server. It is a static web page that works on any modern phone or laptop browser and keeps all data on the device.

## Why this exists

Unplanned downtime of one conveyor drive, slurry pump or mill fan can cost a mine or plant far more in a single shift than any monitoring tool. Professional condition monitoring (accelerometers, data collectors, analysts) costs thousands of dollars per measuring point plus a specialist's time, so most small and mid-sized operations in the region monitor nothing: quarries, mills, water utilities, bakeries, hospitals, workshops, and much of the balance-of-plant on big sites.

The insight is that most of the early fault signatures used in vibration analysis are also audible: running speed harmonics, 2x line frequency, and above all the repetitive impacts of a damaged bearing, which ring a structural resonance in the kilohertz range where phone microphones are good. Compared against the **same machine's own healthy sound** at the **same spot**, a phone is enough to screen for change and point at the likely cause.

## What it does

| | |
|---|---|
| **Learn** | Records 10 to 60 s of the healthy machine and builds a statistical baseline (means and spreads of 31 features, average spectrum and envelope spectrum), then self-calibrates its warn and alarm thresholds from how the healthy sound varies. |
| **Monitor** | Scores a running 3 second window twice a second, shows the health index and zone, the spectrum against the baseline, the envelope spectrum with bearing defect frequencies marked, and which frequency bands moved. |
| **Diagnose** | Explainable rules name: imbalance (1x), misalignment (2x), mechanical looseness (harmonic fence), outer race / inner race / rolling element / cage bearing defects (BPFO, BPFI, BSF, FTF in the envelope), impulsive content, high-frequency rise (early wear or lubrication), cavitation and flow turbulence, and electrical faults (2x line frequency). Each finding states its evidence and a recommended action. |
| **Early warning** | A named fault pattern overrides a still-healthy overall score: a mild bearing defect is flagged while the overall sound has barely changed. |
| **Three sources** | Live microphone (browser voice processing switched off), a built-in physically-flavoured machine simulator with injectable faults (for demos and training), or a recording (voice memo, WAV, MP3, M4A) analysed after the fact. |
| **Records** | Per-machine nameplate (speed, mains frequency, bearing type from a preset list or custom geometry, measuring point), saved readings and a health trend, CSV export, JSON backup and restore between devices. |
| **Client report** | One click produces a printable condition report (save as PDF) with the zone, findings, recommended actions, charts and method statement. |

## Run it

It is plain HTML, CSS and ES modules. Any static server works:

```bash
cd claude/auscult
npx serve -l 5173 .        # or: python3 -m http.server 5173
# open http://localhost:5173
```

The microphone needs a secure origin: `localhost`, or any `https://` host. GitHub Pages, Vercel or Netlify all work with zero configuration: point them at this folder.

**Try it in one minute:** open the page, press **Try it on a simulated pump**. It learns the healthy simulated pump for 10 s and starts monitoring. In the simulator panel change **Condition** to *Bearing outer race defect*, watch the needle fall into zone D and the envelope spectrum grow a peak exactly on the BPFO marker with its harmonics. Tick **Play through speaker** to hear what the defect sounds like.

**Sample recordings:** `node tools/make-sample-wavs.mjs samples 20` writes a healthy recording and one per fault (1480 rpm, 50 Hz, 6205 bearing) for testing the recording workflow or demonstrating on a laptop.

## Field procedure (what makes readings trustworthy)

1. Mark the measuring point with paint, typically on the bearing housing. Hold the phone at the same distance (a 3D printed or cut-foam spacer makes this repeatable), microphone facing the housing.
2. Learn the baseline with the machine at its normal speed and load, after a known-good service if possible.
3. Measure on a schedule (weekly is typical). Same phone if possible; re-learn if you change phones.
4. Neighbouring machines are part of the sound. Take readings with the same neighbours running as during learning, or note it.
5. A finding is a reason to inspect, not a verdict. Confirm with a stethoscope, temperature gun, grease check or a vibration specialist before major work.

## How it works

All signal processing is in `js/dsp.js` and `js/model.js`: plain JavaScript with no browser APIs, so the exact same code runs in the browser and in the tests.

- **Frames:** 8192 samples (about 170 ms at 48 kHz), ten per second.
- **Spectrum:** Hann window, iterative radix-2 FFT, amplitude-corrected so a sine of amplitude A reads A.
- **Features:** overall level, crest factor, kurtosis, spectral centroid, spectral flatness, 24 log-spaced band energies (20 Hz to 12 kHz, defined in Hz so they survive sample-rate changes), and the kurtosis and level of the 1.5 to 8 kHz band.
- **Envelope analysis:** the 1.5 to 8 kHz band is isolated and turned into an analytic signal with an FFT-based Hilbert transform; the spectrum of its magnitude shows the repetition rate of impacts. Band kurtosis ("spectral kurtosis") is about 3 for random noise and climbs to 7 to 9 with a bearing defect, which is what makes early bearing faults detectable when the overall sound has barely changed.
- **Bearing frequencies:** BPFO, BPFI, BSF and FTF from shaft speed and bearing geometry (presets for 6205, 6206, 6305, 6308 and 6310, or custom geometry from the maker's catalogue).
- **Baseline and score:** per-feature mean and standard deviation with physical floors (so a very steady machine does not alarm on tiny wobbles), weighted RMS of z-scores (impulsiveness one-sided), thresholds self-calibrated from the baseline's own 99th percentile.
- **Health index:** 100 at the baseline median, 70 at the warn threshold, 40 at the alarm threshold, mapped to zones A (85+), B (70+), C (40+), D.

## Tests

```bash
cd claude/auscult
npm test            # node --test, no dependencies
```

19 tests: FFT round trip and amplitude, kurtosis of sine/Gaussian/impulses, centroid, bearing frequency orders for a 6205 against reference values, envelope detection of an impact train, baseline calibration, no false alarms on an independent healthy run, correct naming of all seven fault types, severity ordering, the early-warning path, looseness not mislabelled as misalignment, and baseline serialisation.

A wider sweep (3 baselines x 2 monitoring seeds x 8 conditions x 2 severities) gave **zero false alarms on 12 healthy runs** and correct naming of every fault at moderate severity.

## Honest limitations

- A microphone hears airborne sound, not structural vibration. It is a screening tool for **change**, not a calibrated ISO 10816 velocity measurement; the zone strip borrows that convention for readability only.
- Validation so far is against the simulator. **The next most valuable step is real recordings** of machines with known condition (before and after a bearing change, a pump with and without cavitation) to tune thresholds.
- Some phones (notably some iOS versions) do not fully honour the request to switch off automatic gain. The baseline absorbs a constant gain, but readings from different phones are not interchangeable.
- At mild severity, looseness can still be labelled as misalignment (both raise 2x). The health index still drops correctly.
- Variable-speed drives: the order analysis assumes the speed entered on the nameplate. Readings at a different speed should use a separate machine entry or a re-learned baseline.

## Where this can go

- **Service business, now:** monthly condition monitoring rounds for clients who have nothing today, priced per measuring point, with the printable report as the deliverable. The simulator is the sales demo: a client sees a healthy pump, a fault injected, and the tool catching it, on a phone, in their office.
- **PWA and route mode:** install to the home screen, work fully offline underground, walk an ordered route of measuring points with one tap each and get a round summary.
- **Hardware node:** an ESP32 with an I2S MEMS microphone (or a cheap MEMS accelerometer) clamped to the housing, running the same feature extraction and sending the 31-number feature vector over Wi-Fi/MQTT. Continuous monitoring for a few dollars per point instead of hundreds.
- **Fleet learning:** every confirmed finding (inspected, bearing replaced, photo) becomes a labelled example; across many machines that becomes a dataset no one in the region has.

## Files

```
index.html          page structure
css/styles.css      light/dark theme, zone strip, layout
js/dsp.js           FFT, features, envelope analysis, bearing frequencies
js/model.js         baseline, scoring, health index, diagnosis, assess()
js/synth.js         machine simulator with injectable faults
js/sources.js       microphone, simulator and recording sources
js/store.js         local storage, backup/restore, CSV
js/charts.js        canvas charts
js/app.js           UI wiring, report generation
test/               node --test suite
tools/              sample recording generator
```
