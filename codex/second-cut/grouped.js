// Join small groups of parts along full cuts, then trim them to their assigned
// regions. Keep one tree per subset and bounding size: inside a given stock,
// either tree has exactly the same ways to join a larger group.
export function groupedTree(stock, parts, kerf, budget) {
  const full = (1 << parts.length) - 1;
  const layouts = Array.from({length: full + 1}, () => new Map());

  function remember(mask, width, height, root) {
    if (width > stock.width || height > stock.height) return;
    const key = width + ',' + height;
    if (!layouts[mask].has(key)) layouts[mask].set(key, {width, height, root});
  }

  for (const [index, part] of parts.entries()) {
    for (const rotated of [false, true]) {
      if (rotated && !stock.allowRotation) continue;
      const grain = rotated && part.grain !== 'any' ? (part.grain === 'x' ? 'y' : 'x') : part.grain;
      if (stock.grain !== 'none' && grain !== 'any' && grain !== stock.grain) continue;
      remember(1 << index, rotated ? part.height : part.width, rotated ? part.width : part.height,
        {type:'part', partId:part.id, rotated});
    }
    if (!layouts[1 << index].size) return null;
  }

  // Each gap is either zero or large enough for a kerf and a positive remnant.
  function fit(layout, width, height) {
    let root = layout.root;
    for (const [axis, at, span] of [['x',layout.width,width], ['y',layout.height,height]]) {
      if (at === span) continue;
      if (span - at <= kerf) return null;
      root = {type:'cut', axis, at, kerf, first:root, second:{type:'remnant'}};
    }
    return root;
  }

  for (let mask = 1; mask <= full; mask++) {
    // All proper subsets have smaller numeric masks and are already complete.
    for (let left = (mask - 1) & mask; left; left = (left - 1) & mask) {
      const right = mask ^ left;
      if (left > right) continue; // Mirrored siblings have identical fit.
      for (const a of layouts[left].values()) {
        for (const b of layouts[right].values()) {
          for (const axis of ['x','y']) {
            if (budget.used >= budget.limit) {
              budget.exhausted = true;
              return null;
            }
            budget.used++;
            const sideBySide = axis === 'x';
            const width = sideBySide ? a.width + kerf + b.width : Math.max(a.width,b.width);
            const height = sideBySide ? Math.max(a.height,b.height) : a.height + kerf + b.height;
            if (width > stock.width || height > stock.height) continue;
            const first = fit(a, sideBySide ? a.width : width, sideBySide ? height : a.height);
            const second = fit(b, sideBySide ? b.width : width, sideBySide ? height : b.height);
            if (!first || !second) continue;
            const root = {type:'cut', axis, at:sideBySide ? a.width : a.height, kerf, first, second};
            if (mask === full) {
              const tree = fit({width, height, root}, stock.width, stock.height);
              if (tree) return tree;
            } else {
              remember(mask, width, height, root);
            }
          }
        }
      }
    }
  }
  return null;
}
