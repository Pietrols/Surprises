# Margin Autopsy — Fixed-Bid & Scope-Drift X-Ray

**Find the 2 or 3 scope lines that threaten your fixed-bid margin—and generate the exact contractual guardrails to neutralize them before you sign.**

No server, no account, no external API keys. Pure HTML, CSS, and deterministic ES modules that run locally in any modern browser and in Node (`node --test`).

## Why this exists

Independent engineers, agencies, studios, and technical contractors rarely lose money because they cannot build the core happy path. Fixed-price quotes go underwater when **unpriced tail risk** is bundled into a flat fee without contractual boundaries:
- *"Migrate legacy CSV / historical database"* (undocumented nulls, encoding drift, broken foreign keys)
- *"Bi-directional ERP / CRM / SCADA bridge"* (sandbox mismatches, rate limits, undocumented registers)
- *"Site commissioning & client-supplied sensors"* (plant shutdown delays, unready equipment, standby time)
- *"Bespoke 3D configurator & custom animations"* (unbounded subjective taste loops)
- *"Smart matching, custom reporting, etc."* (open-ended qualifiers that let a buyer assume 5x the scope)

**Margin Autopsy** turns a raw feature list + quote price into a quantitative **Scope-Drift X-Ray**:
1. **Deterministic Risk-Trigger Attribution:** Inspects each deliverable against 9 transparent software and industrial engineering scope-drift categories (with word-sense guards against false triggers) and computes log-normal effort quantiles (`p10`, `p50`, `p90`).
2. **Seeded Monte Carlo Portfolio Simulation (2,000 runs):** Models both task-specific fat tails and correlated project drag (`rho = 0.25`) to reveal your **Realized Effective Rate (/hr)** at `p50` and `p90`, plus your modeled probability of dropping below your target hourly floor. Supports USD, ZMW, EUR, and GBP.
3. **Honest Scope Surgery Accounting:**
   - **Core Fixed:** Included in Phase 1; builder absorbs all overrun risk.
   - **Capped Allowance (+15% hour cap):** Included in Phase 1 up to `1.15x` base hours; work stops at the cap or converts to paid T&M change orders.
   - **Phase-2 Paid Option:** Carves both the item's hours *and* its proportional share of the Phase-1 fixed quote out of Phase 1 into a separate Phase-2 option, so moving a clean item does not fake profit, while moving a fat-tail trap genuinely improves Phase-1 p90 margin.
4. **Change-Order Shields & Client Scope Schedule:** Generates ready-to-paste contractual boundary clauses for every line item and a one-click printable **Client Statement of Work Schedule** (PDF/print).

## Run it

```bash
cd opencode/margin-autopsy
npx serve -l 5174 .        # or: python3 -m http.server 5174
# open http://localhost:5174
```

## Run tests

```bash
cd opencode/margin-autopsy
npm test
```

## Honest limitations

- Risk multipliers and log-normal tail spreads are heuristic planning models for scenario exploration—not empirical forecasts or industry statistics. Every base hour and contractual mode can be edited directly in the table.
- Generated Change-Order Shield clauses are practical Statement-of-Work operational boundaries, not formal legal counsel.
