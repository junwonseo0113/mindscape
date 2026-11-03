import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { DEMO_STORE } from '../src/demo/demoData.ts';
await mkdir('artifacts/journal-node',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
try {
  for(const [device,viewport] of [['mobile',{width:390,height:844}],['small',{width:320,height:568}],['desktop',{width:1440,height:1000}]]) {
    const context=await browser.newContext({viewport,isMobile:device!=='desktop',hasTouch:device!=='desktop',reducedMotion:'reduce'});
    const fixture=structuredClone(DEMO_STORE);fixture.beliefs.forEach(b=>b.userReaction='accepted');
    await context.addInitScript(store=>{localStorage.setItem('mijeong.store.v6',JSON.stringify(store));localStorage.setItem('mijeong.hasSeenTutorial','1');},fixture);
    await context.route('**/src/app/App.tsx*',async route=>{const response=await route.fetch(),body=await response.text();await route.fulfill({response,body:body.replace('React.useState("quote")','React.useState("history")')});});
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:5173');
    const rows=page.getByRole('button',{name:/pattern:/});await rows.first().waitFor();
    const count=await rows.count();assert.ok(count>1);
    const labels=await rows.evaluateAll(items=>items.map(item=>item.getAttribute('aria-label')));
    for(let index=0;index<count;index++) {
      const row=page.getByRole('button',{name:labels[index],exact:true});
      if(index===0){await row.focus();await page.keyboard.press('Enter');}else await row.click();
      const detail=page.locator('[data-screen="journalNode"]');await detail.waitFor();
      assert.equal(await detail.locator('[data-stellar-node]').count(),1);
      assert.equal(await page.locator('[data-screen="history"]').count(),0,'Catalogue remains behind the detail page');
      assert.equal(await detail.getByRole('navigation').count(),0);
      const title=await detail.getByRole('heading',{level:1}).textContent();
      const belief=fixture.beliefs.find(b=>labels[index].endsWith(b.statement));assert.ok(belief);
      assert.equal(title,belief.thoughtLabel||belief.statement);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      if(index===0) {
        await page.screenshot({path:`artifacts/journal-node/${device}-detail.png`});
        const original=detail.getByRole('button',{name:/Read original entry/}).first();
        if(await original.count()) {
          const entry=fixture.history.find(e=>e.id===(belief.supportingEntryIds??[])[0]);
          await original.click();await page.locator('[data-screen="historyDetail"]').waitFor();
          if(entry)await page.getByText(entry.text,{exact:true}).waitFor();
          await page.getByRole('button',{name:/back/i}).first().click();await detail.waitFor();
          assert.equal(await detail.getByRole('heading',{level:1}).textContent(),title);
        }
        await detail.evaluate(el=>{const main=el.querySelector('main');main.scrollTop=main.scrollHeight;});
        await page.screenshot({path:`artifacts/journal-node/${device}-evidence.png`});
      }
      await detail.getByRole('button',{name:'Back to Journal',exact:false}).click();
      await page.locator('[data-screen="history"]').waitFor();
    }
    assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS: all Journal nodes open dedicated screens; one star per screen; keyboard/touch, evidence return, Journal return, small/mobile/desktop layouts.');
} finally {await browser.close();}
