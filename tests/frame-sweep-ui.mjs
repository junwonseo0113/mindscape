import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {DEMO_STORE} from '../src/demo/demoData.ts';

const routes=['quote','splash','auth','signup','login','onboarding','home','analysis','discoveryAnalysis','think','processing','thinkComplete','sessionSummary','softPaywall','crisisSupport','beliefs','assumptions','drift','aspirationSetup','hypotheses','hypothesisDetail','investigate','history','historyDetail','idealSelf','profile','paywall','checkout','manageSubscription','notifications','dataPrivacy','privacyPolicy','termsOfService','help','brainmap'];
await mkdir('artifacts/frame-sweep',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
const results=[];
try {
  for(const [device,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
    const context=await browser.newContext({viewport,reducedMotion:'reduce',isMobile:device==='mobile',hasTouch:device==='mobile'});
    await context.addInitScript(store=>{localStorage.setItem('mijeong.hasSeenTutorial','1');localStorage.setItem('mijeong.store.v6',JSON.stringify(store));},DEMO_STORE);
    // Test-only entry fixture: render every real route through the actual App shell.
    // This response patch is confined to this isolated browser; source code is unchanged.
    await context.route('**/src/app/App.tsx*',async route=>{
      const response=await route.fetch(),body=await response.text(),needle='React.useState("quote")';
      assert.ok(body.includes(needle),'Initial-route fixture no longer matches App');
      await route.fulfill({response,body:body.replace(needle,'React.useState(new URLSearchParams(location.search).get("sweep") || "quote")')});
    });
    await context.route('**/api/**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Read-only visual sweep: network operations disabled.'})}));
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const screen of routes){
      await page.goto(`http://127.0.0.1:5173/?sweep=${screen}`);
      const root=page.locator(`[data-screen="${screen}"]`);await root.waitFor({timeout:12000});await page.waitForTimeout(220);
      if(screen==='quote')await root.locator('img').evaluate(image=>image.decode());
      const metrics=await root.evaluate(el=>{
        const frame=el.closest('.theme-stargazing'),viewport=document.querySelector('[data-opening-viewport]'),content=el.querySelector('.screen-content'),body=content.firstElementChild;
        const box=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
        return {frame:box(frame),screen:box(el),viewport:box(viewport),content:box(content),inset:parseFloat(getComputedStyle(frame).getPropertyValue('--app-top-inset'))||0,bodyBackground:getComputedStyle(body).backgroundColor,bodyTop:getComputedStyle(body).top,overflow:document.documentElement.scrollWidth>innerWidth};
      });
      const failures=[];
      if(JSON.stringify(metrics.frame)!==JSON.stringify(metrics.screen))failures.push('Screen backdrop does not cover frame');
      if(JSON.stringify(metrics.frame)!==JSON.stringify(metrics.viewport))failures.push('Shared viewport changed size or position');
      const expected=['home','brainmap'].includes(screen)?0:metrics.inset;
      if(Math.abs(metrics.content.y-metrics.frame.y-expected)>.1)failures.push('Incorrect content inset');
      if(!['home','brainmap'].includes(screen)&&metrics.bodyBackground!=='rgba(0, 0, 0, 0)')failures.push('Opaque root obscures shared backdrop');
      if(metrics.bodyTop.startsWith('-'))failures.push('Legacy negative root offset');
      if(metrics.overflow)failures.push('Horizontal viewport overflow');
      const buffer=await page.screenshot({path:`artifacts/frame-sweep/${device}-${screen}.png`});
      if(device==='desktop'&&screen!=='brainmap'){
        const differences=await page.evaluate(async({data,frame})=>{
          const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();
          const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
          return [.15,.5,.85].map(f=>{const x=Math.round(frame.x+frame.width*f),a=ctx.getImageData(x,Math.round(frame.y+27),1,1).data,b=ctx.getImageData(x,Math.round(frame.y+33),1,1).data;return Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2]);});
        },{data:buffer.toString('base64'),frame:metrics.frame});
        if(Math.max(...differences)>70)failures.push(`Status-bar seam: ${differences.join(',')}`);
      }
      results.push({device,screen,failures});console.log(`${device} ${screen}: ${failures.length?failures.join('; '):'PASS'}`);
      const slides=screen==='onboarding'?['Get Started','Next','Next','Next']:screen==='investigate'?['Start','Next','Next']:[];
      for(let index=0;index<slides.length;index++){
        await page.getByRole('button',{name:slides[index],exact:true}).click();await page.waitForTimeout(100);
        const slideFailures=[];
        const bounds=await root.boundingBox();if(JSON.stringify(bounds)!==JSON.stringify(metrics.frame))slideFailures.push('Slide changed screen bounds');
        const pixels=await page.screenshot({path:`artifacts/frame-sweep/${device}-${screen}-slide-${index+1}.png`});
        if(device==='desktop'){
          const difference=await page.evaluate(async({data,frame})=>{const im=new Image();im.src='data:image/png;base64,'+data;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);return Math.max(...[.15,.5,.85].map(f=>{const x=Math.round(frame.x+frame.width*f),a=ctx.getImageData(x,Math.round(frame.y+27),1,1).data,b=ctx.getImageData(x,Math.round(frame.y+33),1,1).data;return Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2]);}));},{data:pixels.toString('base64'),frame:metrics.frame});
          if(difference>70)slideFailures.push('Internal slide introduced a status-bar seam');
        }
        results.push({device,screen:`${screen}-slide-${index+1}`,failures:slideFailures});
      }

    }
    assert.deepEqual(errors,[],`${device}: browser errors`);await context.close();
  }
  await writeFile('artifacts/frame-sweep/report.json',JSON.stringify(results,null,2));
  assert.deepEqual(results.filter(r=>r.failures.length),[],'Frame sweep found layout problems');
  console.log(`PASS: ${results.length} real-route frame, background, safe-area and seam checks.`);
} finally {await browser.close();}
