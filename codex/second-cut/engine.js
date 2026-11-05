import {bounded, named, validateInventory, checkSettings} from './domain.js';
import {enumerateRecipes} from './recipes.js';
import {validatePlan} from './validate.js';

const area = p => p.width * p.height;
function inputs(stocks,settings,maxNodes) {
  const result = validateInventory(stocks);
  if (!result.ok) throw Error(result.errors.join(' '));
  checkSettings(settings);
  if (!bounded(maxNodes,0,1000000)) throw Error('Invalid search budget.');
}

// A free leaf is replaced only for the duration of its search branch.
function solve(stocks,parts,settings,budget) {
  if (!parts.length || parts.reduce((n,p)=>n+area(p),0) > stocks.reduce((n,p)=>n+area(p),0)) return null;
  const roots = stocks.map(s=>({stockId:s.id,revision:s.revision,root:{type:'remnant'}}));
  const free = stocks.map((s,i)=>({stock:s,node:roots[i].root,width:s.width,height:s.height}));
  const kerf=settings.kerf;
  function place(ordered,index,regions) {
    if(index===ordered.length) {
      const trees=roots.filter(t=>t.root.type!=='remnant');
      return structuredClone(trees);
    }
    const part=ordered[index];
    for(const region of regions) {
      for(const rotated of [false,true]) {
        if(rotated && (!region.stock.allowRotation ||
          (part.width===part.height && (part.grain==='any'||region.stock.grain==='none')))) continue;
        const grain=rotated ? (part.grain==='x'?'y':'x') : part.grain;
        if(region.stock.grain!=='none' && part.grain!=='any' && grain!==region.stock.grain) continue;
        const w=rotated?part.height:part.width, h=rotated?part.width:part.height;
        const dx=region.width-w, dy=region.height-h;
        if ((dx!==0 && dx<=kerf) || (dy!==0 && dy<=kerf)) continue;
        for(const axes of dx && dy ? [['x','y'],['y','x']] : [['x','y']]) {
          if(budget.used>=budget.limit) { budget.exhausted=true; return null; }
          budget.used++;
          const next=regions.filter(r=>r!==region);
          let node=region.node, width=region.width, height=region.height;
          for(const axis of axes) {
            const x=axis==='x', at=x?w:h, gap=(x?width:height)-at;
            if(!gap) continue;
            Object.assign(node,{type:'cut',axis,at,kerf,first:{},second:{type:'remnant'}});
            next.push({stock:region.stock,node:node.second,width:x?gap-kerf:width,height:x?height:gap-kerf});
            node=node.first;
            if(x) width=w; else height=h;
          }
          Object.assign(node,{type:'part',partId:part.id,rotated});
          next.sort((a,b)=>area(a)-area(b));
          const result=place(ordered,index+1,next);
          for(const key of Object.keys(region.node)) delete region.node[key];
          region.node.type='remnant';
          if(result || budget.exhausted) return result;
        }
      }
    }
    return null;
  }
  free.sort((a,b)=>area(a)-area(b));
  for(const order of [(a,b)=>area(b)-area(a),(a,b)=>Math.max(b.width,b.height)-Math.max(a.width,a.height)]) {
    const trees=place([...parts].sort(order),0,free);
    if(trees || budget.exhausted) return trees;
  }
  return null;
}
function checked(candidate,stocks,settings) {
  const check=validatePlan(candidate,stocks,settings);
  if(!check.ok) throw Error('Engine returned invalid plan: '+check.errors.join(' '));
  return {...candidate,metrics:check.metrics};
}
export function planParts(stocks,parts,settings,{maxNodes=25000}={}) {
  inputs(stocks,settings,maxNodes);
  if(!Array.isArray(parts)||parts.length>200 || new Set(parts.map(p=>p?.id)).size!==parts.length ||
    !parts.every(p=>p && named(p.id) && bounded(p.width,1,100000) && bounded(p.height,1,100000) &&
    ['x','y','any'].includes(p.grain))) throw Error('Invalid fixture parts.');
  const groups=new Map();
  for(const s of stocks) {
    const key=JSON.stringify([s.material,s.thickness]);
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(s);
  }
  const budget={used:0,limit:maxNodes,exhausted:false};
  for(const group of groups.values()) {
    const trees=solve(group,parts,settings,budget);
    if(trees) {
      const plan=checked({parts,trees,material:group[0].material,thickness:group[0].thickness,requiredTools:[]},stocks,settings);
      return {trees,metrics:plan.metrics,exhausted:false};
    }
    if(budget.exhausted) return {trees:[],metrics:null,exhausted:true};
  }
  return null;
}
export function findPlans(stocks,settings,{maxPlans=12,maxNodes=25000}={}) {
  inputs(stocks,settings,maxNodes);
  if(!bounded(maxPlans,1,1000)) throw Error('Invalid result limit.');
  const recipes=enumerateRecipes(stocks,settings), plans=[];
  let examined=0,exhausted=false;
  for(let i=0;i<recipes.length;i++) {
    const candidate=recipes[i];
    // Reserve work for later recipes so a difficult large option cannot hide an easy one.
    const budget={used:0,limit:Math.floor((maxNodes-examined)/(recipes.length-i)),exhausted:false};
    const group=stocks.filter(s=>s.thickness===candidate.thickness && s.material===candidate.material);
    const trees=solve(group,candidate.parts,settings,budget);
    examined+=budget.used;
    exhausted ||= budget.exhausted;
    if(trees) plans.push(checked({...candidate,trees},stocks,settings));
  }
  plans.sort((a,b)=>b.quantity-a.quantity || b.metrics.utilization-a.metrics.utilization || a.metrics.cuts-b.metrics.cuts || (a.id<b.id?-1:1));
  return {plans:plans.slice(0,maxPlans),examined,exhausted};
}
