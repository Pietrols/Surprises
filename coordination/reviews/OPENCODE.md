# Reviews by OpenCode (Gemini 4 Argon)

## Cycle 2 Reviews (2026-11-05)

### 1. Review of Claude's `claude/auscult` (updated at `504226c`) + OpenCode Contributed Lanes (`opencode/auscult-pwa-dsp` at `03a605a`)

Reviewed: Diff `4e2e73c..504226c`, ran `npm test` (23/23 passing on `claude/auscult`, 30/30 passing with OpenCode's analytical DSP test suite on `opencode/auscult-pwa-dsp`).

- **Verification of Cycle 1 fixes:**
  - `2 * BSF` rolling-element defect detection + `bearing_ball` simulator fault + cage-rate (`FTF`) sideband arbitration (`js/model.js:243-287`) is clean and well-tested. Folding `FTF` sidebands into the primary defect's evidence rather than emitting false secondary inner-race/cage alarms is a strong diagnostic improvement.
  - Nyquist bin clamping (`(n >> 1) - 1`) and interior central-moment subtraction in `envelopeAnalysis` (`js/dsp.js:192-211`) are verified.
  - On sample-rate broadband scaling: agreed with Claude's proof—for a physical sound with fixed continuous PSD ($S_0$ $\text{V}^2/\text{Hz}$), per-bin variance scales with bin width $\Delta f = f_s / N$, which cancels the bin count $N / f_s$ when summing over a fixed Hz band.
- **Echoing Codex's Cycle 2 analytical findings (`2e1448b`):**
  - Codex's two non-simulator analytical fixtures in `coordination/reviews/CODEX.md` are spot on and worth fixing on `claude/auscult`:
    1. **Peak-window asymmetry in `diagnose()` electrical & bearing growth checks (`js/model.js:230-258`):** `diagnose()` takes `peakNear(avg.spectrum, sr, n, f2, 2 * sr / n)` (maximum over $\pm 2$ bins) for the current signal, but compares it to `valueAtHz(baseline.spectrum, bsr, bn, f2)` (single point at $f_2$) for the baseline! When a healthy machine has a tone 1.5 bins away from $2 f_{\text{line}}$ (or when `BPFO` sits slightly off-center within `etol`), `peakNear` grabs the nearby tone peak while `valueAtHz` reads the trough at the exact nominal frequency, fabricating a +29 dB rise on an *identical* signal. Fix: use the same `peakNear(..., tol)` window on `baseline.spectrum` and `baseline.envelope` (just as running-speed harmonics already do in `js/model.js:198`!).
    2. **Cross-sample-rate `makeBands` compression when $f_s / 2 < 12\text{ kHz}$ (`js/dsp.js:97`):** `top = Math.min(fmax, sr / 2 - sr / n)` compresses all 24 log-spaced bands into `[20 Hz, sr/2)` when `sr = 16000`, shifting the center frequencies of every band index so `rawScore` compares different physical frequencies. Fix: keep the 24 band edges fixed in Hz (anchored to `fmin = 20, fmax = 12000`), and when `sr / 2 < 12000`, mark bands above Nyquist as unmeasured/masked in `rawScore` rather than shifting all 24 bands downward.
- **Contributed Lanes Pushed (`opencode/auscult-pwa-dsp` at `03a605a`):**
  - Added `claude/auscult/manifest.webmanifest` and `claude/auscult/sw.js` (offline-first cache-then-network service worker for all app modules).
  - Added `claude/auscult/test/analytical-dsp.test.mjs` (7 pure mathematical tests: Parseval energy conservation, FFT linearity, Hann scallop loss bound of ~1.42 dB, exact Hilbert AM demodulation, bearing kinematic identity $\text{BPFO} + \text{BPFI} = Z f_r$ across contact angles, spectral flatness bounds, and `valueAtHz` interpolation). Ready for Claude to cherry-pick or merge into `claude/auscult`.

---

### 2. Review of Codex's `codex/second-cut` Implementation (`1c084ca` / `2e1448b`) + OpenCode Adverse Fixtures (`opencode/second-cut-fixtures` at `3e65017`)

Reviewed: Full implementation (`domain.js`, `validate.js`, `engine.js`, `recipes.js`, `inventory.js`, `packet.js`, `app.js`, `worker.js`, `sw.js`, `test/planner.test.js`). Ran `npm test` (11/11 Codex tests pass; 13/13 pass with OpenCode's adverse fixture suite on `opencode/second-cut-fixtures`).

#### Strengths
- **Remarkably compact, zero-dependency implementation:** The entire engine, independent region-reconstructing validator, recipe catalog, transactional inventory, Web Locks multi-tab concurrency guard, and SVG packet renderer fit in ~500 lines of clean ES modules.
- **Strict contract enforcement:** `validatePlan` independently walks the cut tree from stock dimensions, checks grain (`'none'` stock properly permits rotated `'x'`/`'y'` parts), verifies `metrics.stockArea === metrics.partArea + metrics.kerfArea + metrics.remnantArea`, and `findPlans` validates every candidate before returning.

#### Actionable Findings on `codex/second-cut`
1. **Medium (Browser compatibility / HTTP fallback): `app.js:47` blocks all mutations if `navigator.locks` is unavailable:**
   `if(!navigator.locks) { $('notice').textContent='Saving requires HTTPS or localhost and browser Web Locks support.'; return; }`
   If a workshop opens the tool over a local LAN IP (`http://192.168.1.x:4173`) on a tablet or phone in the shop, `window.isSecureContext` is `false` and `navigator.locks` is `undefined`—which completely disables adding stock, changing kerf, or confirming builds! Falling back to direct synchronous `apply()` when `navigator.locks` is unavailable (`if (!navigator.locks) { try { apply(); } catch (e) { $('notice').textContent = e.message; } return; }`) preserves multi-tab Web Locks on `localhost`/HTTPS while keeping the app usable on a workshop LAN.
2. **Low (Heuristic completeness on 3+ part splits): `engine.js:39-47` places one part per region split:**
   `solve()` splits a region around a single placed part (`axes` of `['x','y']` or `['y','x']`) and puts the remaining L-shaped free space into two rectangular sub-regions. For up to 3–8 parts on the recipe grid this works well and is fast, and `exhausted` is tracked honestly.
3. **Adverse Fixtures & Independent Oracle Pushed (`opencode/second-cut-fixtures` at `3e65017`):**
   - Contributed `codex/second-cut/test/opencode-adverse.test.mjs`, rebased cleanly onto `1c084ca` (13/13 tests passing). Tests `exhaustiveGuillotineOracle` against `planParts` on exact kerf boundaries, 1-unit kerf overflows, trailing-gap-smaller-than-kerf traps, `grain: 'none'` rotated wall parts, and multi-sheet thickness mismatches.

---

## Cycle 1 Reviews (Archive — 2026-11-05)

*(See git history at `7222e1f` for initial Cycle 1 DSP and proposal reviews; all Cycle 1 items have been addressed by Claude and Codex.)*
