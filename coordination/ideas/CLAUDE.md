# Claude: 10 project ideas (ranked)

Lens: the user's own stated reaction. Pricing won, so the top three extend Margin Autopsy into a pricing and cash suite for small engineering contractors. The rest come from his daily work (field reports, analyzer calibration, mine site access) and from problems specific to doing business in Zambia (imports, power cuts, mobile money, public tenders). Each idea names a first slice small enough to work end to end in one cycle.

## 1. Cash Gap: will this job sink me before I get paid?
- **Problem:** a profitable job can still bankrupt a small contractor. Materials and wages go out in week 1; large clients often pay 60 to 90 days after invoice, sometimes later.
- **What it does:** takes a job (costs by week, invoice milestones, payment terms) and simulates late payment, exchange rate moves and overruns. Answers: lowest cash point and when, how much working capital you need, and what deposit or mobilisation fee makes the job safe. Runs across all open jobs at once.
- **Who pays:** small contractors and suppliers to mines and government.
- **Why unsolved:** accounting tools look backwards; Margin Autopsy checks profit, not timing.
- **First slice:** one job, weekly cost profile, two milestones, payment delay distribution, chart of cash balance with p10/p50/p90 bands.

## 2. Job Ledger: price from your own history, not guesses
- **Problem:** Margin Autopsy's risk multipliers are educated guesses.
- **What it does:** record each finished job (quoted hours and costs, actual hours and costs, what went wrong, tagged by type). It learns your own overrun factors per work type and risk tag and feeds them back into Margin Autopsy. Each job also stores photos and client sign-off, so the same record later becomes evidence for tenders (see 4).
- **Who pays:** any firm that quotes repeatedly; the data makes the tool more valuable the longer it is used.
- **Why unsolved:** job costing exists in big ERPs, not as a light tool that closes the loop into the next quote.
- **First slice:** add five past jobs; the dashboard shows your real overrun by work type; Margin Autopsy uses those numbers instead of defaults.

## 3. Landed Cost: what does this import really cost by the time it reaches site?
- **Problem:** quoted equipment from abroad gets more expensive between quote and delivery: freight, insurance, duty, VAT, clearing, transport and the Kwacha moving while it is in transit.
- **What it does:** builds the landed cost from FOB price with user-entered duty and fee rates, models exchange rate and lead time uncertainty, and outputs a safe price line plus a quote-validity period. Exports a cost line straight into Margin Autopsy.
- **Who pays:** importers, installers and contractors who quote imported equipment.
- **Why unsolved:** people do this in private spreadsheets and get the currency risk wrong.
- **First slice:** one item, editable rate table, exchange rate band, landed cost range and "hold this price for N days".

## 4. Tender Radar: find the jobs, and know in 5 minutes whether to bid
- **Problem:** public and mining tenders are scattered, deadlines are missed, and bids get disqualified for an expired certificate.
- **What it does:** collects tender notices from public sources the user points it at, matches them against the company's capabilities, and builds a go/no-go card: deadline, required registrations, the missing documents, and a first-pass price via Margin Autopsy. Uses the Job Ledger to draft evidence-based capability statements.
- **Who pays:** small and medium contractors; a subscription per company.
- **Why unsolved:** large firms have bid teams; small ones read newspapers and portals by hand.
- **First slice:** paste or upload one tender document; get the go/no-go card and a compliance checklist against the company's stored documents.

## 5. Site Report Copilot: talk on site, get the report
- **Problem:** field engineers lose hours writing up site visits, and quality varies.
- **What it does:** offline phone capture of voice notes, photos and readings per site, then a structured report in a fixed house format (Summary, Current State, per-site sections, Next Steps) exported as a Word file. Tracks open items across visits so "Next Steps" from last time are checked off this time.
- **Who pays:** field service companies, OEM service partners, consultants.
- **Why unsolved:** generic note apps do not produce a client-ready, consistent report or carry actions from visit to visit.
- **First slice:** one visit with two sites, typed notes plus photos, generates the Word report in the house format.

## 6. Drift Watch: catch an analyzer going wrong before the assays do
- **Problem:** online analyzers, lab instruments and scales drift. Check-standard readings are logged but rarely charted, so drift is found after bad numbers have gone into production decisions.
- **What it does:** log check-standard and reference readings per instrument; control charts with standard rules (trend, shift, out of limits) and CUSUM for slow drift; flags drift early, records the corrective action, and produces a calibration and verification record per instrument.
- **Who pays:** mine labs, concentrators, analyzer service companies (it is also a selling point for the service company that runs it).
- **Why unsolved:** laboratory systems do this for lab instruments; field analyzers and plant instruments often sit in spreadsheets.
- **First slice:** one instrument, one element, 30 readings pasted in, chart with rule violations highlighted and a printable record.

## 7. Gate Ready: never get turned away at the mine gate
- **Problem:** contractor staff and companies need current documents to work on site (tax clearance, statutory registrations, insurance, inductions, medicals, permits). One expired item stops a job.
- **What it does:** a register of company and per-person documents with expiry dates, per-site requirements, and alerts 30/14/7 days out; a "ready for site X on date Y" check for a crew.
- **Who pays:** contractors and labour-supply firms working on mines and plants.
- **Why unsolved:** HR systems track employees, not site-specific readiness across subcontractor crews.
- **First slice:** company documents plus three people and one site's requirement list; a crew readiness check with what is missing.

## 8. Power Cut Planner: size backup power from how you actually lose power
- **Problem:** businesses buy solar, batteries or generators by guesswork and end up oversized, undersized or burning diesel.
- **What it does:** from an appliance list and the outage pattern the user experiences, sizes inverter, battery and panels, compares running cost against diesel and grid over five years, and produces a quote. Quantic sells and installs.
- **Who pays:** shops, clinics, offices, farms; installers as a sales tool.
- **Why unsolved:** installer calculators assume steady sun and ignore the outage pattern, which is what decides battery size.
- **First slice:** appliance list plus a daily outage pattern, recommended system and five-year cost comparison.

## 9. Spares Brain: which spare parts to keep on the shelf
- **Problem:** with long import lead times, small plants either tie up cash in shelves of spares or wait weeks for a part while a machine sits idle.
- **What it does:** for each critical part, combines failure history, lead time, part cost and the cost of downtime to recommend hold or don't hold, minimum stock and reorder point, and shows the cash tied up against the downtime risk avoided.
- **Who pays:** small mines, mills, water utilities, contractors running fleets; pairs naturally with Auscult.
- **Why unsolved:** big ERPs do it with data small plants do not have; this works from rough estimates.
- **First slice:** ten parts in a table, recommendations and a cash vs risk summary.

## 10. MoMo Match: reconcile mobile money against invoices
- **Problem:** small businesses get paid by mobile money with references that do not match invoices; reconciling statements by hand takes hours and loses money.
- **What it does:** import mobile money and bank statements, fuzzy-match payments to invoices (amount, date window, name, reference), and list unmatched items and who still owes.
- **Who pays:** SMEs, schools, landlords, clinics.
- **Why unsolved:** accounting tools focus on bank feeds; mobile money exports are messy and per-network.
- **First slice:** one statement export plus an invoice list; matched, probable and unmatched columns.

## If the user wants one thing next

Ideas 1, 2 and 3 are one product: **a pricing and cash suite with Margin Autopsy at its centre.** Margin Autopsy answers "will this job make money", Landed Cost fixes the biggest uncertain cost line, Job Ledger replaces guessed risk factors with his own history, and Cash Gap answers "can I survive until I'm paid". That fits his one-project-at-a-time rule and builds on the tool he already likes. My proposed order: Job Ledger, then Cash Gap, then Landed Cost.

## Reactions to the other lists

(To be added once CODEX.md and OPENCODE.md exist.)
