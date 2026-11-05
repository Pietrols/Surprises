# OpenCode proposal — Margin Autopsy (Fixed-Bid & Scope-Drift X-Ray)

Status: proposed and implemented on branch `opencode/margin-autopsy` (folder `opencode/margin-autopsy/`). Prepared 2026-11-05. Keep all names and product details out of the user's chat.

## The useful surprise

Most independent builders, consultants, agencies, and technical contractors lose 20% to 45% of their effective income not from pricing too low on paper, but from **unpriced ambiguity, compound revision loops, integration tail-risk, and unbilled handoff drag** buried inside seemingly innocent scope items.

**Margin Autopsy** takes a raw project scope, feature list, or client brief (plus your target price, timeline, and hourly floor) and runs a deterministic **Scope-Drift & Margin X-Ray**:
1. **Decomposes** every line item into deterministic base hours, hidden multiplier triggers (e.g., third-party auth/webhooks, "simple admin dashboard", client-supplied data migration, multi-role permissions, vague acceptance criteria), and Monte Carlo p10 / p50 / p90 effort distributions.
2. **Quantifies Realized Effective Rate ($/hr)** across p50 (expected) and p90 (tail-risk) scenarios, showing exactly *which* 2 or 3 scope lines destroy the project's profitability.
3. **Generates surgical "Change-Order Shields" (Scope Guardrails)** for every high-risk line item—ready-to-paste contractual boundary clauses that cap revisions, define acceptance gates, and convert open-ended traps into paid add-ons *before* signing.
4. **Runs an Interactive Scope Surgical Table & Printable Client Estimate / Guardrail Schedule** so the user can toggle items between *Core Scope*, *Capped Allowance*, and *Paid Phase-2 Option* and watch their p90 margin recover in real time.

## Why this complements Claude's and Codex's candidates

- **Claude (`claude/auscult`)** built an **industrial acoustic condition screening** tool for physical rotating machines.
- **Codex (`codex/second-cut`)** proposed a **physical sheet-material reverse cut planner** for woodworking/fabrication offcuts.
- **OpenCode (`opencode/margin-autopsy`)** covers the **commercial & deal-economics layer** that anyone selling software, engineering, or technical services can use *today* to protect thousands of dollars on their next quote, or sell as a standalone micro-SaaS / lead-magnet product.

## Non-negotiable engineering & honesty gates

- **Zero external dependencies, zero API keys, 100% local-first:** Runs in any modern browser and tested via `node --test`.
- **Deterministic seeded simulation:** Uses a seeded PRNG (`mulberry32`) and transparent, inspectable risk-multiplier rules (no fake AI black-box claims; every hour and risk multiplier shows its exact mathematical formula and trigger tokens).
- **Editable rule parameters:** Users can override base hours, uncertainty spread, and hourly rates on every single line item.
- **Built-in realistic scenarios:** Ships with 4 one-click realistic project briefs (SaaS MVP Build, Legacy Data & ERP Integration, Design-to-Production Web Rebuild, and Industrial IoT Pilot) so the reveal lands in 10 seconds.
- **Exportable deliverables:** Generates both a **Client-Facing Scope & Boundary Schedule** (clean, professional print/PDF view that frames guardrails constructively) and an **Internal Margin Autopsy JSON/CSV** for records.
