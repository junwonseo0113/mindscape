import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {DEMO_STORE} from '../src/demo/demoData.ts';

await mkdir('artifacts/nebula-motion',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
try {
  for(const [device,viewport] of [['mobile',{width:390,height:844}],['desktop',{width:1440,height:1000}]]){
    const context=await browser.newContext({viewport,reducedMotion:'no-preference'});
    const fixture=structuredClone(DEMO_STORE);fixture.beliefs.forEach(b=>b.userReaction='accepted');
    await context.addInitScript(store=>{localStorage.setItem('mijeong.hasSeenTutorial','1');localStorage.setItem('mijeong.store.v6',JSON.stringify(store));},fixture);
    // Isolated entry fixture; all rendering and animation use the real Home scene.
    await context.route('**/src/app/App.tsx*',async route=>{const response=await route.fetch(),body=await response.text();await route.fulfill({response,body:body.replace('React.useState("quote")','React.useState("home")')});});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>Number(document.querySelector('.home-full-brain')?.dataset.tissuePoints)>=5000);
    const sky=page.locator('.observatory-nebula canvas'),time=()=>sky.getAttribute('data-motion-time'),pose=()=>sky.getAttribute('data-camera');
    const markers=()=>page.locator('.home-brain-information-node').evaluateAll(nodes=>nodes.map(node=>node.style.transform));
    const initialPose=await pose(),initialMarkers=await markers(),initialTime=Number(await time()),pixels=await sky.screenshot();
    await page.screenshot({path:`artifacts/nebula-motion/${device}-before.png`});
    await page.waitForTimeout(2800);
    assert.ok(Number(await time())>initialTime+.3,'Nebula time did not advance');
    assert.notDeepEqual(await sky.screenshot(),pixels,'Cloud forms did not animate');
    assert.equal(await pose(),initialPose,'Background animation moved the camera');
    assert.deepEqual(await markers(),initialMarkers,'Background animation moved the thought nodes');
    await page.screenshot({path:`artifacts/nebula-motion/${device}-after.png`});
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(150);
    const pausedTime=await time(),pausedPixels=await sky.screenshot();await page.waitForTimeout(600);
    assert.equal(await time(),pausedTime,'Reduced-motion preference did not pause cloud deformation');
    assert.deepEqual(await sky.screenshot(),pausedPixels,'Reduced-motion cloud field is still animating');
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(300);
    assert.ok(Number(await time())>Number(pausedTime),'Cloud motion did not resume');
    await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,value:true}));await page.waitForTimeout(100);
    const hiddenTime=await time();await page.waitForTimeout(600);assert.equal(await time(),hiddenTime,'Hidden page kept animating');
    await page.evaluate(()=>delete document.hidden);await page.waitForTimeout(250);
    assert.ok(Number(await time())>Number(hiddenTime)&&Number(await time())-Number(hiddenTime)<.4,'Resume jumped through hidden elapsed time');
    assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS: mobile/desktop cloud deformation changes rendered pixels; camera and nodes stay fixed; live reduced-motion and visibility pause/resume work.');
} finally {await browser.close();}
