export const tools = ['saw', 'glue', 'clamps', 'sandpaper'];
export const bounded = (n, low, high) => Number.isSafeInteger(n) && n >= low && n <= high;
export const named = s => typeof s === 'string' && s.trim().length > 0;
export function validateInventory(stocks) {
  const errors = [];
  if (!Array.isArray(stocks) || stocks.length > 40) return {ok:false, errors:['Use at most 40 physical stock pieces.']};
  const ids = new Set();
  for (const s of stocks) {
    if (!s || !named(s.id) || ids.has(s.id) || !named(s.label) || !named(s.material) ||
        !bounded(s.revision,0,Number.MAX_SAFE_INTEGER) || !bounded(s.width,1,100000) ||
        !bounded(s.height,1,100000) || !bounded(s.thickness,1,1000) ||
        !['x','y','none'].includes(s.grain) || typeof s.allowRotation !== 'boolean') {
      errors.push('Invalid or duplicate inventory piece: ' + (s?.id ?? '(missing ID)'));
    }
    ids.add(s?.id);
  }
  return {ok:!errors.length, errors};
}
export function checkSettings(s) {
  if (!s || !bounded(s.kerf,0,100) || !Array.isArray(s.tools) || !s.tools.every(t => tools.includes(t)))
    throw Error('Use a kerf from 0 to 10 mm and recognized tools.');
}
