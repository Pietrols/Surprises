const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const key = 'second-cut.workshop.v1';
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,
    args:['--no-sandbox','--disable-gpu','--no-proxy-server']});
  try {
    const ctx = await browser.newContext({viewport:{width:390,height:844}});
    const a = await ctx.newPage(), b = await ctx.newPage();
    async function routeLocally(context) {
      await context.route('http://workshop.test:4173/**',async route=>{
        const {pathname}=new URL(route.request().url());
        const response=await context.request.get('http://127.0.0.1:4173'+pathname);
        await route.fulfill({response});
      });
    }
    await routeLocally(ctx);
    const errors=[];
    for (const page of [a,b]) {
      page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://workshop.test:4173');
      await page.locator('#packet svg').first().waitFor();
      assert.deepEqual(await page.evaluate(()=>[isSecureContext, !!navigator.locks, !!crypto.randomUUID]),[false,false,false]);
    }
    await a.getByText('Enter measurements',{exact:true}).click();
    await a.locator('#width').fill('500.1');await a.locator('#height').fill('300');await a.locator('#quantity').fill('8');
    await a.locator('#quantity').press('Enter');
    await Promise.all([a,b].map(p=>p.waitForFunction(()=>document.querySelectorAll('#stock li').length===10)));
    assert.equal(await a.locator('#width').evaluate(el=>el===document.activeElement),true);
    assert.ok(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    // Open a stale-snapshot race in two independent pages. Exactly one write can commit.
    const read = p=>p.evaluate(async key=>{const {createStorage}=await import('./storage.js');return createStorage(key,()=>{}).read();},key);
    const expected = await read(a);
    const stocks=JSON.parse(expected).stocks;assert.equal(new Set(stocks.map(x=>x.id)).size,10);
    assert.equal(stocks.at(-1).width,5001);
    const write=(p,kerf)=>p.evaluate(async({key,expected,kerf})=>{
      const {createStorage}=await import('./storage.js');
      const data=JSON.parse(expected);data.settings.kerf=kerf;
      return createStorage(key,()=>{}).replace(expected,JSON.stringify(data));
    },{key,expected,kerf});
    const wins=await Promise.all([write(a,31),write(b,32)]);
    assert.equal(wins.filter(Boolean).length,1);
    await a.reload();await a.locator('#packet svg').first().waitFor();
    assert.equal(await a.locator('#kerf').inputValue(),wins[0]?'3.1':'3.2');
    await a.locator('#build').click();await a.locator('#undo:enabled').waitFor();
    await a.reload();await a.locator('#undo:enabled').click();
    await a.waitForFunction(()=>document.querySelectorAll('#stock li').length===10);
    assert.deepEqual(JSON.parse(await read(a)).stocks,stocks);
    const newContext=await browser.newContext();
    await routeLocally(newContext);
    const legacy=await newContext.newPage();await legacy.goto('http://workshop.test:4173/package.json');
    await legacy.evaluate(({key,expected})=>localStorage.setItem(key,expected),{key,expected});
    await legacy.goto('http://workshop.test:4173');await legacy.locator('#packet svg').first().waitFor();
    assert.equal(await read(legacy),expected);
    assert.deepEqual(errors,[]);
    console.log('Plain HTTP passed: compatibility, keyboard entry, 390px layout, cross-tab refresh, CAS race, build/undo after reload, legacy migration.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
