// Adverse contract fixtures and independent tiny exhaustive guillotine oracle
// contributed by OpenCode against codex/second-cut/CONTRACT.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validatePlan } from '../validate.js';
import { parseStockText, commitBuild, undoBuild } from '../inventory.js';
import { planParts, findPlans } from '../engine.js';

/**
 * Tiny independent exhaustive guillotine oracle for 1 stock rectangle and up to 3 parts.
 * Returns true if and only if there exists a sequence of guillotine cuts with blade kerf `kerf`
 * placing all `parts` into `stock`.
 */
export function exhaustiveGuillotineOracle(regionW, regionH, parts, kerf, stockGrain = 'none', allowRotation = true) {
  if (parts.length === 0) return true;
  if (regionW <= 0 || regionH <= 0) return false;

  const orientationsFor = (part) => {
    const opts = [];
    const unrotGrainOk =
      stockGrain === 'none' || part.grain === 'any' || part.grain === stockGrain;
    if (unrotGrainOk) opts.push({ w: part.width, h: part.height, rotated: false });

    if (allowRotation) {
      const rotGrain = part.grain === 'x' ? 'y' : part.grain === 'y' ? 'x' : 'any';
      const rotGrainOk = stockGrain === 'none' || rotGrain === 'any' || rotGrain === stockGrain;
      if (rotGrainOk && (part.width !== part.height || !unrotGrainOk)) {
        opts.push({ w: part.height, h: part.width, rotated: true });
      }
    }
    return opts;
  };

  if (parts.length === 1) {
    const p = parts[0];
    for (const o of orientationsFor(p)) {
      const fitsW = o.w === regionW || o.w + kerf < regionW;
      const fitsH = o.h === regionH || o.h + kerf < regionH;
      if (fitsW && fitsH) return true;
    }
    return false;
  }

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const rest = parts.filter((_, idx) => idx !== i);
    for (const o of orientationsFor(p)) {
      if (o.h <= regionH && (o.h === regionH || o.h + kerf < regionH)) {
        if (o.w + kerf < regionW) {
          const rightW = regionW - o.w - kerf;
          if (exhaustiveGuillotineOracle(rightW, regionH, rest, kerf, stockGrain, allowRotation)) {
            return true;
          }
        }
      }
      if (o.w <= regionW && (o.w === regionW || o.w + kerf < regionW)) {
        if (o.h + kerf < regionH) {
          const botH = regionH - o.h - kerf;
          if (exhaustiveGuillotineOracle(regionW, botH, rest, kerf, stockGrain, allowRotation)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

test('independent exhaustive guillotine oracle agrees with planParts on kerf boundaries and trailing-gap traps', () => {
  const mkStock = (w, h, grain = 'none', allowRotation = true) => ({
    id: 'stk_oracle',
    revision: 0,
    label: 'Oracle Sheet',
    width: w,
    height: h,
    thickness: 90,
    material: 'Plywood',
    grain,
    allowRotation,
  });
  const settings = { kerf: 30, tools: ['saw', 'glue', 'clamps', 'sandpaper'] };

  const cases = [
    // Exact fit with kerf: 235 + 30 + 235 = 500
    { w: 500, h: 100, parts: [{ id: 'a', label: 'A', width: 235, height: 100, grain: 'any' }, { id: 'b', label: 'B', width: 235, height: 100, grain: 'any' }], expected: true },
    // 1 unit over kerf limit: 236 + 30 + 235 = 501 > 500
    { w: 500, h: 100, parts: [{ id: 'a', label: 'A', width: 236, height: 100, grain: 'any' }, { id: 'b', label: 'B', width: 235, height: 100, grain: 'any' }], expected: false },
    // Trailing gap smaller than kerf: part width 485 on 500 sheet with kerf 30 leaves 15 < 30 (cannot make terminal cut)
    { w: 500, h: 100, parts: [{ id: 'a', label: 'A', width: 485, height: 100, grain: 'any' }], expected: false },
    // Trailing gap of 31 with kerf 30 leaves 1-unit positive remnant: valid!
    { w: 500, h: 100, parts: [{ id: 'a', label: 'A', width: 469, height: 100, grain: 'any' }], expected: true },
  ];

  for (const c of cases) {
    const oracleSays = exhaustiveGuillotineOracle(c.w, c.h, c.parts, settings.kerf);
    assert.equal(oracleSays, c.expected);
    const engineRes = planParts([mkStock(c.w, c.h)], c.parts, settings);
    assert.equal(Boolean(engineRes && engineRes.trees.length), oracleSays);
  }
});

test('adverse contract fixtures against validatePlan, parseStockText, and commitBuild', () => {
  // 1. Shorthand stock parser decimal & quantity test
  const parsed = parseStockText('500x300x2, 420.5x180', {
    thickness: 90,
    material: 'Plywood',
    grain: 'x',
    allowRotation: true,
  });
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].width, 5000);
  assert.equal(parsed[0].height, 3000);
  assert.equal(parsed[2].width, 4205);

  const stock = {
    id: 'stk_1',
    revision: 0,
    label: 'Birch',
    width: 5000,
    height: 3000,
    thickness: 90,
    material: 'Plywood',
    grain: 'x',
    allowRotation: true,
  };
  const settings = { kerf: 30, tools: ['saw', 'glue', 'clamps', 'sandpaper'] };

  // 2. Adverse fixture: trailing gap smaller than kerf must fail validation
  const badKerfGapPlan = {
    id: 'cand_bad_gap',
    recipeId: 'tray',
    recipeVersion: 1,
    title: 'Bad Gap Tray',
    description: 'Adverse fixture',
    width: 4980,
    depth: 3000,
    height: 600,
    quantity: 1,
    thickness: 90,
    material: 'Plywood',
    requiredTools: ['saw'],
    instructions: ['Cut'],
    parts: [{ id: 'p1', label: 'Base', width: 4980, height: 3000, grain: 'x' }],
    trees: [
      {
        stockId: 'stk_1',
        revision: 0,
        root: {
          type: 'cut',
          axis: 'x',
          at: 4980,
          kerf: 30,
          first: { type: 'part', partId: 'p1', rotated: false },
          second: { type: 'remnant' },
        },
      },
    ],
  };

  const res = validatePlan(badKerfGapPlan, [stock], settings);
  assert.equal(res.ok, false, 'Validator must reject cut where at + kerf >= region dimension');

  // 3. Adverse fixture: grain 'none' stock MUST allow rotated part with grain 'x'
  const mdfStock = { ...stock, id: 'stk_mdf', grain: 'none', allowRotation: true };
  const validRotatedMdfPlan = {
    ...badKerfGapPlan,
    id: 'cand_mdf_rot',
    parts: [{ id: 'p1', label: 'Wall', width: 3000, height: 5000, grain: 'x' }],
    trees: [
      {
        stockId: 'stk_mdf',
        revision: 0,
        root: { type: 'part', partId: 'p1', rotated: true },
      },
    ],
  };
  const resMdf = validatePlan(validRotatedMdfPlan, [mdfStock], settings);
  assert.equal(resMdf.ok, true, `Stock with grain 'none' should allow rotated grain 'x' part: ${resMdf.errors?.join('; ')}`);

  // 4. Adverse fixture: multi-sheet mixed material or mixed thickness must fail
  const secondStock = { ...stock, id: 'stk_2', thickness: 120 };
  const mixedThicknessPlan = {
    ...badKerfGapPlan,
    id: 'cand_mixed',
    parts: [
      { id: 'p1', label: 'A', width: 5000, height: 3000, grain: 'x' },
      { id: 'p2', label: 'B', width: 5000, height: 3000, grain: 'x' },
    ],
    trees: [
      { stockId: 'stk_1', revision: 0, root: { type: 'part', partId: 'p1', rotated: false } },
      { stockId: 'stk_2', revision: 0, root: { type: 'part', partId: 'p2', rotated: false } },
    ],
  };
  assert.equal(validatePlan(mixedThicknessPlan, [stock, secondStock], settings).ok, false);
});
