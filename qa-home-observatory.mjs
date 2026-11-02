import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts/observatory',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/user/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'});
try {
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
await context.addInitScript(()=>localStorage.setItem('mijeong.hasSeenTutorial','1'));
const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173');
async function enter(){await page.getByText('Browse as a guest',{exact:true}).click();await page.getByText('Get Started',{exact:true}).click();for(let i=0;i<3;i++){await page.getByText('Next',{exact:true}).click();await page.waitForTimeout(420);}await page.getByText(/Skip and start|Save and start/).click();await page.getByRole('button',{name:'Write a thought',exact:true}).waitFor();await page.waitForTimeout(300);}
await enter();
async function shot(name){await page.screenshot({path:`artifacts/observatory/${name}.png`});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error(`Horizontal overflow: ${name}`);}
await shot('home-empty');
if(await page.locator('.night-star').count())throw new Error('Empty account showed invented nodes');
await page.getByRole('button',{name:'Use voice',exact:true}).click();await page.waitForTimeout(300);
if(!await page.getByRole('button',{name:'Write instead'}).count())throw new Error('Voice action did not open voice mode');
await page.getByRole('button',{name:/Stop/}).click();
await page.getByRole('button',{name:'Write a thought',exact:true}).click();await page.waitForTimeout(300);
if(!await page.getByRole('button',{name:'Use voice instead'}).count())throw new Error('Write action did not open text mode');
await page.getByRole('button',{name:/Stop/}).click();
const storedBefore=await page.evaluate(()=>localStorage.getItem('mijeong.store.v6'));
await page.getByRole('button',{name:'Preview the premium constellation'}).click();
await page.setViewportSize({width:390,height:1000});await page.getByText('Premium preview',{exact:true}).waitFor();await shot('home-premium-preview');
if(await page.locator('.night-star').count()!==5)throw new Error('Preview missing example nodes');
if(await page.evaluate(()=>localStorage.getItem('mijeong.store.v6'))!==storedBefore)throw new Error('Preview mutated personal store');
await page.locator('.night-star').first().tap();await page.getByRole('dialog').waitFor({state:'visible'});
if(!await page.getByText('EXAMPLE INTERPRETATION / Identity',{exact:true}).count())throw new Error('Preview details not labeled');
await page.keyboard.press('Escape');await page.getByRole('button',{name:'Exit preview'}).click();
// Use only existing example content for a populated premium fixture.
await page.evaluate(async()=>{const {DEMO_STORE}=await import('/src/demo/demoData.ts');const fixture=structuredClone(DEMO_STORE);fixture.isPro=true;fixture.beliefs.forEach((b,i)=>{b.userReaction=i<3?'accepted':null;});localStorage.setItem('mijeong.store.v6',JSON.stringify(fixture));});
await page.reload();await enter();await page.setViewportSize({width:390,height:1200});await shot('home-premium-populated');
const pendingText=await page.locator('.night-hypothesis').innerText();
const excerpt=await page.locator('.night-source blockquote').innerText();
console.log('Pending interpretation from fixture:',pendingText,'Source:',excerpt);
await page.getByRole('button',{name:'Review interpretation',exact:true}).click();await page.waitForTimeout(300);
if(!await page.getByText(pendingText,{exact:true}).count())throw new Error('Review action opened wrong item');
await page.getByRole('navigation').getByRole('button',{name:'Home',exact:true}).click();
await page.locator('.night-star').first().focus();await page.keyboard.press('Enter');await page.getByRole('dialog').waitFor({state:'visible'});await page.keyboard.press('Escape');
await page.setViewportSize({width:320,height:568});await shot('home-small-phone');
const recordBox=await page.getByRole('button',{name:'Write a thought',exact:true}).boundingBox();if(recordBox.y+recordBox.height>500)throw new Error('Recording below fold on small phone');
await page.setViewportSize({width:1440,height:1100});await shot('home-desktop');
if(errors.length)throw new Error(errors.join('\n'));
console.log('PASS: empty state, preview isolation, exact review route, text/voice modes, star details, mobile/desktop, no page errors.');
} finally { await browser.close(); }
