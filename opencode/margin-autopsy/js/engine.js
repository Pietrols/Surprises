// engine.js
// Pure deterministic scope parsing, risk-trigger attribution, log-normal Monte Carlo
// effort simulation, sensitivity attribution, and contractual Change-Order Shield synthesis.
// Zero browser dependencies: runs identically in the browser and in `node --test`.

/** Seeded mulberry32 PRNG for 100% reproducible simulations. */
export function rng(seed = 42) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal variate via Box-Muller. */
export function randNormal(rand) {
  const u = Math.max(1e-12, rand());
  const v = Math.max(1e-12, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Transparent catalog of scope-drift triggers.
 * Covers both software/systems builds and physical/industrial engineering installations.
 * Each rule specifies:
 * - id, label, category
 * - pattern: RegExp matching scope descriptions (with word-sense guards against false positives)
 * - p50Mult: multiplier on median effort (e.g. 1.25 = +25% median hours)
 * - tailSpread: additive log-space standard deviation (fat-tail overrun risk)
 * - reason: human-readable explanation of why this causes unbilled rework
 * - shield: concrete contractual boundary clause ("Change-Order Shield")
 */
export const RISK_RULES = [
  {
    id: 'legacy_migration',
    label: 'Legacy Data / Historian / Migration',
    category: 'Data & State',
    pattern: /\b(migrat(?:e|ion)|legacy|import\s+existing|csv\s+dump|clean(?:up|\s+data)|historical\s+(?:data|order|log)|historian|etl|old\s+database)\b/i,
    p50Mult: 1.35,
    tailSpread: 0.42,
    reason: 'Source schemas and legacy logs almost always contain undocumented nulls, encoding drift, duplicate keys, and broken references discovered mid-build.',
    shield: 'Client provides a frozen, validated sample export matching the agreed schema before work begins. Includes 1 automated import pass and 1 validation pass; source data cleansing or schema changes after sign-off are billed at the change-order rate.',
  },
  {
    id: 'third_party_erp_crm',
    label: 'External ERP / CRM / Webhook Sync',
    category: 'Integration',
    pattern: /\b(sap|netsuite|salesforce|hubspot|erp|crm|quickbooks|two-way\s+sync|bi-directional|webhook|third-party\s+api|external\s+api|modbus|opc-?ua|scada\s+bridge)\b/i,
    p50Mult: 1.30,
    tailSpread: 0.38,
    reason: 'External APIs and plant buses introduce rate limits, sandbox-vs-production discrepancies, undocumented register maps, and vendor credential delays.',
    shield: 'Scoped to documented endpoints/registers available in a working test environment on Day 1. One-way sync unless explicitly specified; vendor firmware/API bugs, undocumented payloads, or custom polling fallbacks trigger a change order.',
  },
  {
    id: 'auth_sso_rbac',
    label: 'Enterprise SSO / Multi-Role RBAC',
    category: 'Security & Access',
    pattern: /\b(sso|saml|okta|active\s+directory|rbac|role-based|granular\s+permissions|multi-tenant|audit\s+log|compliance|hipaa|soc2)\b/i,
    p50Mult: 1.28,
    tailSpread: 0.32,
    reason: 'Permission matrices multiply test states across every endpoint and view; enterprise IdP handshakes often stall on client IT.',
    shield: 'Includes up to 3 fixed static roles (Admin, Operator/Editor, Viewer) and standard OIDC/OAuth login. Custom field-level ACLs, dynamic policy engines, or live IT security questionnaires are scoped separately.',
  },
  {
    id: 'custom_design_polish',
    label: 'Open-Ended UI / Animation / Polish',
    category: 'Design & UX',
    pattern: /\b(bespoke|pixel-perfect|custom\s+animation|gsap|webgl|3d\s+(?:canvas|configurator|model|scene|view)|interactive\s+canvas|redesign|branding|dark\s+mode|micro-interactions|look\s+and\s+feel)\b/i,
    p50Mult: 1.25,
    tailSpread: 0.36,
    reason: 'Subjective visual feedback loops lead to unbounded revision rounds when acceptance is based on taste rather than a frozen specification.',
    shield: 'Built against client-approved wireframes/design tokens with up to 2 consolidated rounds of visual revisions. New layout directions or custom motion sequences requested after design sign-off are billed at the hourly rate.',
  },
  {
    id: 'vague_scope_weasel',
    label: 'Unbounded Scope Qualifier ("etc.", "seamless", "AI")',
    category: 'Ambiguity',
    pattern: /\b(etc\.?|and\s+more|seamless(?:ly)?|various|flexible|future-proof|as\s+needed|tbd|ai-powered|smart\s+matching|automated\s+insights|custom\s+reporting|ml\s+model\s+training|machine\s+learning)\b/i,
    p50Mult: 1.30,
    tailSpread: 0.45,
    reason: 'Open-ended qualifiers and exploratory ML/AI promises allow the buyer to assume 5x more edge cases and accuracy tuning than the builder priced.',
    shield: 'Deliverable is strictly bounded to the enumerated deterministic acceptance checklist in Schedule A. Any capability implied by "etc.", "custom", "as needed", or open-ended model accuracy targets not explicitly listed is excluded from the fixed fee.',
  },
  {
    id: 'payments_billing',
    label: 'Subscription / Proration / Tax / Payouts',
    category: 'Commerce',
    pattern: /\b(stripe\s+connect|split\s+payout|prorat(?:e|ion)|multi-currency|tax\s+(?:automation|engine|calculation|compliance)|vat\s+invoic(?:e|es|ing)|refund\s+workflow|chargeback|dunning|usage-based\s+billing)\b/i,
    p50Mult: 1.28,
    tailSpread: 0.34,
    reason: 'Edge cases around failed webhooks, prorated upgrades, refunds, and multi-jurisdiction tax rules require 3x the effort of a basic checkout session.',
    shield: 'Uses standard hosted checkout and invoicing lifecycle events. Custom proration ledgers, split marketplace payouts, or automated multi-jurisdiction tax reconciliation require a dedicated phase.',
  },
  {
    id: 'realtime_offline',
    label: 'Real-Time Sync / Offline Field Mode',
    category: 'Architecture',
    pattern: /\b(real-?time|websocket|live\s+sync|collaborat(?:e|ive)|multiplayer|offline(?:-first|\s+mode|\s+sync)|conflict\s+resolution|push\s+notification)\b/i,
    p50Mult: 1.35,
    tailSpread: 0.40,
    reason: 'Distributed state synchronization, intermittent field connectivity, and offline conflict resolution turn simple data capture into distributed systems engineering.',
    shield: 'Implemented via standard store-and-forward batch sync or 15-second polling unless concurrent conflict-free state resolution is explicitly funded as a standalone line item.',
  },
  {
    id: 'stakeholder_handoff',
    label: 'Committee Sign-Off / Staff Training / Handover',
    category: 'Process & Handoff',
    // Word-sense guard: match staff/operator/team/onsite training or workshops, not "ML model training"
    pattern: /\b(committee|board\s+approval|stakeholder\s+(?:workshop|alignment|sign-off|review)|(?:staff|operator|team|user|on-?site|client)\s+training|training\s+(?:session|workshop|manual)|handover\s+documentation|styleguide\s+documentation|white-glove|support\s+sla)\b/i,
    p50Mult: 1.20,
    tailSpread: 0.30,
    reason: 'Multiple approvers with conflicting priorities create serial sign-off delays and unbilled training/meeting overhead.',
    shield: 'Client designates one Single Point of Contact (SPOC) with binding sign-off authority. Includes one 60-minute recorded handover session; additional workshops or committee review cycles are billed per session.',
  },
  {
    id: 'field_site_hardware',
    label: 'Site Access / Field Commissioning / Imported Hardware',
    category: 'Field & Industrial',
    pattern: /\b(on-?site\s+commissioning|site\s+access|plant\s+shutdown|lockout|client-supplied\s+(?:hardware|equipment|sensor|plc)|customs|import\s+lead|power\s+quality|surge|field\s+wiring|enclosure\s+install)\b/i,
    p50Mult: 1.32,
    tailSpread: 0.42,
    reason: 'Physical site readiness, plant shutdown windows, uncalibrated client-supplied sensors, and customs/import delays create idle crew time and repeat site visits.',
    shield: 'Quote assumes site readiness, stable power, and safety induction completed upon crew arrival. Standby time caused by plant access delays, unready client equipment, or customs holds is billed at the daily standby rate.',
  },
];

/** Default heuristic base hours when a line item does not explicitly state hours. */
export function inferBaseHours(text) {
  const clean = text.trim();
  if (!clean) return 8;
  let base = 10;
  if (/\b(mvp|platform|portal|engine|system|dashboard|pipeline|architecture|commissioning)\b/i.test(clean)) base += 10;
  if (/\b(crud|form|page|screen|view|endpoint|table|export|webhook|enclosure)\b/i.test(clean)) base += 4;
  if (/\b(simple|basic|minor|tweak|copy|button|static)\b/i.test(clean)) base = Math.max(4, base - 4);
  if (/\b(complex|complete|full|end-to-end|enterprise|custom|multi)\b/i.test(clean)) base += 8;
  return base;
}

/**
 * Parse a raw multi-line scope document into structured scope items.
 * Only strips actual bullet/numbered list prefixes (e.g. "- ", "* ", "• ", "1. ", "2) ")
 * so titles beginning with numbers like "3D product configurator" or "24/7 alerts" remain intact.
 */
export function parseScopeText(rawText) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

  return lines.map((line, idx) => {
    let text = line.replace(/^\s*(?:[-*•]+|\d+[.)])\s+/, '').trim();
    let mode = 'core'; // 'core' | 'allowance' | 'phase2'

    if (/\[(allowance|capped)\]/i.test(text)) {
      mode = 'allowance';
      text = text.replace(/\[(allowance|capped)\]/ig, '').trim();
    } else if (/\[(phase\s*2|optional|excluded)\]/i.test(text)) {
      mode = 'phase2';
      text = text.replace(/\[(phase\s*2|optional|excluded)\]/ig, '').trim();
    }

    // Match explicit hours e.g. [16h], (24 hrs), : 12h, - 8 hours
    let explicitHours = null;
    const hrMatch = text.match(/(?:\[\s*(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours)\s*\]|\(\s*(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours)\s*\)|(?::|-|—)\s*(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours)\s*$)/i);
    if (hrMatch) {
      explicitHours = Number(hrMatch[1] || hrMatch[2] || hrMatch[3]);
      text = text.replace(hrMatch[0], '').trim();
    }

    const baseHours = explicitHours != null && explicitHours > 0 ? explicitHours : inferBaseHours(text);
    return analyzeLineItem({
      id: `item_${idx + 1}`,
      index: idx + 1,
      title: text || `Scope item ${idx + 1}`,
      baseHours,
      explicitHours: explicitHours != null,
      mode,
    });
  });
}

/**
 * Evaluate a single line item against RISK_RULES and compute its analytical
 * distribution parameters (log-normal mu and sigma, plus quantiles).
 */
export function analyzeLineItem(item) {
  const matchedRules = RISK_RULES.filter((r) => r.pattern.test(item.title));

  let p50Mult = 1.0;
  let tailSpread = 0.16; // baseline estimation uncertainty even for clean tasks

  matchedRules.forEach((r, i) => {
    const weight = 1 / Math.pow(i + 1, 0.35);
    p50Mult *= 1 + (r.p50Mult - 1) * weight;
    tailSpread = Math.hypot(tailSpread, r.tailSpread * weight);
  });

  const baseHours = Math.max(1, Number(item.baseHours) || 8);
  const rawP50 = baseHours * p50Mult;
  const Z90 = 1.2815515655446004;
  const rawP10 = Math.max(baseHours * 0.75, rawP50 * Math.exp(-Z90 * tailSpread));
  const rawP90 = rawP50 * Math.exp(Z90 * tailSpread);

  // Contractual mode semantics:
  // - 'core': included in Phase-1 fixed fee; builder absorbs all overrun hours.
  // - 'allowance': included in Phase-1 fixed fee with a strict hour cap (1.15x baseHours);
  //   scope stops at the cap (or excess is billed separately at targetRate), so Phase-1 obligation is capped.
  // - 'phase2': carved out of Phase 1 into a separate Phase-2 option; both its hours AND its
  //   proportional share of the Phase-1 fixed fee are removed from Phase 1 so margin recovery is honest.
  const mode = item.mode || 'core';
  const capHours = Math.round(baseHours * 1.15 * 10) / 10;

  let effBase = baseHours;
  let effP10 = rawP10;
  let effP50 = rawP50;
  let effP90 = rawP90;

  if (mode === 'allowance') {
    effP50 = Math.min(rawP50, capHours);
    effP90 = Math.min(rawP90, capHours);
    effP10 = Math.min(rawP10, capHours);
  } else if (mode === 'phase2') {
    effBase = 0;
    effP10 = 0;
    effP50 = 0;
    effP90 = 0;
  }

  const overrunP90 = Math.max(0, rawP90 - baseHours);
  const riskScore = Math.min(100, Math.round((overrunP90 / Math.max(baseHours, 6)) * 42 + matchedRules.length * 14));
  const riskLevel = riskScore >= 65 ? 'critical' : riskScore >= 35 ? 'elevated' : 'controlled';

  const shields = matchedRules.length
    ? matchedRules.map((r) => ({ ruleId: r.id, label: r.label, reason: r.reason, clause: r.shield }))
    : [{
        ruleId: 'standard_acceptance',
        label: 'Standard Acceptance Gate',
        reason: 'Even low-risk tasks can drift without a binary definition of done.',
        clause: `Scoped strictly to "${item.title}" with 1 review cycle and binary acceptance against agreed specification.`,
      }];

  return {
    ...item,
    baseHours: round1(baseHours),
    mode,
    capHours,
    matchedRules: matchedRules.map((r) => ({ id: r.id, label: r.label, category: r.category, reason: r.reason })),
    p50Mult: round2(p50Mult),
    tailSpread: round2(tailSpread),
    raw: {
      p10: round1(rawP10),
      p50: round1(rawP50),
      p90: round1(rawP90),
      overrunP90: round1(overrunP90),
    },
    effective: {
      base: round1(effBase),
      p10: round1(effP10),
      p50: round1(effP50),
      p90: round1(effP90),
    },
    riskScore,
    riskLevel,
    shields,
  };
}

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

function quantileSorted(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - pos) + sorted[hi] * (pos - lo);
}

/**
 * Run a full seeded Monte Carlo portfolio autopsy across all items.
 * Honest revenue accounting:
 * - Unshielded baseline evaluates all items in Phase 1 against full `netRevenue = quotePrice - hardCost`.
 * - When an item is moved to `phase2`, Phase-1 fixed revenue is proportionally reduced by that item's
 *   share of the paper estimate (`netRevenue * (activeBaseHours / quotedBaseHours)`), while the carved-out
 *   scope is priced realistically at `raw.p50 * targetRate` as `phase2Quote`.
 *   Therefore, moving a zero-overrun item to Phase 2 does not artificially inflate Phase-1 hourly rate!
 */
export function runAutopsy(items, config = {}) {
  const quotePrice = Math.max(100, Number(config.quotePrice) || 18000);
  const targetRate = Math.max(10, Number(config.targetRate) || 150);
  const hardCost = Math.max(0, Number(config.hardCost) || 0);
  const currency = config.currency || 'USD';
  const iterations = Math.min(5000, Math.max(200, Number(config.iterations) || 1500));
  const seed = Number(config.seed) || 20261105;

  const analyzed = items.map((it) => (it.raw && it.shields ? it : analyzeLineItem(it)));
  const fullNetRevenue = Math.max(0, quotePrice - hardCost);

  const quotedBaseHours = round1(analyzed.reduce((s, it) => s + it.baseHours, 0));
  const activeBaseHours = round1(analyzed.reduce((s, it) => s + it.effective.base, 0));

  // Proportional Phase-1 revenue retained when Phase-2 items are carved out of the fixed bid:
  const retainedShare = quotedBaseHours > 0 ? activeBaseHours / quotedBaseHours : 1;
  const activeNetRevenue = Math.round(fullNetRevenue * retainedShare);
  const activeQuotePrice = activeNetRevenue + hardCost;
  const carvedOutQuoteReduction = Math.round(fullNetRevenue - activeNetRevenue);

  const phase2Value = Math.round(
    analyzed
      .filter((it) => it.mode === 'phase2')
      .reduce((s, it) => s + it.raw.p50 * targetRate, 0)
  );

  const rand = rng(seed);
  const rawTotals = new Float64Array(iterations);
  const effTotals = new Float64Array(iterations);

  // Correlation weight: 25% shared project weather, 75% independent task variance
  const rho = 0.25;
  const sShared = Math.sqrt(rho);
  const sIndep = Math.sqrt(1 - rho);

  for (let iter = 0; iter < iterations; iter++) {
    const zProject = randNormal(rand);
    let sumRaw = 0;
    let sumEff = 0;

    for (let i = 0; i < analyzed.length; i++) {
      const it = analyzed[i];
      const zTask = sShared * zProject + sIndep * randNormal(rand);
      const simHours = Math.max(it.baseHours * 0.65, it.raw.p50 * Math.exp(it.tailSpread * zTask));
      sumRaw += simHours;

      if (it.mode === 'core') {
        sumEff += simHours;
      } else if (it.mode === 'allowance') {
        // Capped allowance: work stops or converts to paid T&M above capHours
        sumEff += Math.min(simHours, it.capHours);
      }
      // 'phase2' is excluded from Phase 1 hours (and its proportional revenue is excluded from activeNetRevenue)
    }

    rawTotals[iter] = sumRaw;
    effTotals[iter] = sumEff;
  }

  const rawSorted = Float64Array.from(rawTotals).sort();
  const effSorted = Float64Array.from(effTotals).sort();

  function summarizeDistribution(sorted, netRev) {
    const p10 = round1(quantileSorted(sorted, 0.10));
    const p50 = round1(quantileSorted(sorted, 0.50));
    const p90 = round1(quantileSorted(sorted, 0.90));
    const p95 = round1(quantileSorted(sorted, 0.95));

    const rateP10 = p90 > 0 ? Math.round(netRev / p90) : 0; // worst hours = lowest rate
    const rateP50 = p50 > 0 ? Math.round(netRev / p50) : 0;
    const rateP90 = p10 > 0 ? Math.round(netRev / p10) : 0; // best hours = highest rate

    const profitP50 = Math.round(netRev - p50 * targetRate);
    const profitP90 = Math.round(netRev - p90 * targetRate); // economic surplus/deficit vs targetRate floor at p90

    const maxHoursForTarget = netRev / targetRate;
    let underwaterCount = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] > maxHoursForTarget) underwaterCount++;
    }
    const probBelowTarget = sorted.length && maxHoursForTarget > 0 ? Math.round((underwaterCount / sorted.length) * 100) : 0;

    const minH = Math.max(0, quantileSorted(sorted, 0.01));
    const maxH = Math.max(minH + 8, quantileSorted(sorted, 0.99));
    const binCount = 18;
    const step = (maxH - minH) / binCount;
    const bins = [];
    for (let b = 0; b < binCount; b++) {
      bins.push({
        lo: round1(minH + b * step),
        hi: round1(minH + (b + 1) * step),
        mid: round1(minH + (b + 0.5) * step),
        count: 0,
      });
    }
    for (let i = 0; i < sorted.length; i++) {
      const v = sorted[i];
      if (v < minH || v > maxH) continue;
      const idx = Math.min(binCount - 1, Math.max(0, Math.floor((v - minH) / step)));
      bins[idx].count++;
    }

    return {
      netRevenue: netRev,
      hours: { p10, p50, p90, p95 },
      effectiveRate: { p10: rateP10, p50: rateP50, p90: rateP90 },
      economicMargin: { profitP50, profitP90 },
      maxHoursForTarget: round1(maxHoursForTarget),
      probBelowTarget,
      histogram: bins,
    };
  }

  const unshielded = summarizeDistribution(rawSorted, fullNetRevenue);
  const current = summarizeDistribution(effSorted, activeNetRevenue);

  const totalOverrun = analyzed.reduce((s, it) => s + it.raw.overrunP90, 0) || 1;
  const drivers = analyzed
    .map((it) => ({
      id: it.id,
      index: it.index,
      title: it.title,
      mode: it.mode,
      baseHours: it.baseHours,
      p90Hours: it.raw.p90,
      overrunHours: it.raw.overrunP90,
      overrunCost: Math.round(it.raw.overrunP90 * targetRate),
      sharePct: Math.round((it.raw.overrunP90 / totalOverrun) * 100),
      riskLevel: it.riskLevel,
      riskScore: it.riskScore,
      topShield: it.shields[0]?.clause || '',
    }))
    .sort((a, b) => b.overrunHours - a.overrunHours);

  const safeFixedPrice = Math.ceil((current.hours.p90 * targetRate + hardCost) / 250) * 250;
  // Unpriced overrun hours removed (as opposed to simply base hours moved to Phase 2)
  const unshieldedOverrunP90 = Math.max(0, unshielded.hours.p90 - quotedBaseHours);
  const currentOverrunP90 = Math.max(0, current.hours.p90 - activeBaseHours);
  const hoursSavedP90 = round1(Math.max(0, unshieldedOverrunP90 - currentOverrunP90));
  const marginProtectedP90 = Math.max(0, current.economicMargin.profitP90 - unshielded.economicMargin.profitP90);

  let verdictStatus = 'healthy';
  let verdictTitle = 'Margin Protected at p90 Tail';
  if (current.effectiveRate.p10 < targetRate * 0.65 || current.probBelowTarget >= 65) {
    verdictStatus = 'critical';
    verdictTitle = 'Severe Scope-Drift Trap (Underwater at p50/p90)';
  } else if (current.effectiveRate.p10 < targetRate || current.probBelowTarget >= 30) {
    verdictStatus = 'watch';
    verdictTitle = 'Fragile Margin (Profitable on Paper, Underwater in Tail)';
  }

  return {
    config: {
      quotePrice,
      activeQuotePrice,
      carvedOutQuoteReduction,
      targetRate,
      hardCost,
      netRevenue: fullNetRevenue,
      activeNetRevenue,
      currency,
      iterations,
      seed,
    },
    quotedBaseHours,
    activeBaseHours,
    phase2Value,
    unshielded,
    current,
    hoursSavedP90,
    marginProtectedP90,
    safeFixedPrice,
    verdictStatus,
    verdictTitle,
    items: analyzed,
    drivers,
  };
}
