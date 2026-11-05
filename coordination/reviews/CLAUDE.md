# Reviews by Claude

## Codex proposal: Second Cut (`proposals/CODEX.md` at 13334d8)

Reviewed: the proposal document only (no code exists yet). Nothing was run.

**Strengths**
- The inversion (inventory to possible objects, rather than object to cut list) is a real product idea and the proposal is honest that cut planners exist.
- Correctness discipline is excellent: an independent validator reconstructing guillotine regions, area conservation, an exhaustive oracle for small cases, "no plan found within this search" instead of claiming infeasibility, atomic build transactions. That list is most of what makes such a tool trustworthy.
- Integer tenths of a millimetre and the explicit joint convention with a hand-checkable fixture (240 x 160 x 60, t = 9) are the right level of rigour. I checked the fixture: floor (240 - 18) x (160 - 18) = 222 x 142, walls 240 x 60 and 142 x 60. Correct for walls inset on the short sides and a floor inset inside all four walls.

**Risks, in order of importance**
1. **Inventory entry is the adoption bottleneck, not planning.** Measuring and typing ten offcuts with grain and quantity is several minutes of work before any value appears. If that takes longer than the maker's own judgement ("that piece will do for a tray"), nobody returns. Suggest testing entry speed first: a keypad-first entry row (W, D, qty, Enter), size presets, and duplicate-last. Worth one acceptance criterion: a 10-piece inventory entered in under two minutes.
2. **Two recipes make "what can I make" thin.** With a tray and a box, the answer is nearly always "a tray or a box, at size X". The surprise lands only when the option list is varied. Parametric recipes help (size grids already planned), but the catalogue breadth is the product. Consider which 5 to 8 objects a small shop sells (shelf, planter, drawer divider, serving board, wall shelf with cleat) and verify those, even if the first release ships two.
3. **Desirability is not ranked.** Utilisation and cut count say which plan is efficient, not which object is worth the time. A simple user-entered "value" or "I need this" flag per recipe would make the ranking meaningful without inventing prices.
4. **Guillotine assumption.** Right for table and panel saws; state it in the UI so a jigsaw or CNC user understands why a visually obvious fit is rejected.
5. **Market fit for this user specifically.** Furniture and joinery workshops are common locally and offcut waste is real, so there is a buyer. It is further from the user's own engineering background than a maintenance tool, which matters for who can sell it. Not a reason to drop it; the user explicitly allowed several experiments.

**Verdict:** worth building as specified. I would gate the first demo on criterion 1 (entry speed) as much as on the solver tests.
