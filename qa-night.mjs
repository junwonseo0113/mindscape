import { chromium } from 'playwright';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts/night',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/user/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173');
await page.evaluate(async()=>{ const {DEMO_STORE}=await import('/src/demo/demoData.ts');localStorage.setItem('mijeong.store.v6',JSON.stringify(DEMO_STORE));localStorage.setItem('mijeong.hasSeenTutorial','1'); });
await page.reload();
await page.getByText('Browse as a guest',{exact:true}).click();
await page.screenshot({path:'artifacts/night/onboarding.png'});
await page.getByText('Get Started',{exact:true}).click();
for(let i=0;i<3;i++){await page.getByText('Next',{exact:true}).click();await page.waitForTimeout(450);}
await page.getByText(/Skip and start|Save and start/).click();
await page.getByRole('button',{name:'Record a thought',exact:true}).waitFor();
if(await page.getByText('Skip 1/8',{exact:true}).count()) await page.getByText('Skip 1/8',{exact:true}).click();
async function shot(name){await page.waitForTimeout(350);await page.screenshot({path:`artifacts/night/${name}.png`});console.log(name, 'overflow',await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));}
for(const [label,name] of [['Mind','mind'],['Analysis','analysis'],['Journal','journal']]){await page.getByRole('navigation').getByRole('button',{name:label,exact:true}).click();await shot(name);}
await page.getByRole('navigation').getByRole('button',{name:'Home',exact:true}).click();
await page.getByRole('button',{name:'Record a thought',exact:true}).click();await shot('recording');await page.getByRole('button',{name:/Stop/}).click();
// The full map was checked in the first pass; avoid a second WebGL context here.
await page.getByRole('button',{name:'Open profile'}).click();await shot('profile');console.log('PROFILE',await page.locator('body').innerText());
for(const [label,name] of [['Notifications','notifications'],['Data & Privacy','privacy'],['Help','help']]) {
  await page.getByText(label,{exact:true}).click();await shot(name);
  console.log(name,(await page.locator('body').innerText()).slice(0,300));
  await page.getByRole('button',{name:/back/i}).first().click();
}
await page.getByRole('navigation').getByRole('button',{name:'Analysis',exact:true}).click();
await page.getByRole('button',{name:"Examine today's discovery"}).click();await shot('interpretation');
console.log('REVIEW', (await page.locator('body').innerText()).slice(-1600));
await page.getByRole('navigation').getByRole('button',{name:'Journal',exact:true}).click();
await page.getByRole('button',{name:/Search/i}).first().click();await shot('journal-search');
console.log('SEARCH',(await page.locator('body').innerText()).slice(-700));
await page.getByRole('button',{name:'Close',exact:true}).click();
await page.setViewportSize({width:1440,height:1000});await shot('desktop-journal');
await page.getByRole('navigation').getByRole('button',{name:'Analysis',exact:true}).click();await shot('desktop-analysis');
await page.setViewportSize({width:320,height:568});await shot('small-analysis');
await page.getByRole('navigation').getByRole('button',{name:'Mind',exact:true}).click();await shot('small-mind');
await page.setViewportSize({width:390,height:844});
await page.getByRole('navigation').getByRole('button',{name:'Analysis',exact:true}).click();
await page.getByRole('button',{name:"Examine today's discovery"}).click();
const agree=page.getByRole('button',{name:'I agree',exact:true});await agree.scrollIntoViewIfNeeded();
await shot('review-actions');
console.log('Agree text color',await agree.locator('span').first().evaluate(el=>getComputedStyle(el).color));
if(errors.length) throw new Error(errors.join('\n')); console.log('Page errors',errors);
await browser.close();
