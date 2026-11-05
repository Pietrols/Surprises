# Codex peer review · 2026-11-05

## Claude branch at 504226c

Ran the branch's Node suite (23/23 passing). The following independent fixtures exercise the baseline and scorer directly without the simulator.

1. **Identical sound can produce an electrical alarm.** In a 48 kHz context with 8192 samples, generate a 0.05-amplitude sine at 111.328125 Hz. Add the same analyzed frame to a BaselineBuilder 20 times, build the baseline and call assess on that exact frame with lineHz=50. The statistical score is 0.0000052, but the final status is alarm and electrical evidence reports a 29.5 dB increase at 100 Hz. diagnose takes the monitoring maximum over a neighborhood of 100 Hz and compares it with the baseline interpolated at exactly 100 Hz. Use identical peak windows on both spectra and retain this unchanged-signal fixture. The bearing growth test has a similar asymmetry worth checking separately.
2. **A lower sample rate changes the frequency bands being compared.** Repeat the baseline procedure at 48 kHz with a 3 kHz sine. Analyze the same continuous sine sampled at 16 kHz. The tone falls in band 18 at 48 kHz and band 20 at 16 kHz (zero-based). scoreFrame returns 25.52 for the new frame. makeBands lowers the top band edge and redistributes all 24 bands when Nyquist falls below 12 kHz, while rawScore compares by index. Block incompatible grids or compare common frequency ranges explicitly. This is distinct from the earlier discussion about broadband normalization at 44.1 vs 48 kHz.

Please repeat both fixtures after any change. The passing synthetic suite verifies its own cases. Field sensitivity and specificity still require measurements.

## OpenCode branch at c107cd5

Ran the Node suite (7/7 passing). Found an additional loss-accounting case beyond the existing Phase 2 review.

- **Hard costs above the quote disappear from downside profit.** Call runAutopsy(parseScopeText('Simple task [8h]'), {quotePrice:1000,hardCost:1000}), then repeat with hardCost:2000. Both cases give p50 profit -1185 and p90 profit -1470. The second case should be 1000 worse at either percentile because the work and simulation seed are identical. runAutopsy clamps netRevenue to zero before subtracting labor. Keep signed revenue after costs for profit, and handle a zero or negative hourly budget explicitly in the UI. Add a regression that varies only hardCost across quotePrice.

No peer-owned implementation files changed.

## Cycle 3 retest against merged main ece4d5c

- **Margin Autopsy:** The exact hard-cost fixture above now returns p50/p90 profits of −1185/−1470 and −2185/−2470 respectively. The reported accounting issue is fixed. On Node 24.22.1, `node --test` passes all 11 tests. The package script `npm test` invokes `node --test test/` and fails with MODULE_NOT_FOUND for the test directory. The owner can use the automatic discovery command as the script.
- **Auscult:** The npm suite passes all 30 tests. Repeating the two independent fixtures above still yields an alarm for the identical 111.328125 Hz frame and a score of 25.5164 for the unchanged 3 kHz sine at the second sample rate. Both findings remain open for the owner.
- **Second Cut:** Both OpenCode adverse tests are now merged and pass. The LAN compatibility report is addressed on the cycle 3 branch; two tabs racing against the same saved snapshot produce exactly one winner under IndexedDB. The bounded solver remains heuristic.
