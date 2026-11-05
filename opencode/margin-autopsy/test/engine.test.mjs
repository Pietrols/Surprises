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

test('parseScopeText preserves leading digits in titles like "3D configurator" and "24/7 alerts"', () => {
  const raw = `
    - 3D product configurator with WebGL scene [18h]
    1. 24/7 uptime alert webhook [8h]
    2) 10x batch CSV import utility [6h]
  `;
  const items = parseScopeText(raw);
  assert.equal(items.length, 3);
  assert.equal(items[0].title, '3D product configurator with WebGL scene');
  assert.ok(items[0].matchedRules.some((r) => r.id === 'custom_design_polish'));
  assert.equal(items[1].title, '24/7 uptime alert webhook');
  assert.equal(items[2].title, '10x batch CSV import utility');
});

test('word-sense guards prevent false triggers on technical phrases like "ML model training"', () => {
  const ml = analyzeLineItem({
    id: 'ml',
    index: 1,
    title: 'ML model training pipeline [30h]',
    baseHours: 30,
    mode: 'core',
  });
  const ruleIds = ml.matchedRules.map((r) => r.id);
  assert.ok(!ruleIds.includes('stakeholder_handoff'), `should not match stakeholder_handoff, got ${ruleIds}`);
  assert.ok(ruleIds.includes('vague_scope_weasel'), `should match vague_scope_weasel for ML model training, got ${ruleIds}`);

  const staff = analyzeLineItem({
    id: 'staff',
    index: 2,
    title: 'On-site commissioning, operator training and committee approval [12h]',
    baseHours: 12,
    mode: 'core',
  });
  assert.ok(staff.matchedRules.some((r) => r.id === 'stakeholder_handoff'));
  assert.ok(staff.matchedRules.some((r) => r.id === 'field_site_hardware'));
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

test('moving a clean item to phase2 proportionally reduces Phase-1 revenue instead of faking profit', () => {
  const items = parseScopeText(`
    - Core booking flow [40h]
    - Static terms page [40h]
  `);
  const allCore = runAutopsy(items, { quotePrice: 12000, targetRate: 150, hardCost: 0 });
  assert.equal(allCore.config.activeNetRevenue, 12000);
  assert.equal(allCore.current.effectiveRate.p50, 150);

  // Move half of the clean scope to Phase 2: Phase-1 revenue drops to $6,000 and p50 rate stays ~$150/hr (within Monte Carlo sample noise)
  const halfPhased = items.map((it, idx) => (idx === 1 ? analyzeLineItem({ ...it, mode: 'phase2' }) : it));
  const afterPhase = runAutopsy(halfPhased, { quotePrice: 12000, targetRate: 150, hardCost: 0 });
  assert.equal(afterPhase.config.activeNetRevenue, 6000);
  assert.equal(afterPhase.config.carvedOutQuoteReduction, 6000);
  assert.ok(Math.abs(afterPhase.current.effectiveRate.p50 - 150) <= 2, `expected ~150, got ${afterPhase.current.effectiveRate.p50}`);
  assert.ok(Math.abs(afterPhase.current.economicMargin.profitP50 - allCore.current.economicMargin.profitP50) <= 150);
});

test('moving a severe tail-risk trap to phase2 or allowance genuinely improves Phase-1 p90 rate and margin', () => {
  const items = parseScopeText(`
    - Core booking flow [40h]
    - Legacy CSV migration & bi-directional SAP ERP webhook sync etc. [40h]
  `);
  const unshielded = runAutopsy(items, { quotePrice: 12000, targetRate: 150, hardCost: 0 });
  const phased = runAutopsy(
    items.map((it, i) => (i === 1 ? analyzeLineItem({ ...it, mode: 'phase2' }) : it)),
    { quotePrice: 12000, targetRate: 150, hardCost: 0 }
  );
  // Even after reducing Phase-1 revenue by 50% ($6,000), carving out the severe trap improves Phase-1 p90 margin!
  assert.equal(phased.config.activeNetRevenue, 6000);
  assert.ok(phased.current.effectiveRate.p10 > unshielded.current.effectiveRate.p10);
  assert.ok(phased.current.economicMargin.profitP90 > unshielded.current.economicMargin.profitP90);
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

  assert.ok(res1.current.effectiveRate.p10 <= res1.current.effectiveRate.p50);
  assert.ok(res1.current.effectiveRate.p50 <= res1.current.effectiveRate.p90);
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

test('hardCost exceeding quotePrice reduces downside profit dollar-for-dollar (Codex review fixture)', () => {
  const items = parseScopeText('Simple task [8h]');
  const at1000 = runAutopsy(items, { quotePrice: 1000, hardCost: 1000, targetRate: 150 });
  const at2000 = runAutopsy(items, { quotePrice: 1000, hardCost: 2000, targetRate: 150 });

  assert.equal(at2000.current.economicMargin.profitP50, at1000.current.economicMargin.profitP50 - 1000);
  assert.equal(at2000.current.economicMargin.profitP90, at1000.current.economicMargin.profitP90 - 1000);
  assert.equal(at2000.current.probBelowTarget, 100);
  assert.equal(at2000.verdictStatus, 'critical');
});

test('every RISK_RULE has a valid whitespace-free id, RegExp, and non-empty shield clause', () => {
  for (const r of RISK_RULES) {
    assert.ok(!/\s/.test(r.id), `rule id "${r.id}" must not contain whitespace`);
    assert.ok(r.pattern instanceof RegExp);
    assert.ok(r.p50Mult > 1.0);
    assert.ok(r.tailSpread > 0.1);
    assert.ok(r.shield.length > 40);
  }
});
