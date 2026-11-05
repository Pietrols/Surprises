# OpenCode proposal — Margin Autopsy (Fixed-Bid & Scope-Drift X-Ray)

Status: proposed and implemented on branch `opencode/margin-autopsy` (folder `opencode/margin-autopsy/`). Updated in Cycle 2 after Claude and Codex peer reviews. Keep all names and product details out of the user's chat.

## The useful surprise

Independent builders, engineering contractors, agencies, and technical consultants often see fixed-price margins erode not because they misjudge the happy path, but because **unpriced ambiguity, compound revision loops, integration tail-risk, site-readiness delays, and unbilled handoff drag** are bundled into a flat fee without explicit contractual boundaries.

**Margin Autopsy** takes a raw project scope, feature list, or client brief (plus your quote price, pass-through costs, currency, and hourly floor) and runs a deterministic **Scope-Drift & Margin X-Ray**:
1. **Decomposes** every line item into deterministic base hours, transparent risk-multiplier triggers (across 9 software and field-engineering categories, with word-sense guards against false positives), and log-normal `p10` / `p50` / `p90` effort distributions.
2. **Quantifies Realized Effective Rate (/hr)** and **Economic Margin** across `p50` (expected) and `p90` (tail-risk) scenarios, showing exactly *which* 2 or 3 scope lines drive the project's tail-risk overrun.
3. **Honest Scope Surgery Accounting:**
   - **Core Fixed:** Builder absorbs all overrun risk in Phase 1.
   - **Capped Allowance (+15% hour cap):** Phase-1 obligation is capped at `1.15x` base hours; excess stops or converts to paid T&M change orders.
   - **Phase-2 Paid Option:** Carves both the item's hours *and* its proportional share of the Phase-1 fixed quote out of Phase 1 into a separate Phase-2 option—so moving a clean item does not fake profit, while moving a fat-tail trap genuinely improves Phase-1 `p90` margin.
   - **Signed Net Revenue:** Pass-through hard costs exceeding the quote price reduce downside profit dollar-for-dollar without zero-clamping artefacts.
4. **Generates surgical "Change-Order Shields" (Scope Guardrails)** for every line item—ready-to-paste Statement-of-Work boundary clauses—plus a one-click printable **Client Scope & Boundary Schedule**.

## Why this complements Claude's and Codex's candidates

- **Claude (`claude/auscult`)** built an **industrial acoustic condition screening** tool for physical rotating machines.
- **Codex (`codex/second-cut`)** built a **physical sheet-material reverse cut planner** for woodworking/fabrication offcuts.
- **OpenCode (`opencode/margin-autopsy`)** covers the **commercial & deal-economics layer** (supporting USD, ZMW, EUR, GBP and both software and industrial field-commissioning rules) that anyone selling engineering or software projects can use immediately on their next quote.
