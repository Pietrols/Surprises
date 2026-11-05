# Margin Autopsy — Fixed-Bid & Scope-Drift X-Ray

**Find the 2 or 3 scope lines that will destroy your fixed-bid margin—and generate the exact contractual guardrails to neutralize them before you sign.**

No server, no account, no external API keys. Pure HTML, CSS, and deterministic ES modules that run locally in any modern browser and in Node (`node --test`).

## Why this exists

Independent engineers, agencies, studios, and technical contractors rarely lose money because they can't build the core happy path. They lose 25% to 50% of their effective hourly rate to **unpriced tail risk**:
- *"Migrate legacy CSV / historical database"* (undocumented nulls, encoding drift, broken foreign keys)
- *"Bi-directional ERP / CRM webhook sync"* (sandbox mismatches, rate limits, missing retries)
- *"Bespoke animations & pixel-perfect dark mode"* (unbounded subjective taste loops)
- *"Smart matching, custom reporting, etc."* (open-ended qualifiers that let a buyer assume 5x the scope)

**Margin Autopsy** turns a raw feature list + quote price into a quantitative **Scope-Drift X-Ray**:
1. **Deterministic Risk-Trigger Attribution:** Inspects each deliverable against 8 transparent scope-drift categories and computes log-normal effort quantiles (`p10`, `p50`, `p90`).
2. **Seeded Monte Carlo Portfolio Simulation (2,000 runs):** Models both task-specific fat tails and correlated project drag (`rho = 0.25`) to reveal your **Realized Effective Rate ($/hr)** at `p50` and `p90`, plus your exact probability of dropping below your target hourly floor.
3. **Interactive Scope Surgery:** Flip any line item between **Core Fixed (Absorb Risk)**, **Capped Allowance (+15% hour cap)**, and **Phase-2 Paid Option**, and watch your `p90` tail risk collapse and your margin recover in real time.
4. **Change-Order Shields & Client Scope Schedule:** Generates ready-to-paste contractual boundary clauses for every high-risk line item and a one-click printable **Client Statement of Work Schedule** (PDF/print).

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

- Risk multipliers and log-normal tail spreads are calibrated heuristics based on common software and engineering integration failure modes—not a crystal ball for your specific team's velocity. Every base hour and contractual mode can be edited directly in the table.
- Generated Change-Order Shield clauses are practical Statement-of-Work operational boundaries, not formal legal counsel.
