import {validateInventory} from './domain.js';
import {validatePlan} from './validate.js';
export {validateInventory};
function pieceId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // getRandomValues is also available on plain HTTP LAN origins.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0,8), hex.slice(8,12), hex.slice(12,16), hex.slice(16,20), hex.slice(20)].join('-');
}
export function parseStockText(text, defaults, existing = []) {
  const labels = new Set(existing.map(stock => stock.label));
  let nextNumber = 1;
  const stocks=[];
  for(const entry of text.trim().split(/[,;\n]+/).map(v=>v.trim()).filter(Boolean)) {
    const m=/^(\d+(?:\.\d)?)\s*[x×]\s*(\d+(?:\.\d)?)(?:\s*[x×]\s*(\d+))?$/i.exec(entry);
    if(!m) throw Error('Use width x height, optionally x quantity (example 500x300x2).');
    const count=Number(m[3]??1);
    if(count<1 || count+stocks.length>40) throw Error('Enter 1 to 40 physical pieces.');
    for(let i=0;i<count;i++) {
      while (labels.has('Piece '+nextNumber)) nextNumber++;
      stocks.push({...defaults,id:pieceId(),label:'Piece '+nextNumber++, revision:0,
        width:Math.round(Number(m[1])*10),height:Math.round(Number(m[2])*10)});
    }
  }
  if(!stocks.length) throw Error('Enter at least one usable rectangle.');
  const result=validateInventory(stocks);
  if(!result.ok) throw Error(result.errors.join(' '));
  return stocks;
}
export function commitBuild(stocks,plan,settings) {
  const result=validatePlan(plan,stocks,settings);
  if(!result.ok) throw Error(result.errors.join(' '));
  const used=new Set(plan.trees.map(t=>t.stockId));
  const next=stocks.filter(s=>!used.has(s.id));
  for(const r of result.remnants.filter(r=>r.width>=300 && r.height>=300)) {
    const source=stocks.find(s=>s.id===r.stockId);
    next.push({...source,id:pieceId(),revision:0,label:source.label+' offcut ('+r.x/10+', '+r.y/10+' mm)',
      width:r.width,height:r.height});
  }
  const check=validateInventory(next);
  if(!check.ok) throw Error(check.errors.join(' '));
  return {stocks:structuredClone(next),transaction:{before:structuredClone(stocks),after:structuredClone(next),
    planId:plan.id,settings:structuredClone(settings)}};
}
export function undoBuild(stocks,transaction) {
  if(!transaction || !validateInventory(transaction.before).ok || JSON.stringify(stocks)!==JSON.stringify(transaction.after))
    throw Error('Inventory changed since this build. Undo is unavailable.');
  return structuredClone(transaction.before);
}
