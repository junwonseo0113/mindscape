import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { DEMO_STORE } from '../src/demo/demoData.ts';
await mkdir('artifacts/stellar-nodes',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
try {
  for(const [device,viewport] of [['mobile',{width:390,height:844}],['desktop',{width:1440,height:1000}]]) {
    const context=await browser.newContext({viewport,isMobile:device==='mobile',hasTouch:device==='mobile',reducedMotion:'reduce'});
    const fixture=structuredClone(DEMO_STORE);fixture.beliefs.forEach(b=>b.userReaction='accepted');
    await context.addInitScript(store=>{localStorage.setItem('mijeong.store.v6',JSON.stringify(store));localStorage.setItem('mijeong.hasSeenTutorial','1');},fixture);
    await context.route('**/src/app/App.tsx*',async route=>{
      const response=await route.fetch(),body=await response.text();
      assert.ok(body.includes('React.useState("quote")'));
      await route.fulfill({response,body:body.replace('React.useState("quote")','React.useState(new URLSearchParams(location.search).get("screen") || "quote")')});
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const screen of ['home','history','brainmap']) {
      await page.goto(`http://127.0.0.1:5173/?screen=${screen}`);
      await page.locator(`[data-screen="${screen}"]`).waitFor();await page.waitForTimeout(800);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      if(screen==='home') {
        const node=page.locator('.home-brain-information-node').first();await node.waitFor({state:'visible'});
        assert.ok(await node.locator('[data-stellar-node]').count());
        await node.click();await page.getByRole('dialog').waitFor();await page.waitForTimeout(400);
        const hit=await node.boundingBox(),light=await node.locator('[data-stellar-node]').boundingBox();
        assert.ok(Math.abs(hit.x+hit.width/2-light.x-light.width/2)<1,'Stellar light shifted from its hit target');
        assert.ok(Math.abs(hit.y+hit.height/2-light.y-light.height/2)<1,'Stellar light shifted from its hit target');
        await page.screenshot({path:`artifacts/stellar-nodes/${device}-home-selected.png`});
        await node.click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForTimeout(400);
      }
      if(screen==='history') {
        const nodes=page.locator('[data-stellar-node]');assert.ok(await nodes.count()>0);
        assert.ok(await nodes.first().evaluate(el=>getComputedStyle(el).clipPath==='none'));
        await page.getByRole('button',{name:/pattern:/}).first().click();
        await page.getByText('Current strength',{exact:true}).waitFor();
        await page.screenshot({path:`artifacts/stellar-nodes/${device}-history-detail.png`});
        await page.getByRole('button',{name:'Back to Journal',exact:false}).click();await page.waitForTimeout(500);
      }
      if(screen==='brainmap') assert.ok(await page.locator('canvas').count()>0);
      await page.screenshot({path:`artifacts/stellar-nodes/${device}-${screen}.png`});
    }
    assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS: consistent stellar nodes; Home and History selection; full map rendering; mobile and desktop.');
} finally {await browser.close();}
