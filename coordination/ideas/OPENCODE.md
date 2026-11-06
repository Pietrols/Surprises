# OpenCode (Gemini 4 Argon): 10 Project Ideas (Ranked)

Lens: Grounded in the user's feedback ("pricing is very important", wants to refine **Margin Autopsy**, prefers working one project at a time to completion, and wants tools he can either use directly at Quantic or sell as high-value B2B software).

The top 4 ideas directly evolve **Margin Autopsy** from a standalone heuristic calculator into a calibrated, end-to-end **Commercial & Deal-Economics Operating System** (Empirical Calibration, VAT/WHT/FX & Landed Equipment Pricing, Working-Capital Survival, and Live Change-Order Capture). Ideas 5–10 are high-leverage B2B products that either complement Quantic's engineering operations or can be sold standalone.

---

## 1. Empirical Post-Mortem Calibrator (Bayesian History Loop for Margin Autopsy)
- **Problem:** Heuristic risk multipliers ("legacy migration = 1.35x") are educated guesses until anchored to a contractor's own completed jobs.
- **What it does:** Lets you log completed or in-flight jobs (quoted hours, actual hours, quoted hardware/pass-through cost, actual cost, and which risk tags were present). Uses empirical shrinkage (blending the prior rule multiplier with your observed overrun ratios weighted by sample count) so Margin Autopsy automatically calibrates its `p50` multipliers and `p90` tail spreads to **your** team's actual velocity and blind spots.
- **Who pays:** Engineering contractors, agencies, systems integrators, and technical consultancies who quote repeatedly.
- **Why unsolved:** ERP job-costing modules bury actuals in accounting ledgers and never feed them back into the estimation engine for the next quote.
- **First slice:** A "Past Jobs & Calibration" tab inside Margin Autopsy with 5 realistic historical jobs pre-loaded, live empirical multiplier shrinkage, and a visual badge showing `Prior (1.35x) → Your History (1.58x across 4 jobs)`.

## 2. Zambian Tax, Withholding & Landed-Equipment Pricing Engine (Quantic Quote Mode)
- **Problem:** A quote that looks profitable on gross margin goes underwater once 16% VAT, Withholding Tax (WHT) cash-flow deductions, USD/ZMW exchange-rate slippage during equipment transit, customs duty, and clearing/transport fees hit.
- **What it does:** Adds a dedicated **Equipment & Tax Schedule** to Margin Autopsy: separates Labor/Services from Imported/Local Hardware BOM, calculates FOB → CIF → Duty → Import VAT → Clearing → Landed ZMW/USD cost under FX volatility bands, models 16% output/input VAT and WHT cash retention, and outputs a **Quote Validity Window** ("Price valid for 14 days or within ±3.5% USD/ZMW band").
- **Who pays:** Any engineering, electrical, automation, or equipment supply contractor quoting in ZMW/USD.
- **Why unsolved:** Standard quoting tools treat equipment as a flat pass-through number and ignore FX drift between pro-forma invoice and client mobilization payment.
- **First slice:** Integrated BOM + ZMW/VAT/FX calculator inside Margin Autopsy that feeds probabilistic hardware cost variance directly into the Monte Carlo profit engine.

## 3. Working-Capital & Milestone Cash-Trough Simulator ("Will I Run Out of Cash in Week 4?")
- **Problem:** Profitable fixed-bid jobs still suffocate contractors when hardware procurement and site mobilization happen in Week 1, but client milestone payments arrive 45–90 days late.
- **What it does:** Maps the Margin Autopsy quote onto a weekly timeline: mobilization deposit %, hardware purchase outflow, weekly labor burn, and realistic client payment delay distributions (e.g., mines/corporates paying Net-60 + 20 days jitter). Computes the **Maximum Cash Trough** (deepest negative cash balance and exact week it hits) and solves for the minimum **Mobilization Deposit %** required to keep cash flow non-negative at `p90`.
- **Who pays:** Small-to-mid contractors, suppliers, and project engineers.
- **Why unsolved:** Spreadsheets assume clients pay on the exact invoice due date; accounting software only tells you you're out of cash after the fact.
- **First slice:** A 3-milestone payment schedule slider (`40% Mobilization / 40% Delivery / 20% Commissioning`) with a weekly cash-curve chart showing `p10 / p50 / p90` cash trough.

## 4. Scope-Creep Radar & One-Click Variation Order (Change-Order) Generator
- **Problem:** Even when a contract has strong boundary clauses, engineers give away thousands of dollars in free work mid-project because writing a formal Variation Order feels awkward or slow when a client sends a "quick WhatsApp/email request."
- **What it does:** Paste a client's mid-project message or site request; compares it against the signed Margin Autopsy baseline scope and active **Change-Order Shields**, flags exactly which contractual boundary it crosses, prices the time/schedule impact, and generates a polite, ready-to-send **Variation Order / Scope Amendment PDF** for one-click client sign-off before the extra work begins.
- **Who pays:** Every fixed-price contractor, agency, and field engineering firm.
- **Why unsolved:** Project management tools track tasks; they don't link mid-project requests back to the contractual boundary clauses of the original quote.
- **First slice:** "Check Client Request" drawer against the active project's signed Scope Schedule that outputs a numbered Variation Order (#VO-01) with cost and timeline delta.

## 5. RFQ & BoQ Auto-Pricer (Vendor Quote Normalizer & Markup Optimizer)
- **Problem:** Pricing a 60-line Bill of Quantities (BoQ) requires chasing 4 supplier quotes in different currencies, units, lead times, and VAT treatments, then manually copying numbers into Excel under a tight tender deadline.
- **What it does:** Paste or import a client's raw BoQ alongside supplier price lists/quotes; normalizes currencies, units, pack sizes, and lead times, highlights anomalously low/high vendor lines, applies target margin rules by risk tier, and exports a clean tender submission table.
- **Who pays:** Electrical, civil, mechanical, and IT hardware contractors bidding on multi-line BoQs.
- **Why unsolved:** ERP procurement is built for enterprises with fixed catalog SKUs, not agile contractors pricing custom RFQs from messy supplier pro-formas.
- **First slice:** Multi-supplier BoQ comparison grid that parses pasted line items, normalizes USD/ZMW + VAT + lead time, and computes optimal bid price per line.

## 6. SLA & Maintenance Retainer Pricer (Preventive vs. Breakdown Economics)
- **Problem:** Engineering firms struggle to price annual Maintenance & Support SLAs—either underpricing 24/7 emergency callouts or failing to convince clients why a monthly retainer is cheaper than unscheduled breakdowns.
- **What it does:** Models equipment count, site distance/travel cost, callout frequency, response-time SLA penalties, and spares holding cost. Outputs a 3-tier monthly retainer proposal (Bronze / Silver / Gold) alongside a client-facing **ROI Breakdown Comparison** showing the client's expected unscheduled downtime cost vs. the retainer fee.
- **Who pays:** Industrial service providers, HVAC/electrical/automation contractors, and MSPs.
- **Why unsolved:** Most retainers are priced by gut feel ("10% of install cost") without modeling travel burn or emergency callout tail risk.
- **First slice:** Interactive 3-tier SLA builder + printable client ROI comparison sheet.

## 7. Commissioning & FAT/SAT Punchlist Sign-Off Vault
- **Problem:** Final 10–20% retention payments get delayed for months because site commissioning (SAT) punchlists, meter readings, and photo evidence are scattered across WhatsApp chats and paper clipboards.
- **What it does:** Offline-first mobile checklist for Factory/Site Acceptance Testing (FAT/SAT): captures pass/fail tolerances, instrument serial numbers, timestamped photos, and on-glass client engineer signature, then immediately compiles a tamper-evident **Completion & Payment Release Certificate** tied to the final invoice milestone.
- **Who pays:** Field engineering, solar/power, automation, and construction contractors.
- **Why unsolved:** Generic form apps don't bind engineering tolerance checks directly to contractual milestone release certificates.
- **First slice:** Offline SAT protocol runner with numeric tolerance validation, signature pad, and instant PDF Acceptance Certificate.

## 8. Vendor & Subcontractor Reliability Ledger (Lead-Time & Defect Scorecard)
- **Problem:** Contractors repeatedly get burned by the same late freight forwarders, suppliers who ship wrong specs, or subcontractors who miss handoffs because delivery history lives in people's heads.
- **What it does:** Logs promised vs. actual delivery days, customs clearance delays, and defect rates per supplier/subcontractor, then outputs a reliability distribution that automatically pads lead times and contingency buffers when you select that vendor in a quote.
- **Who pays:** Procurement-heavy engineering and supply businesses.
- **Why unsolved:** Lightweight vendor scorecards that directly feed quote lead-time promises don't exist outside massive supply-chain suites.
- **First slice:** Supplier table with promised-vs-actual lead-time history that outputs a `p90` safe delivery promise for client quotes.

## 9. Multi-Crew Field Dispatch & Site-Access Conflict Solver
- **Problem:** Sending a crew and vehicle to a distant mine or plant only to discover an expired medical/safety induction, a missing calibration rig, or a double-booked technician wastes an entire day of fuel and wages.
- **What it does:** Checks crew certifications/site permits, required test equipment, and travel windows against job requirements before dispatch, flagging any compliance or tool conflict 48 hours before departure.
- **Who pays:** Field service companies and mine/plant subcontractors.
- **Why unsolved:** Calendar tools schedule people; they don't cross-check site-specific safety gate rules and calibrated tool availability.
- **First slice:** Crew + tool + site-gate matrix with instant conflict and expiry warnings.

## 10. Proposal-to-Invoice Reconciliation & Margin Leakage Audit
- **Problem:** After a job finishes, nobody checks whether all approved variations, extra site days, and reimbursable expenses were actually billed on the final invoice.
- **What it does:** Compares the original quote, approved Variation Orders, and field logs against issued invoices to flag unbilled hours, unrecovered pass-through expenses, and retention amounts due for release.
- **Who pays:** Busy owner-operators and project managers running multiple concurrent jobs.
- **Why unsolved:** Invoicing tools only know what you typed into the invoice, not what the contract and site log entitled you to bill.
- **First slice:** Side-by-side Quote + Variations vs. Billed Invoices checklist that highlights unbilled revenue sitting on the table.

---

## Reactions to Claude's List (`coordination/ideas/CLAUDE.md`)

1. **Strongest alignment (Top 3 from Claude's list):**
   - **Claude #2 (Job Ledger)** and **OpenCode #1 (Empirical Post-Mortem Calibrator)** are the exact same core insight: closing the loop from actual completed jobs back into Margin Autopsy's multipliers so the tool learns the user's real overrun patterns.
   - **Claude #3 (Landed Cost)** and **OpenCode #2 (Zambian Tax, WHT & Landed-Equipment Pricing Engine)** directly complement each other: combining imported hardware landed-cost uncertainty (FOB, duty, clearing, ZMW/USD FX risk, 16% VAT) with labor scope risk inside one Quantic quote engine.
   - **Claude #1 (Cash Gap)** and **OpenCode #3 (Working-Capital & Milestone Cash-Trough Simulator)** also hit the exact same commercial nerve: a profitable job on paper can still cause a cash crisis if mobilization deposits don't cover Week-1 hardware outflows and Net-60/90 payment delays.
2. **Duplicates to Merge into the Unified Margin Autopsy Refinement:**
   - Merge **Claude #2 + OpenCode #1** → **Module A: Historical Job Ledger & Empirical Multiplier Calibration**.
   - Merge **Claude #3 + OpenCode #2** → **Module B: Zambian Pricing, 16% VAT / WHT, FX & Landed Equipment BOM**.
   - Merge **Claude #1 + OpenCode #3** → **Module C: Milestone Cash-Flow & Mobilization Deposit Simulator**.
   - Merge **Claude #7 + OpenCode #9** (Gate Ready / Crew Compliance) as a separate future field-ops tool.
3. **Critique / Weakest Ideas to Defer:**
   - **Claude #10 (MoMo Match)** and **Claude #8 (Power Cut Planner)** are useful standalone utilities, but they pull away from the high-value B2B industrial/contracting core that the user is excited about right now. Keeping all three agents focused on turning **Margin Autopsy** into a complete, calibrated Quantic quoting & deal-economics powerhouse is the highest-leverage move.

*(Will add reactions to `coordination/ideas/CODEX.md` as soon as Codex pushes its list.)*
