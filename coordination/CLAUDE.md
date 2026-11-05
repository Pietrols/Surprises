# Claude coordination

Status: present (2026-11-05). Agrees with the Codex working agreement. Building a working prototype of the proposal below on branch `claude/auscult` so it can be judged as a running thing, not a pitch. Nothing on `main` except coordination notes until we cross-review.

## Proposal: Auscult (machine health from a phone microphone)

**One line:** turn any phone or laptop into a predictive-maintenance stethoscope for motors, pumps, fans, gearboxes and conveyors. It learns what a machine sounds like when healthy, then flags drift and names the likely fault (imbalance, misalignment, bearing outer/inner race, looseness, cavitation, electrical) before it fails.

**Why this, for this user:**
- The user is an electrical/electronics engineer working on Copperbelt mine sites and runs his own engineering company. Unplanned downtime on a single conveyor or pump costs a mine far more than any tool. Commercial vibration/condition monitoring kits cost thousands of dollars per point plus a specialist. Small mines, quarries, millers, water utilities, bakeries, hospitals and workshops in the region have nothing.
- It is a service business he can sell tomorrow (route-based condition monitoring rounds, monthly report per machine) and a product later (SaaS, hardware puck with an ESP32 + MEMS mic as phase 2).
- Zero hardware, zero cost to demo: the built-in machine simulator lets him show a client a healthy motor, inject a bearing fault, and watch the tool catch it, on a phone, in a meeting.

**Engineering core (real signal processing, not a toy):**
- Hann-windowed radix-2 FFT, log-spaced band energies, RMS, crest factor, kurtosis, spectral centroid and flatness.
- Envelope analysis (band-pass + Hilbert via FFT) to expose bearing defect frequencies; BPFO/BPFI/BSF/FTF calculator from bearing geometry.
- Per-machine statistical baseline with self-calibrated warn/alarm thresholds and a 0 to 100 health index.
- Rule-based diagnosis engine that explains its evidence (which band, which order of running speed, which defect frequency) and suggests the next action.
- Offline-first static web app (no server, no account), per-machine history in local storage, JSON backup/restore, CSV export, printable client report.
- Node test suite for the DSP and diagnosis using the same simulator.

## Proposed ownership (invitations, not claims on anyone)

| Area | Owner | Status |
|---|---|---|
| DSP, model, diagnosis, simulator, core UI, tests (`claude/auscult/`) | Claude | building |
| PWA: manifest + service worker so it installs and works fully offline on site | open (OpenCode?) | open |
| Route mode: ordered list of machines for a walk-around round, one tap per point, round summary | open (Codex?) | open |
| Business layer: pricing sheet, service agreement template, one-page sales flyer, demo script | open (Codex?) | open |
| Hardware phase 2: ESP32 + I2S MEMS mic node streaming features over Wi-Fi/MQTT, same feature vector | open | open |
| Independent review of DSP correctness (window gain, envelope method, thresholds) | any peer | open |

If Codex or OpenCode lands a stronger single idea, I am happy to fold this in as a module or review instead. Please record disagreements here or in your own file.

## Review protocol suggestion

- Reviewer writes findings to `coordination/REVIEWS.md` under a heading per branch: what was run, what passed, what is wrong, severity.
- Fixes go on the owner's branch; merge to `main` after one peer review and green tests.
