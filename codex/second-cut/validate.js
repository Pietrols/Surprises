import {bounded, named, validateInventory, checkSettings} from './domain.js';

export function validatePlan(plan, stocks, settings) {
  const errors = [], placements = [], remnants = [], cuts = [];
  const metrics = {stockArea:0, partArea:0, kerfArea:0, remnantArea:0, cuts:0, utilization:0};
  function require(condition, message) { if (!condition) throw Error(message); }
  try {
    const inventory = validateInventory(stocks);
    require(inventory.ok, inventory.errors.join(' '));
    checkSettings(settings);
    require(Array.isArray(plan.parts) && plan.parts.length && Array.isArray(plan.trees), 'Missing parts or trees.');
    require(Array.isArray(plan.requiredTools) && plan.requiredTools.every(t => settings.tools.includes(t)), 'Missing required tool.');
    const parts = new Map(), used = new Set(), allocated = new Set();
    for (const p of plan.parts) {
      require(p && named(p.id) && !parts.has(p.id) && bounded(p.width,1,100000) &&
        bounded(p.height,1,100000) && ['x','y','any'].includes(p.grain), 'Invalid or duplicate part.');
      parts.set(p.id,p);
    }
    let nodes = 0;
    function walk(node, stock, x, y, width, height, depth) {
      const box = {stockId:stock.id,x,y,width,height};
      require(++nodes <= 10000 && depth <= 200 && node, 'Malformed or oversized tree.');
      if (node.type === 'remnant') {
        remnants.push(box);
        metrics.remnantArea += width * height;
      } else if (node.type === 'part') {
        const p = parts.get(node.partId), r = node.rotated;
        require(p && !allocated.has(p.id) && typeof r === 'boolean', 'Unknown or repeated part: ' + node.partId);
        require((!r || stock.allowRotation) && width === (r ? p.height : p.width) &&
          height === (r ? p.width : p.height), 'Wrong bounds or rotation: ' + p.id);
        require(stock.grain === 'none' || p.grain === 'any' ||
          stock.grain === (r ? (p.grain === 'x' ? 'y' : 'x') : p.grain), 'Grain mismatch: ' + p.id);
        allocated.add(p.id);
        placements.push({...box,partId:p.id,rotated:r});
        metrics.partArea += width * height;
      } else {
        require(node.type === 'cut' && ['x','y'].includes(node.axis) && node.kerf === settings.kerf, 'Invalid cut or kerf.');
        const horizontalSize = node.axis === 'x';
        const size = horizontalSize ? width : height;
        require(bounded(node.at,1,size-node.kerf-1), 'Cut must leave two positive regions.');
        const offset = node.at + node.kerf;
        cuts.push({...box,axis:node.axis,at:node.at,kerf:node.kerf,order:cuts.length+1});
        metrics.kerfArea += node.kerf * (horizontalSize ? height : width);
        walk(node.first,stock,x,y,horizontalSize ? node.at : width,horizontalSize ? height : node.at,depth+1);
        walk(node.second,stock,x+(horizontalSize ? offset : 0),y+(horizontalSize ? 0 : offset),
          horizontalSize ? size-offset : width,horizontalSize ? height : size-offset,depth+1);
      }
    }
    for (const t of plan.trees) {
      const s = stocks.find(stock => stock.id === t.stockId);
      require(s && !used.has(s.id) && s.revision === t.revision, 'Stale or duplicated source: ' + t.stockId);
      require(s.material === plan.material && s.thickness === plan.thickness, 'Incompatible source: ' + s.id);
      used.add(s.id);
      metrics.stockArea += s.width*s.height;
      const count = placements.length;
      walk(t.root,s,0,0,s.width,s.height,0);
      require(placements.length > count,'Consumed stock contains no parts.');
    }
    require(allocated.size === parts.size, 'Missing required part.');
    require(metrics.stockArea === metrics.partArea + metrics.kerfArea + metrics.remnantArea,'Area mismatch.');
    metrics.cuts = cuts.length;
    metrics.utilization = metrics.partArea / metrics.stockArea;
  } catch (e) { errors.push(e.message); }
  return {ok:!errors.length,errors,metrics,placements,remnants,cuts};
}
