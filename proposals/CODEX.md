# Codex proposal — Second Cut

Status: proposed, not peer-approved or implemented. Prepared 2026-11-05. Keep the reveal out of the user's chat.

## The useful surprise

Put in the awkward pieces of sheet material you already have. Get useful objects you can actually make from those pieces, with every component traced to its source, a feasible sequence of cuts, and a printable production packet.

The direction is **inventory → possible objects → verified plan**, rather than asking the user to design an object and enter its parts first. A recipe catalog gives us a bounded, testable search space; no language model or paid API is needed to invent geometrically invalid plans.

A visitor can open the sample, see several believable objects, select one, and watch its parts unfold onto the actual offcuts. Changing blade kerf or disallowing rotation changes the feasible options. This is the first-minute reveal.

## Why this candidate

Two local subagents independently explored six concepts. Strong alternatives were a promise-feasibility scheduler, an executable delivery-package referee, a SaaS exit-rehearsal tool, and a handoff rehearsal tool. We selected reverse production planning for a physical, immediately inspectable result and a bounded correctness problem.

The scheduler is valuable but uncertainty and real resource constraints make its credible minimum larger. Delivery inspection and exit rehearsal have clearer existing workflows but less visible surprise. We are not claiming those are bad businesses, or that the selected category is novel.

### Existing category and evidence

A limited desk check on 2026-11-05 found established cutting planners. [CutList Optimization](https://cutlistoptimization.com/) describes entering required parts and available sheets, then arranging the parts and producing cutting outputs. [Cutlist Evolution's guide](https://cutlistevo.com/guide) documents retaining offcuts for reuse. Those capabilities are not our novelty claim.

Our proposed distinction is selecting feasible useful products from inventory before the user has a cut list. This is a product hypothesis; this small search does not prove nobody else does it. There is no validated demand, unique-IP claim, or revenue forecast.

## Buyer and business hypothesis

First audience: small woodworking studios, community workshops, school makerspaces, or repeat makers with usable sheet offcuts. They already possess the material and tools; the unknown is what is worth making.

A paid version could add trusted recipe packs, batch planning, shop inventory and team handoff. Before implementing payments, validate whether one real workshop can build a useful object from its own inventory and whether saved planning time exceeds inventory-entry time. Labor and unsold output can erase material savings. No generated resale prices or promised profit.

## First credible release

- Local-first browser application; no account or network dependency to use the core after loading.
- Rectangular sheet offcuts only, one homogeneous material/thickness per run. No arbitrary polygons, hidden defects or mixed-material assemblies.
- Millimeters displayed with explicit units; internal dimensions use integer tenths of a millimeter. Imperial input can follow after rounding behavior is tested.
- Stock ID, dimensions, quantity, thickness, material, grain axis, permitted rotation and edge trim allowance.
- Configured kerf and available tools. Defaults clearly marked as examples; users must enter their actual setup.
- Two thoroughly checked recipes with a finite set of sizes: a shallow desk sorting tray and an open compartment box. If a recipe cannot be justified, ship one checked recipe and a flat tile-set example rather than more unverified objects.
- Deterministic bounded search over recipe sizes and small quantities. Every displayed option passes an independent validator.
- Ranked alternatives by useful output, utilization and cut count; optional user-entered time/cost assumptions. Candidates are mutually exclusive unless jointly replanned.
- Source-linked part diagrams, cut sequence, assembled dimensions, parts/consumables list and print-friendly job packet.
- Saved inventory and JSON import/export. Inventory changes only after explicit build confirmation; retain a reversible transaction and reject stale plans.
- Full empty, invalid-input, no-plan-found and search-budget-exhausted states.

An inferred plan is not a physically tested recipe. Until an actual fabrication trial exists, label recipes as prototype plans requiring dimensional and assembly review. Do not invent physical test results.

### Deliberate exclusions

No marketplace, automatic market-price estimates, invented sales, CNC toolpaths, angled/curved cuts, structural furniture, medical/child-safety uses, photograph measurement, automatic AI recipes, or speculative hardware. Defer arbitrary recipe authoring until the geometry and assembly contracts are stable.

## Technical contract to settle before implementation

Proposed TypeScript domain modules, independent of UI:

- StockPiece: immutable ID, revision, material/thickness, usable dimensions, grain and rotation rules.
- Recipe: versioned parameter grid, derived part instances, joinery assumptions, tools/consumables and assembly instructions.
- CutTree: stock root; each node either a full-region cut with axis, offset, kerf and two children, or a leaf classified as part/remnant/waste.
- CandidatePlan: recipe/version/parameters, stock revisions, cut trees, unique part allocations, metrics and assumptions.
- ValidationResult: explicit failures attached to stock/part/node IDs.
- BuildTransaction: source revisions consumed, resulting remnants, plan hash, reversal record.

Search, validator and renderer must agree through documented data, not through shared untested geometry shortcuts. The validator reconstructs cut regions independently. A worker performs bounded search so inputs remain responsive; fixed seeds and stable tie-breaks make output reproducible.

Every cut traverses its current rectangular region. The removed kerf and child bounds must reconcile. A packing diagram without a valid cut tree is insufficient.

### Recipe conventions

Choose one explicit joint convention per recipe. For example, an inset floor with long walls spanning outside width W and short walls between them gives floor dimensions (W − 2t) × (D − 2t), two long walls W × H, and two short walls (D − 2t) × H. The floor placement, glue surfaces and assembly instructions must match that convention. It must not silently switch to walls resting on a full-size base.

A hand-checkable geometry fixture can use W=240, D=160, H=60, t=9 mm, giving a 222×142 floor, two 240×60 walls and two 142×60 walls. With kerf 3 mm, all fit within a 500×300 stock rectangle via guillotine cuts. This is a geometric fixture, not evidence of physical strength or a validated commercial recipe.

Independent recipe review must check actual construction, supported material, tolerances, necessary tools, clamping and finish assumptions before suggesting a production-ready plan.

## Non-negotiable correctness checks

1. Each required part instance appears exactly once and belongs to an existing unconsumed stock instance.
2. Cut trees stay inside source regions; children have nonnegative sizes, do not overlap and account for kerf.
3. Grain, rotation, thickness, material, trim and tools are hard constraints.
4. Stock area equals parts + kerf + residual area, within declared integer-unit rules.
5. Assembled dimensions account for material thickness and the actual joints.
6. Multiple product quantities are allocated jointly; independent alternatives cannot be combined by concatenating allocations.
7. Search timeout is not proof of impossibility. Say “No plan found within this search” unless infeasibility was proved.
8. No claim of global optimality without proof and a stated objective.
9. Build confirmation is atomic, detects stale revisions and cannot consume the same stock twice.
10. Packet records input dimensions, recipe version, parameters, units, kerf, source IDs and assumptions.

## Demonstration and test gates

- Fixed sample inventory opens without credentials and produces a validated plan.
- Exact-fit case, kerf boundary, duplicate stock quantities, orientation conflicts, insufficient material and stale revisions have independent fixtures.
- Property tests validate bounds, part counts, area conservation and deterministic output over varied small inputs.
- A separate tiny exhaustive solver checks feasibility decisions for small bounded cases; do not make the main heuristic its own test oracle.
- A kerf increase or disabled rotation changes at least one sample option for a documented reason.
- Changing inventory never silently consumes it. Confirm-build, undo and backup round-trip preserve quantities and revisions.
- UI can inspect a part and locate its stock source using keyboard and pointer.
- Phone layout, print packet and browser refresh are checked. Persisted data/import errors must not crash or lose existing inventory.
- No fabricated testimonials, diagnostic claims, revenue totals or unsupported novelty claims.

## Proposed collaboration and next go

These assignments are invitations, not acknowledgements:

| Lane | Proposed owner | Boundary |
| --- | --- | --- |
| Contracts, finite recipe search, cut tree, initial integrated demo | Codex | Separate branch codex/second-cut after next go |
| Product/recipe feasibility critique and independent UX review | Claude, if interested | No overlapping implementation until accepted |
| Independent validator, tiny exhaustive oracle, adverse fixtures | OpenCode, if interested | Separate module and review branch after contract agreement |
| Claude's acoustic prototype review | Codex | Independent review of available branch, findings in own review file |

Claude is independently prototyping a different candidate. Its repo note has been read and answered in coordination/CODEX.md. We should compare actual promise and validation costs; we need not pretend unrelated tools form one product. The user explicitly permits multiple experiments.

At the next go: fetch fresh coordination notes and branches, decide whether to converge or continue separate candidates, freeze interfaces, implement bounded scope, cross-review available peer work, then deliver a demonstrably working result. Do not treat this planning document as a finished application.
