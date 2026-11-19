import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

await mkdir('artifacts/opening-transition',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
try {
  for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]) {
    const page=await browser.newPage({viewport,reducedMotion:'no-preference'});
    await page.goto(process.env.MINDSCAPE_TEST_URL||'http://127.0.0.1:5173');
    await page.locator('.quote-line-portrait').waitFor();
    const viewportBounds=await page.locator('[data-opening-viewport]').boundingBox();
    await page.getByRole('button',{name:'Quote of the day. Continue',exact:true}).click();
    await page.locator('[data-screen="splash"]').waitFor();await page.waitForTimeout(1000);
    await page.screenshot({path:`artifacts/opening-transition/${name}-splash.png`});
    const measurements=await page.evaluate(async()=>{
      const viewport=document.querySelector('[data-opening-viewport]'),wordmark=document.querySelector('[data-screen="splash"] .opening-wordmark'),sky=document.querySelector('.opening-sky');
      const samples=[];const started=performance.now();
      while(performance.now()-started<1700){
        samples.push({top:viewport.getBoundingClientRect().top,wordmarkTop:wordmark.isConnected?wordmark.getBoundingClientRect().top:null,sameSky:document.querySelector('.opening-sky')===sky});
        await new Promise(requestAnimationFrame);
      }
      return samples;
    });
    assert.ok(measurements.every(sample=>Math.abs(sample.top-viewportBounds.y)<.1),'Content inset shifted during the transition');
    const tops=measurements.map(sample=>sample.wordmarkTop).filter(value=>value!==null);
    assert.ok(Math.max(...tops)-Math.min(...tops)<.5,'Outgoing wordmark moved during the transition');
    assert.ok(measurements.every(sample=>sample.sameSky),'Opening sky remounted during the transition');
    await page.getByText('Browse as a guest',{exact:true}).waitFor();
    const bounds=await page.locator('.opening-sky').boundingBox(),frame=await page.locator('.theme-stargazing').boundingBox();
    assert.deepEqual(bounds,frame,'Sky does not cover the entire frame behind the status bar');
    await page.screenshot({path:`artifacts/opening-transition/${name}-auth.png`});await page.close();
  }
  console.log('PASS: desktop/mobile transition keeps the viewport, outgoing wordmark and full-frame sky stable.');
} finally {await browser.close();}
