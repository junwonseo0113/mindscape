import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {DEMO_STORE} from '../src/demo/demoData.ts';

const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
try {
  for(const [device,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]) {
    const context=await browser.newContext({viewport,reducedMotion:'no-preference'});
    await context.addInitScript(store=>{localStorage.setItem('mijeong.hasSeenTutorial','1');localStorage.setItem('mijeong.store.v6',JSON.stringify(store));},DEMO_STORE);
    await context.route('**/src/app/App.tsx*',async route=>{const response=await route.fetch(),body=await response.text();await route.fulfill({response,body:body.replace('React.useState("quote")','React.useState("home")')});});
    const page=await context.newPage();await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Open profile'}).waitFor();await page.evaluate(()=>document.fonts.ready);
    const check=async(action,destination)=>{
      await page.evaluate(()=>{
        const viewport=document.querySelector('[data-opening-viewport]'),root=document.querySelector('.app-screen'),heading=root.querySelector('h1'),start=performance.now();
        const originalViewport=viewport.getBoundingClientRect(),originalHeading=heading?.getBoundingClientRect();
        window.__frameMeasurement=new Promise(resolve=>{
          const failures=[];
          function sample(){
            const now=viewport.getBoundingClientRect();
            if(now.y!==originalViewport.y||now.height!==originalViewport.height)failures.push('Shared viewport shifted');
            document.querySelectorAll('.app-screen').forEach(screen=>{const r=screen.getBoundingClientRect();if(Math.abs(r.y-now.y)>.1||Math.abs(r.height-now.height)>.1||Math.abs(r.width-now.width)>.1)failures.push('Page bounds changed during animation');});
            if(heading?.isConnected){const next=heading.getBoundingClientRect();if(Math.abs(next.y-originalHeading.y)>.5)failures.push('Outgoing heading shifted');}
            if(performance.now()-start<650)requestAnimationFrame(sample);else resolve([...new Set(failures)]);
          }requestAnimationFrame(sample);
        });
      });
      await action();
      assert.deepEqual(await page.evaluate(()=>window.__frameMeasurement),[],`${device}: transition to ${destination}`);
      await page.locator(`[data-screen="${destination}"]`).waitFor();
    };
    const nav=(label,route)=>check(()=>page.getByRole('navigation').getByRole('button',{name:label,exact:true}).last().click(),route);
    await nav('Mind','analysis');await nav('Journal','history');await nav('Analysis','discoveryAnalysis');await nav('Home','home');
    await check(()=>page.getByRole('button',{name:'Open profile'}).click(),'profile');
    await page.getByText('Notifications',{exact:true}).scrollIntoViewIfNeeded();await page.waitForTimeout(100);
    await check(()=>page.getByText('Notifications',{exact:true}).click(),'notifications');
    await check(()=>page.getByRole('button',{name:'Go back',exact:true}).click(),'profile');
    await nav('Home','home');
    await check(()=>page.getByRole('button',{name:'Record a thought',exact:true}).click(),'think');
    await check(()=>page.getByRole('button',{name:/Stop/}).click(),'home');
    await context.close();
  }
  console.log('PASS: normal-motion tab, profile, settings and recording transitions retain viewport and outgoing heading positions on desktop/mobile.');
}finally{await browser.close();}
