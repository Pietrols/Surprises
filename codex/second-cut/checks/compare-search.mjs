// Compare uncapped results against an earlier checkout of this application.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {findPlans} from '../engine.js';
import {validatePlan} from '../validate.js';

if (!process.argv[2]) throw Error('Pass the path to the baseline engine.js in its original module directory.');
const baseline = await import(pathToFileURL(resolve(process.argv[2])).href);
let seed = 6391;
function random(limit) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return (seed >>> 8) % limit;
}

let retained = 0, additional = 0;
for (let i = 0; i < 600; i++) {
  const stocks = Array.from({length:1 + random(3)}, (_,index) => ({
    id:String(index), label:String(index), revision:0, material:'Plywood',
    width:1500 + random(4000), height:1400 + random(2600), thickness:90,
    allowRotation:Boolean(random(2)), grain:['x','y','none'][random(3)]
  }));
  if (i % 8 === 0) Object.assign(stocks[0], {width:4800, height:2870, allowRotation:false, grain:'none'});
  const settings = {kerf:[10,20,30,31][random(4)], tools:['saw','glue','clamps','sandpaper']};
  const options = {maxPlans:100, maxNodes:[40,2500,25000][random(3)]};
  const oldPlans = baseline.findPlans(stocks, settings, options).plans;
  const next = findPlans(stocks, settings, options);
  assert.ok(next.examined <= options.maxNodes, 'Budget exceeded at case '+i);
  const ids = new Set(next.plans.map(plan => plan.id));
  for (const old of oldPlans) assert.ok(ids.has(old.id), 'Lost '+old.id+' at case '+i);
  for (const plan of next.plans) {
    assert.deepEqual(validatePlan(plan, stocks, settings).errors, [], 'Invalid plan at case '+i);
  }
  retained += oldPlans.length;
  additional += next.plans.length - oldPlans.length;
}
console.log({cases:600, retained, additional});
