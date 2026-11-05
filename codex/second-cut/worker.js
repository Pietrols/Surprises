import {findPlans} from './engine.js';
self.onmessage=({data:{id,stocks,settings}})=>{
  try { self.postMessage({id,result:findPlans(stocks,settings)}); }
  catch(e) { self.postMessage({id,error:e.message}); }
};
