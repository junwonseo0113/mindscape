import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {DEMO_STORE} from '../src/demo/demoData.ts';
import {emptyStore} from '../src/app/types.ts';
await mkdir('artifacts/home-nebula',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
const origin=process.env.MINDSCAPE_TEST_URL||'http://127.0.0.1:5173';
const fixture=structuredClone(DEMO_STORE);fixture.beliefs.forEach(b=>{b.userReaction='accepted';});
const errors=[];
async function context(store,{restricted=false,loading=false,error=false}={}) {
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await ctx.addInitScript(store=>{localStorage.setItem('mijeong.hasSeenTutorial','1');localStorage.setItem('mijeong.isDemoMode','0');localStorage.setItem('mijeong.store.v6',JSON.stringify(store));},store);
  if(restricted) await ctx.route('**/src/app/App.tsx*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('const MONETIZATION_ENABLED = false','const MONETIZATION_ENABLED = true')});});
  let release;const wait=new Promise(resolve=>release=resolve);
  if(loading)await ctx.route('**/src/app/HomeThoughtMap.tsx*',async route=>{await wait;await route.continue();});
  if(error)await ctx.route('**/src/app/HomeThoughtMap.tsx*',route=>route.abort('failed'));
  const page=await ctx.newPage();if(!error)page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);
  await page.getByText('Browse as a guest',{exact:true}).click();await page.getByText('Get Started',{exact:true}).click();
  for(let i=0;i<3;i++){await page.getByText('Next',{exact:true}).click();await page.waitForTimeout(420);}
  await page.getByText(/Skip and start|Save and start/).click();await page.getByRole('button',{name:'Record a thought',exact:true}).waitFor();
  await page.waitForTimeout(350);
  return {ctx,page,release};
}
async function screenshot(page,name){await page.screenshot({path:`artifacts/home-nebula/${name}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Horizontal overflow ${name}`);}
async function positions(page){return page.locator('.observatory-node-core').evaluateAll(nodes=>nodes.map(n=>[n.getAttribute('cx'),n.getAttribute('cy')]));}
try {
  const {ctx,page}=await context(fixture);
  await page.locator('.observatory-node').first().waitFor();
  assert.equal(await page.locator('.observatory-node').count(),fixture.beliefs.length);
  await screenshot(page,'populated-390');
  const initialPositions=await positions(page);
  await page.locator('[data-node-id="demo-belief-0"]').click();await page.getByRole('dialog').waitFor();
  await screenshot(page,'selected-node-390');
  assert(await page.getByRole('button',{name:/Read original entry/}).count());
  await page.getByRole('button',{name:/Read original entry/}).first().click();await page.getByText(fixture.history.find(e=>e.id===fixture.beliefs[0].supportingEntryIds[0]).text,{exact:true}).waitFor();
  assert((await page.locator('body').innerText()).includes(fixture.history.find(e=>e.id===fixture.beliefs[0].supportingEntryIds[0]).text));
  await page.getByRole('button',{name:/back/i}).first().click();await page.locator('.observatory-node').first().waitFor();
  assert.deepEqual(await positions(page),initialPositions);
  const camera=page.getByTestId('home-map-camera'),map=page.locator('.observatory-map');
  let originalTransform=await camera.getAttribute('transform');const box=await map.boundingBox();
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.3);await page.mouse.down();await page.mouse.move(box.x+box.width*.5+35,box.y+box.height*.3+30,{steps:5});await page.mouse.up();
  assert.notEqual(await camera.getAttribute('transform'),originalTransform,'Pan did not change the camera');
  await page.locator('.observatory-map-tools summary').click();await page.getByRole('button',{name:'Fit map',exact:true}).click();
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();assert.notEqual(await camera.getAttribute('transform'),originalTransform);
  await page.getByRole('button',{name:'Fit map',exact:true}).click();await page.locator('.observatory-map-tools summary').click();
  originalTransform=await camera.getAttribute('transform');const cdp=await ctx.newCDPSession(page);const center={x:box.x+box.width*.5,y:box.y+box.height*.5};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:center.x-35,y:center.y},{x:center.x+35,y:center.y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:center.x-65,y:center.y-10},{x:center.x+65,y:center.y+10}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.notEqual(await camera.getAttribute('transform'),originalTransform,'Pinch did not zoom');
  await map.focus();await page.keyboard.press('0');assert.equal(await camera.getAttribute('transform'),originalTransform);
  await page.mouse.move(center.x,center.y);await page.mouse.wheel(0,-200);await page.waitForTimeout(150);assert.notEqual(await camera.getAttribute('transform'),originalTransform,'Wheel did not zoom');await map.focus();await page.keyboard.press('0');
  assert.deepEqual(await positions(page),initialPositions,'Node positions regenerated during interactions');
  assert.equal(await page.locator('.observatory-nebula').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});assert.equal(await page.locator('.observatory-nebula').evaluate(e=>getComputedStyle(e).animationName),'observatory-drift');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>document.querySelector('.observatory-home').dataset.pageHidden==='true');assert.equal(await page.locator('.observatory-nebula').evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:'Record a thought',exact:true}).click();await page.getByRole('button',{name:'Use voice instead',exact:true}).waitFor();await page.getByRole('button',{name:/Stop/}).click();
  await page.getByRole('button',{name:'Record with your voice',exact:true}).click();await page.getByRole('button',{name:'Write instead',exact:true}).waitFor();await page.getByRole('button',{name:/Stop/}).click();
  await page.getByRole('button',{name:/discoveries to review/}).click();await page.getByText(fixture.hypotheses[0].title,{exact:true}).waitFor();await page.getByRole('navigation').getByRole('button',{name:'Home',exact:true}).click();await page.waitForTimeout(300);
  await page.locator('.observatory-map-tools summary').click();await page.getByRole('button',{name:'Open Mind overview',exact:true}).click();await page.getByText('The beliefs behind today\'s discovery, in detail.',{exact:true}).waitFor();await page.getByRole('navigation').getByRole('button',{name:'Home',exact:true}).click();await page.waitForTimeout(300);
  await page.getByRole('navigation').getByRole('button',{name:'Analysis',exact:true}).click();await page.waitForTimeout(300);await page.getByRole('navigation').getByRole('button',{name:'Journal',exact:true}).click();await page.waitForTimeout(300);await page.getByRole('navigation').getByRole('button',{name:'Home',exact:true}).click();await page.waitForTimeout(300);
  await page.getByRole('button',{name:'Open profile'}).click();await page.getByText('Ideal Self',{exact:true}).click();await page.getByRole('heading',{name:'Ideal Self',exact:true}).waitFor();await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('navigation').getByRole('button',{name:'Home',exact:true}).click();await page.waitForTimeout(300);
  await page.setViewportSize({width:430,height:932});await screenshot(page,'populated-430');
  await page.setViewportSize({width:1440,height:1000});await screenshot(page,'populated-desktop');await ctx.close();

  const empty=await context(emptyStore());assert.equal(await empty.page.locator('.observatory-node').count(),0);assert.equal(await empty.page.locator('.observatory-discoveries').count(),0);await screenshot(empty.page,'empty-390');
  await empty.page.getByRole('button',{name:'Preview an example map',exact:true}).click();await empty.page.getByText('Example map preview · not your thoughts',{exact:true}).waitFor();await screenshot(empty.page,'explicit-preview');await empty.page.getByRole('button',{name:'Exit preview'}).click();assert.equal(await empty.page.locator('.observatory-node').count(),0);await empty.ctx.close();
  const restrictedFixture=structuredClone(fixture);restrictedFixture.isPro=false;const restricted=await context(restrictedFixture,{restricted:true});await restricted.page.getByText('Your personal map, with Premium.',{exact:true}).waitFor();assert.equal(await restricted.page.locator('.observatory-node').count(),0);assert.equal(await restricted.page.locator('.observatory-discoveries').count(),0);assert(await restricted.page.getByRole('button',{name:'Record a thought',exact:true}).isEnabled());await screenshot(restricted.page,'restricted-premium');await restricted.page.getByRole('button',{name:'View map access',exact:false}).click();await restricted.page.waitForTimeout(350);assert.match(await restricted.page.locator('body').innerText(),/plan|Premium|Pro/i);await restricted.ctx.close();
  const loading=await context(fixture,{loading:true});await loading.page.getByText('Opening your map…',{exact:true}).waitFor();await screenshot(loading.page,'loading');assert(await loading.page.getByRole('button',{name:'Record a thought',exact:true}).isEnabled());loading.release();await loading.page.locator('.observatory-node').first().waitFor();await loading.ctx.close();
  const failed=await context(fixture,{error:true});await failed.page.getByText('Your map could not open.',{exact:true}).waitFor();await screenshot(failed.page,'error');await failed.page.getByRole('button',{name:'Record a thought',exact:true}).click();await failed.page.getByRole('button',{name:'Use voice instead',exact:true}).waitFor();await failed.ctx.close();
  assert.deepEqual(errors,[]);console.log('PASS: 390/430/desktop populated, empty, restricted, loading, error; stable nodes, pan/pinch/wheel, selection/evidence, routes, text/voice, reduced/hidden motion.');
} finally {await browser.close();}
