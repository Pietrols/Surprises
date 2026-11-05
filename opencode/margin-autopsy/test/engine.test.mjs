// Run with: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  rng,
  parseScopeText,
  analyzeLineItem,
  runAutopsy,
  RISK_RULES,
} from '../js/engine.js';
import { SCENARIOS } from '../js/scenarios.js';

test('seeded PRNG is strictly deterministic across runs', () => {
  const a = rng(12345);
  const b = rng(12345);
  for (let i = 0; i < 50; i++) {
    assert.equal(a(), b());
  }
});

test('parseScopeText extracts explicit hours, modes, and infers fallback hours', () => {
  const raw = `
    # Comment line ignored
    - Legacy database migration and CSV dump cleanup [16h]
    - Bespoke dark mode animation [12 hrs] [allowance]
    - Real-time collaborative sync (20h) [phase2]
    - Simple CRUD table for tags
  `;
  const items = parseScopeText(raw);
  assert.equal(items.length, 4);

  assert.equal(items[0].baseHours, 16);
  assert.equal(items[0].explicitHours, true);
  assert.equal(items[0].mode, 'core');
  assert.ok(items[0].matchedRules.some((r) => r.id === 'legacy_migration'));

  assert.equal(items[1].baseHours, 12);
  assert.equal(items[1].mode, 'allowance');
  assert.equal(items[1].capHours, 13.8);

  assert.equal(items[2].baseHours, 20);
  assert.equal(items[2].mode, 'phase2');
  assert.equal(items[2].effective.p90, 0);

  assert.equal(items[3].explicitHours, false);
  assert.ok(items[3].baseHours >= 4);
});

test('high-risk scope triggers inflate p50/p90 and attach concrete Change-Order Shields', () => {
  const clean = analyzeLineItem({
    id: 'clean',
    index: 1,
    title: 'Static terms of service page',
    baseHours: 10,
    mode: 'core',
  });
  const risky = analyzeLineItem({
    id: 'risky',
    index: 2,
    title: 'Bi-directional SAP ERP webhook sync with legacy data migration etc.',
    baseHours: 10,
    mode: 'core',
  });

  assert.equal(clean.matchedRules.length, 0);
  assert.ok(risky.matchedRules.length >= 3);
  assert.ok(risky.raw.p50 > clean.raw.p50);
  assert.ok(risky.raw.p90 > clean.raw.p90 * 1.6, `risky p90 ${risky.raw.p90} vs clean p90 ${clean.raw.p90}`);
  assert.equal(risky.riskLevel, 'critical');
  assert.ok(risky.shields.length >= 3);
  for (const s of risky.shields) {
    assert.ok(s.clause.length > 30);
  }
});

test('runAutopsy quantiles obey p10 <= p50 <= p90 and deterministic repeatability', () => {
  const scenario = SCENARIOS[0];
  const items = parseScopeText(scenario.scopeText);
  const res1 = runAutopsy(items, scenario);
  const res2 = runAutopsy(items, scenario);

  assert.deepEqual(res1.current.hours, res2.current.hours);
  assert.ok(res1.current.hours.p10 <= res1.current.hours.p50);
  assert.ok(res1.current.hours.p50 <= res1.current.hours.p90);
  assert.ok(res1.current.hours.p90 <= res1.current.hours.p95);

  // Effective rate is inversely ordered with hours: p10 rate (worst case) <= p50 rate <= p90 rate
  assert.ok(res1.current.effectiveRate.p10 <= res1.current.effectiveRate.p50);
  assert.ok(res1.current.effectiveRate.p50 <= res1.current.effectiveRate.p90);
});

test('applying allowance caps and phase2 options recovers p90 margin and reduces tail hours', () => {
  const scenario = SCENARIOS[0];
  const rawItems = parseScopeText(scenario.scopeText);
  const baseline = runAutopsy(rawItems, scenario);

  // Convert top 2 risky items to allowance and phase2
  const shieldedItems = rawItems.map((it, idx) => {
    if (idx === 2) return analyzeLineItem({ ...it, mode: 'allowance' });
    if (idx === 3) return analyzeLineItem({ ...it, mode: 'phase2' });
    return it;
  });

  const guarded = runAutopsy(shieldedItems, scenario);
  assert.ok(guarded.current.hours.p90 < baseline.current.hours.p90, 'p90 hours must drop when items are capped/phased');
  assert.ok(guarded.current.effectiveRate.p10 > baseline.current.effectiveRate.p10, 'worst-case hourly rate must improve');
  assert.ok(guarded.hoursSavedP90 > 0);
  assert.ok(guarded.marginProtectedP90 > 0);
  assert.ok(guarded.phase2Value > 0);
});

test('all built-in scenarios parse and evaluate cleanly', () => {
  for (const sc of SCENARIOS) {
    const items = parseScopeText(sc.scopeText);
    assert.ok(items.length >= 5, `scenario ${sc.id} has items`);
    const report = runAutopsy(items, sc);
    assert.ok(report.drivers.length === items.length);
    assert.ok(report.safeFixedPrice > 0);
  }
});

test('every RISK_RULE has a valid RegExp and non-empty shield clause', () => {
  for (const r of RISK_RULES) {
    assert.ok(r.pattern instanceof RegExp);
    assert.ok(r.p50Mult > 1.0);
    assert.ok(r.tailSpread > 0.1);
    assert.ok(r.shield.length > 40);
  }
});
