import {validatePlan} from './validate.js';
const mm=n=>n/10;
const dims=(w,h)=>mm(w)+' × '+mm(h)+' mm';
function add(parent,tag,value) {
  const el=document.createElement(tag);
  el.textContent=value;
  parent.append(el);
  return el;
}
function shape(parent,tag,attrs) {
  const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [key,value] of Object.entries(attrs)) el.setAttribute(key,value);
  parent.append(el);
  return el;
}
export function renderPacket(host,p,stocks,settings) {
  const v=validatePlan(p,stocks,settings);
  if(!v.ok) throw Error(v.errors.join(' '));
  host.replaceChildren();
  add(host,'h2',p.title);
  add(host,'p',p.description);
  add(host,'p',p.quantity+' × '+mm(p.width)+' × '+mm(p.depth)+' × '+mm(p.height)+' mm exterior · '+
    p.material+' · '+mm(p.thickness)+' mm thick · Recipe '+p.recipeId+' v'+p.recipeVersion);
  add(host,'p',v.metrics.cuts+' cuts · '+Math.round(100*v.metrics.utilization)+'% of consumed sheet area in parts · '+
    mm(settings.kerf)+' mm kerf').className='summary';
  add(host,'p','Prototype assembly. Check dimensions, actual fit and tool setup before fabrication. All cuts span the current rectangle.').className='caveat';
  add(host,'h3','Parts and source sheets');
  let previous;
  for(const tree of p.trees) {
    const s=stocks.find(stock=>stock.id===tree.stockId), group=add(host,'section','');
    group.className='source';
    add(group,'h4',s.label+' · '+dims(s.width,s.height));
    add(group,'small',s.id+' · revision '+s.revision+' · grain '+s.grain);
    const svg=shape(group,'svg',{viewBox:'0 0 '+s.width+' '+s.height,role:'img','aria-label':s.label+' part layout'});
    shape(svg,'rect',{x:0,y:0,width:s.width,height:s.height,fill:'#e5dfcc'});
    const list=add(group,'ul',''); list.className='placements';
    for(const place of v.placements.filter(r=>r.stockId===s.id)) {
      const part=p.parts.find(v=>v.id===place.partId);
      const rect=shape(svg,'rect',{class:'part',x:place.x,y:place.y,width:place.width,height:place.height});
      const label=shape(svg,'text',{x:place.x+place.width/2,y:place.y+place.height/2,'text-anchor':'middle','dominant-baseline':'middle','font-size':Math.max(12,Math.min(s.width/30,place.height/2,place.width/4))});
      label.textContent=part.id;
      const btn=add(add(list,'li',''),'button',part.id+' · '+part.label+' · '+dims(part.width,part.height)+' at ('+mm(place.x)+', '+mm(place.y)+') mm'+(place.rotated?' · rotated':''));
      btn.setAttribute('aria-pressed','false');
      function select() {
        previous?.();
        rect.classList.add('selected'); btn.setAttribute('aria-pressed','true');
        previous=()=>{rect.classList.remove('selected');btn.setAttribute('aria-pressed','false');};
      }
      btn.onclick=select; rect.onclick=()=>{btn.focus();select();};
    }
  }
  add(host,'h3','Cut sequence');
  add(host,'p','Origins are measured from the top-left of each source sheet. Each offset is measured from the current region origin.');
  const steps=add(host,'ol','');
  for(const c of v.cuts) {
    const s=stocks.find(v=>v.id===c.stockId);
    add(steps,'li',s.label+' ['+s.id+'] · origin ('+mm(c.x)+', '+mm(c.y)+') mm · '+dims(c.width,c.height)+' · measure '+mm(c.at)+' mm on '+c.axis.toUpperCase()+'; kerf follows the mark.');
  }
  if(!v.cuts.length) add(host,'p','Exact stock fit. No cuts required.');
  add(host,'h3','Assembly');
  add(host,'p','Tools and consumables: '+p.requiredTools.join(', ')+'.');
  const instructions=add(host,'ol','');p.instructions.forEach(line=>add(instructions,'li',line));
  add(host,'small','Build confirmation keeps offcuts at least 30 × 30 mm. Smaller residual pieces are excluded from inventory.');
}
