# Second Cut

Enter usable offcuts to find objects you can make from that inventory. The sample opens with two sheets, a 3 mm example blade kerf and four available tools. Each displayed option has passed an independent reconstruction of its cuts. Options compete for the same stock.

## Run locally

From the repository root:

```sh
cd codex/second-cut
npm test
npm run dev
```

Open http://localhost:4173. Use Node 20+ for the tests and Python 3 for the static server. No dependency installation or build step is required. Localhost and HTTPS support offline reopening after the service worker finishes installing. A plain HTTP address on the workshop LAN also supports editing, planning, backup and undo while the server is reachable. Existing Web Locks installations retain their localStorage inventory. On browsers without Web Locks, IndexedDB keeps the saved snapshot and checks it inside the same transaction that replaces it. Tabs with stale data reload before a retry. Each browser origin has its own inventory; use a JSON backup to move it.

## Try the sample

1. Select a build option. The packet gives exterior dimensions, material, thickness, source IDs, component sizes, cut origins, kerf, tools and assembly steps. Activate a part button by keyboard or click a rectangle to highlight its matching entry.
2. Remove sample Sheet A to isolate the 163 × 163 mm sheet. At 3 mm kerf it fits four 80 mm tiles. Change kerf to 3.1 mm and that option disappears. Switch back to 3 mm to recover it.
3. Select **Enter measurements** to use separate width, height and quantity fields. Press Enter to add the batch and select the width for the next piece. Alternatively, paste usable dimensions such as `500x300x2,420x180`. The third value creates independent physical pieces. Width and height permit one decimal place. Assign material, thickness, grain and rotation to the batch.
4. Print the packet or confirm a build. Confirmation consumes only referenced sheets. Retained remnants need two dimensions of at least 30 mm, an explicit prototype shop policy. Undo restores the previous inventory even after a browser refresh. Adding, removing or replacing inventory can clear the last undo record. Export the JSON backup before moving between browsers.

## What a result means

Search tries a finite size grid for a tray, divided box and tile set, with one or two jointly planned product units. A tile set contains four tiles. Assembled recipes assume 6–12 mm plywood or MDF, dry-fit inset floors, end walls between long walls and, in the divided box, a divider standing on the floor. Review joinery, actual thickness, tool setup and fit before fabrication. These are prototype dimensions awaiting a physical build.

Every cut spans the current rectangular region. Stock measurements already exclude edge trim. The narrow kerf strip is removed after the marked offset. Exact fits need no cut. The model requires two positive child regions for an actual cut, including at the sheet edge. It uses integer tenths of a millimeter and does not mix stock materials or thicknesses within an option. Separate options cannot be combined into one packet.

Search is deterministic and bounded. It ranks found plans by quantity, fraction of consumed area used for parts, then cut count. A budget or a heuristic miss can leave a feasible build undiscovered. The displayed list is capped at twelve. Geometry checks establish neither optimality nor real-world fit, strength or demand.

## Verification

The Node suite covers joint geometry, a kerf-sensitive sample, tools, rotation, grain, deterministic search, stale source revisions, independent area reconstruction, malformed trees, atomic inventory limits and backup/undo. A separate tiny exhaustive guillotine oracle checks 72 fixed-orientation cases using all split positions and part partitions.

Browser checks on Chromium exercised the actual module worker, a 390 px viewport, keyboard part selection, paste entry, edits, confirmation, refresh, undo, JSON export, rejected import, corrupted storage recovery, concurrent tabs, a printed PDF and offline reload. The plain HTTP browser fixture also verified the absence of Web Locks and randomUUID, an actual conflicting pair of IndexedDB writes, migration of an earlier snapshot and reversible builds after reload. Automated entry used a 390 px viewport. Other browser engines, a timed trial with a person and a fabrication trial remain open.

To repeat the plain HTTP browser check, start the server on port 4173 and run
`node checks/browser-http.cjs` from this directory in an environment with
Playwright and its Chromium installed. Optionally set `CHROMIUM_EXECUTABLE` to a
Chromium binary. The script routes a non-secure test origin to the local server
and uses fresh, isolated browser stores.
