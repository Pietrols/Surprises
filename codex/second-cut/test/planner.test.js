import test from 'node:test';
import assert from 'node:assert/strict';
import {findPlans,planParts} from '../engine.js';
import {validatePlan} from '../validate.js';
import {parseStockText,validateInventory,commitBuild,undoBuild} from '../inventory.js';
const setup={kerf:30,tools:['saw','glue','clamps','sandpaper']};
const defaults={material:'Plywood',thickness:90,allowRotation:true,grain:'none'};
const sheet={...defaults,id:'A',label:'Stock A',revision:0,width:5000,height:3000};
const part=(id,width,height,grain='any')=>({id,label:id,width,height,grain});

test('hand-checked tray and divider account for inset floors, ends and divider height',()=>{
  const result=findPlans([sheet],setup);
  for(const family of ['tray','divider-box']) {
    const p=result.plans.find(p=>p.quantity===1&&p.width===2400&&p.recipeId===family);
    assert.ok(p);
    assert.deepEqual(p.parts.slice(0,5).map(p=>[p.width,p.height]),[[2220,1420],[2400,p.height],[2400,p.height],[1420,p.height],[1420,p.height]]);
    if(family==='divider-box') assert.deepEqual([p.parts[5].width,p.parts[5].height],[1420,710]);
    const v=validatePlan(p,[sheet],setup);
    assert.equal(v.ok,true);assert.equal(v.placements.length,p.parts.length);
    const m=v.metrics;
    assert.equal(m.stockArea,m.partArea+m.kerfArea+m.remnantArea);
  }
  assert.deepEqual(findPlans([sheet],setup),result);
  assert.ok(result.examined<=25000);
});
test('kerf-sensitive 163 mm square permits a single four-tile set only at the 3 mm setting or less',()=>{
  const s={...sheet,width:1630,height:1630};
  const found=k=>findPlans([s],{...setup,kerf:k}).plans.some(p=>p.recipeId==='tile-set'&&p.width===800);
  assert.ok(found(30));assert.equal(found(31),false);
});
test('tools, material and search bounds constrain options',()=>{
  assert.deepEqual(findPlans([sheet],{...setup,tools:[]}).plans,[]);
  assert.ok(findPlans([{...sheet,material:'Acrylic'}],setup).plans.every(p=>p.recipeId==='tile-set'));
  const r=findPlans([sheet],setup,{maxNodes:1});
  assert.ok(r.exhausted && r.examined<=1);
  assert.throws(()=>findPlans([sheet,sheet],setup));
  assert.throws(()=>findPlans([sheet],{...setup,kerf:0.5}));
  assert.deepEqual(findPlans([],setup).plans,[]);
});
test('stock grain and physical rotation constraints also apply to square pieces',()=>{
  const p=part('1',10,10,'x'), s={...sheet,width:10,height:10,grain:'y'};
  assert.ok(planParts([s],[p],setup).trees[0].root.rotated);
  assert.equal(planParts([{...s,allowRotation:false}],[p],setup),null);
  assert.equal(planParts([{...s,grain:'none',allowRotation:false}],[p],setup).trees[0].root.rotated,false);
});
test('validator rejects malformed, stale, incompatible or incomplete allocations and recomputes metrics',()=>{
  const [p]=findPlans([sheet],setup).plans;
  const bad=[q=>q.parts.push(q.parts[0]),q=>q.parts.pop(),q=>q.trees.push(q.trees[0]),
    q=>q.trees[0].revision++,q=>q.thickness++,q=>q.material='MDF',q=>q.trees[0].root.kerf++,
    q=>q.trees[0].root.at=sheet.width,q=>q.requiredTools.push('unknown'),q=>q.trees[0].root={type:'mystery'},
    q=>q.trees[0].root={type:'remnant'},q=>q.parts[0].height++];
  for(const change of bad) {
    const altered=structuredClone(p);change(altered);assert.equal(validatePlan(altered,[sheet],setup).ok,false);
  }
  assert.equal(validatePlan(null,[sheet],setup).ok,false);
  assert.deepEqual(validatePlan({...p,metrics:{}},[sheet],setup).metrics,p.metrics);
});
test('quick entry, bounds, duplicate quantities, decimal mm and all-or-nothing validation',()=>{
  const a=parseStockText('500x300x2; 420.1 × 180',defaults);
  assert.equal(a.length,3);assert.equal(a[2].width,4201);assert.equal(new Set(a.map(s=>s.id)).size,3);
  for(const text of ['1x1x0','x','0x1','1.01x2','1x1x41','10001x2','500x300,bad']) assert.throws(()=>parseStockText(text,defaults));
  assert.equal(validateInventory([a[0],a[0]]).ok,false);
});
test('build consumes referenced revisions once and undo survives JSON with independent snapshots',()=>{
  const untouched={...sheet,id:'B',width:1,height:1};
  const stocks=[sheet,untouched], [p]=findPlans(stocks,setup).plans;
  const built=commitBuild(stocks,p,setup);
  assert.ok(built.stocks.some(s=>s.id==='B'));
  assert.ok(built.stocks.filter(s=>s.id!=='B').every(s=>s.width>=300&&s.height>=300));
  assert.deepEqual(built.transaction.settings,setup);
  assert.throws(()=>commitBuild(built.stocks,p,setup));
  assert.throws(()=>commitBuild([{...sheet,revision:2}],p,setup));
  assert.deepEqual(undoBuild(built.stocks,JSON.parse(JSON.stringify(built.transaction))),stocks);
  assert.throws(()=>undoBuild([],built.transaction));
  built.stocks[0].label='mutated';assert.notEqual(built.transaction.after[0].label,'mutated');
});
// Independent tiny exhaustive oracle: try every full guillotine cut and every subset
// assignment. No placements, heuristics, or geometry functions imported from the planner.
function possible(w,h,parts,k) {
  if(!parts.length) return true;
  if(parts.reduce((n,p)=>n+p.width*p.height,0)>w*h) return false;
  if(parts.length===1&&parts[0].width===w&&parts[0].height===h) return true;
  for(const x of [true,false]) {
    const span=x?w:h;
    for(let at=1;at+k<span;at++) for(let mask=0;mask<2**parts.length;mask++) {
      const left=parts.filter((_,i)=>mask&(1<<i)),right=parts.filter((_,i)=>!(mask&(1<<i)));
      if(possible(x?at:w,x?h:at,left,k)&&possible(x?span-at-k:w,x?h:span-at-k,right,k)) return true;
    }
  }
  return false;
}
test('fixed-orientation one- and two-part fixtures agree with exhaustive cuts on tiny sheets',()=>{
  for(const k of [0,1]) for(let w=2;w<=5;w++) for(let h=2;h<=4;h++) {
    const s={...sheet,width:w,height:h,allowRotation:false};
    for(const parts of [[part('a',1,2)],[part('a',2,2),part('b',1,2)],[part('a',3,1),part('b',2,1)]]) {
      const settings={...setup,kerf:k};
      const result=planParts([s],parts,settings);
      assert.equal(Boolean(result?.trees?.length),possible(w,h,parts,k),JSON.stringify({k,w,h,parts}));
      if(result) assert.ok(validatePlan({trees:result.trees,parts,material:s.material,thickness:s.thickness,requiredTools:[]},[s],settings).ok);
    }
  }
});
test('joint allocations respect quantities and cannot mix incompatible sheets',()=>{
  const a={...sheet,width:10,height:10},b={...a,id:'B'},ps=[part('i',10,10),part('ii',10,10)];
  assert.equal(planParts([a,b],ps,setup).trees.length,2);
  assert.equal(planParts([a,{...b,thickness:100}],ps,setup),null);
});
test('transaction exceeding 40 stocks fails before changing any piece',()=>{
  const stocks=Array.from({length:40},(_,i)=>({...sheet,id:'sheet-'+i,width:i===0?5000:1,height:i===0?3000:1}));
  const p=findPlans(stocks,setup).plans.find(p=>p.quantity===1&&p.recipeId==='tray');
  const before=structuredClone(stocks);
  assert.throws(()=>commitBuild(stocks,p,setup),/40/);
  assert.deepEqual(stocks,before);
});
test('adversarial cut depth fails validation without overflowing the stack',()=>{
  let root={type:'remnant'};
  for(let i=0;i<205;i++) root={type:'cut',axis:'x',at:1,kerf:0,first:{type:'remnant'},second:root};
  const result=validatePlan({trees:[{stockId:sheet.id,revision:0,root}],parts:[part('a',1,1)],
    material:sheet.material,thickness:sheet.thickness,requiredTools:[]},[sheet],{...setup,kerf:0});
  assert.equal(result.ok,false);assert.match(result.errors.join(' '),/oversized/);
});
test('repeated entry gives every new piece a distinct readable label',()=>{
  const previous = parseStockText('200x100x3',defaults);
  const retained = [previous[0], previous[2]];
  const more = parseStockText('200x100x3',defaults,retained);
  assert.deepEqual(more.map(s=>s.label),['Piece 2','Piece 4','Piece 5']);
  assert.equal(new Set([...retained,...more].map(s=>s.id)).size,5);
});
