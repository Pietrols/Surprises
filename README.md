# Surprises — Multi-Agent Engineering Suite

Three complete, zero-dependency, local-first web applications conceived, built, cross-reviewed, and verified across three independent agents (**Claude**, **Codex**, and **OpenCode**).

Every application runs directly in any modern browser with zero external runtime dependencies, zero required accounts or API keys, printable deliverables, and an automated `node --test` verification suite.

---

## The Three Applications

| # | Application | Directory | What It Does | Test Suite |
|---|---|---|---|---|
| **1** | **Auscult** *(Claude + OpenCode PWA/DSP lanes)* | [`claude/auscult/`](claude/auscult/) | **Acoustic Machine Condition Screening.** Uses a phone microphone (or built-in physical motor/pump simulator or voice recording) to learn a rotating machine's healthy acoustic baseline, track a 0–100 health index across ISO-style A–D severity zones, and diagnose bearing defects (`BPFO`, `BPFI`, `2x BSF`, `FTF`), imbalance, misalignment, looseness, cavitation, and electrical hum—with one-click printable client condition reports. | `npm --prefix claude/auscult test` (**32/32 passing**) |
| **2** | **Second Cut** *(Codex + OpenCode oracle/fixtures)* | [`codex/second-cut/`](codex/second-cut/) | **Reverse Sheet-Material Production Planner.** Enter the awkward sheet offcuts you already have in the workshop (`500x300x2, 420x180`) and discover verified, joinery-checked objects you can fabricate right now. Uses a bounded guillotine cut-tree solver verified by an independent region-reconstructing validator, atomic build/undo inventory transactions, interactive SVG part-to-sheet diagrams, and printable shop job packets. | `npm --prefix codex/second-cut test` (**13/13 passing**) |
| **3** | **Margin Autopsy** *(OpenCode)* | [`opencode/margin-autopsy/`](opencode/margin-autopsy/) | **Fixed-Bid & Scope-Drift X-Ray.** Paste a project scope, feature list, or engineering brief along with your quote price and target hourly rate (`USD`, `ZMW`, `EUR`, `GBP`). Decomposes every deliverable against 9 software and industrial field-commissioning risk triggers, runs a 2,000-trial seeded Monte Carlo simulation (`p10` / `p50` / `p90`), lets you perform live contractual Scope Surgery (*Core Fixed*, *Capped Allowance*, *Phase-2 Option*), and generates ready-to-paste **Change-Order Shields** plus a printable **Client Scope & Boundary Schedule**. | `npm --prefix opencode/margin-autopsy test` (**11/11 passing**) |

---

## Run Everything Locally

You can launch any individual tool in its directory or serve the root repository to browse all three from one unified portal:

```bash
# Serve the unified launchpad + all 3 apps from the repository root:
python3 -m http.server 5170
# Open http://localhost:5170
```

Or run each test suite directly with Node (v20+):

```bash
npm --prefix claude/auscult test
npm --prefix codex/second-cut test
npm --prefix opencode/margin-autopsy test
```

---

## Cross-Agent Coordination & Review Trail

- **Proposals:** [`proposals/CODEX.md`](proposals/CODEX.md), [`proposals/OPENCODE.md`](proposals/OPENCODE.md)
- **Coordination logs:** [`coordination/CLAUDE.md`](coordination/CLAUDE.md), [`coordination/CODEX.md`](coordination/CODEX.md), [`coordination/OPENCODE.md`](coordination/OPENCODE.md)
- **Peer code & mathematical reviews:** [`coordination/reviews/CLAUDE.md`](coordination/reviews/CLAUDE.md), [`coordination/reviews/CODEX.md`](coordination/reviews/CODEX.md), [`coordination/reviews/OPENCODE.md`](coordination/reviews/OPENCODE.md)
