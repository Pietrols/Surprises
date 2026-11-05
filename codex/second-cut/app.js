import {tools,checkSettings} from './domain.js';
import {parseStockText,validateInventory,commitBuild,undoBuild} from './inventory.js';
import {renderPacket} from './packet.js';

const $=id=>document.getElementById(id);
const key='second-cut.workshop.v1';
const sample={version:1,stocks:[
  {id:'sample-A',label:'Sheet A',width:5000,height:3000},
  {id:'sample-B',label:'Sheet B',width:1630,height:1630}
].map(s=>({...s,revision:0,thickness:90,material:'Plywood',grain:'none',allowRotation:true})),
settings:{kerf:30,tools:[...tools]},transaction:null};
let state, raw, worker, plans=[], serial=0,blocked=false;
function validateState(data) {
  if(data?.version!==1) throw Error('Unsupported backup version.');
  const result=validateInventory(data.stocks);
  if(!result.ok) throw Error(result.errors.join(' '));
  checkSettings(data.settings);
  if(data.transaction!=null) {
    undoBuild(data.stocks,data.transaction);
    checkSettings(data.transaction.settings);
  }
  return data;
}
function load() {
  try {
    raw=localStorage.getItem(key);
    state=raw===null?structuredClone(sample):validateState(JSON.parse(raw));
    blocked=false; render();
  } catch(e) {
    blocked=true; worker?.terminate(); plans=[]; $('packet').replaceChildren();
    $('stock').replaceChildren(); $('choose').hidden=$('planActions').hidden=true;
    $('undo').disabled=true; $('status').textContent='Inventory could not be loaded.';
    $('notice').textContent=e.message+' Export the original data or import a valid backup to recover.';
  }
}
function mutate(update,{recover=false}={}) {
  // Serialize read/compare/write across tabs. A stale screen must reload before editing.
  const apply=()=>{
    if(blocked && !recover) throw Error('Import a valid backup first.');
    const current=localStorage.getItem(key);
    if(current!==raw) {load();throw Error('Inventory changed in another tab. Review the updated data and retry.');}
    const next=validateState(update(structuredClone(state)));
    const encoded=JSON.stringify(next);
    localStorage.setItem(key,encoded);
    state=next;raw=encoded;blocked=false;$('notice').textContent='';render();
  };
  if(!navigator.locks) { $('notice').textContent='Saving requires HTTPS or localhost and browser Web Locks support.';return; }
  navigator.locks.request(key,apply).catch(e=>{$('notice').textContent=e.message;});
}
function render() {
  $('stock').replaceChildren();
  for(const s of state.stocks) {
    const row=document.createElement('li'), text=document.createElement('span'), meta=document.createElement('small');
    text.textContent=s.label+' · '+s.width/10+' × '+s.height/10+' mm';
    meta.textContent=s.material+' · '+s.thickness/10+' mm · grain '+s.grain+(s.allowRotation?' · rotatable':' · fixed');
    text.append(meta); const remove=document.createElement('button');
    remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+s.label);
    remove.onclick=()=>mutate(data=>({...data,stocks:data.stocks.filter(v=>v.id!==s.id),transaction:null}));
    row.append(text,remove);$('stock').append(row);
  }
  if(!state.stocks.length) $('stock').textContent='Your inventory is empty.';
  $('kerf').value=state.settings.kerf/10;
  for(const t of tools) $('tool-'+t).checked=state.settings.tools.includes(t);
  $('undo').disabled=!state.transaction;
  worker?.terminate();const id=++serial;
  plans=[];$('packet').replaceChildren();$('choose').hidden=$('planActions').hidden=true;
  $('status').textContent='Searching your stock…';
  worker=new Worker('./worker.js',{type:'module'});
  worker.onerror=()=>{if(serial===id) $('status').textContent='Search failed. Reload to retry.';};
  worker.onmessage=({data})=>{
    if(id!==serial || data.id!==id || blocked) return;
    if(data.error){$('status').textContent=data.error;return;}
    const {plans:found,exhausted}=data.result;
    plans=found;
    $('status').textContent=(plans.length?plans.length+' alternatives. Choose one build.':'No plan found within this search.')+
      (exhausted?' Search budget reached.':'');
    $('choose').hidden=$('planActions').hidden=!plans.length;
    $('plans').replaceChildren(...plans.map((p,i)=>new Option(p.quantity+' × '+p.title+' · '+p.width/10+' × '+p.depth/10+' mm',String(i))));
    show();
  };
  worker.postMessage({id,stocks:state.stocks,settings:state.settings});
}
function show() {
  const p=plans[$('plans').value];
  if(p) renderPacket($('packet'),p,state.stocks,state.settings);
}
$('plans').onchange=show;
$('add').onsubmit=e=>{
  e.preventDefault();
  mutate(data=>{
    const extra=parseStockText($('sizes').value,{thickness:Math.round(Number($('thickness').value)*10),
      material:$('material').value,grain:$('grain').value,allowRotation:$('rotate').checked});
    return {...data,stocks:[...data.stocks,...extra],transaction:null};
  });
};
function setup() {
  mutate(data=>{
    if(!$('kerf').value || !$('kerf').checkValidity()) throw Error('Enter a kerf between 0 and 10 mm in 0.1 mm steps.');
    return {...data,settings:{kerf:Math.round(Number($('kerf').value)*10),tools:tools.filter(t=>$('tool-'+t).checked)}};
  });
}
for(const t of tools) {
  const label=document.createElement('label'),input=document.createElement('input');
  input.type='checkbox';input.id='tool-'+t;input.onchange=setup;
  label.append(input,' '+t);$('tools').append(label);
}
$('kerf').onchange=setup;
$('build').onclick=()=>{
  const p=plans[$('plans').value];
  if(p && confirm('Consume '+p.trees.length+' source sheet(s) for this build and keep eligible remnants?'))
    mutate(data=>({...data,...commitBuild(data.stocks,p,data.settings)}));
};
$('undo').onclick=()=>mutate(data=>({...data,stocks:undoBuild(data.stocks,data.transaction),transaction:null}));
$('print').onclick=()=>window.print();
$('backup').onclick=()=>{
  const url=URL.createObjectURL(new Blob([blocked?raw:JSON.stringify(state,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='second-cut-inventory.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('import').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';
  if(!file) return;
  try {
    if(file.size>2000000) throw Error('Backup exceeds 2 MB.');
    const next=validateState(JSON.parse(await file.text()));
    if(confirm('Replace the current inventory and settings with this backup?')) mutate(()=>next,{recover:true});
  } catch(err) {$('notice').textContent='Import failed: '+err.message;}
};
window.addEventListener('storage',e=>{if(e.key===key || e.key===null) load();});
load();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(()=>{
    if(!blocked) $('notice').textContent='Offline caching is unavailable in this browser.';
  });
}
