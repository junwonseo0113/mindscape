import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {DEMO_STORE} from '../src/demo/demoData.ts';

await mkdir('artifacts/evening-screens',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
const origin=process.env.MINDSCAPE_TEST_URL||'http://127.0.0.1:5173';
try {
  for(const [name,viewport] of [['mobile',{width:390,height:844}],['desktop',{width:1440,height:1000}]]) {
    const context=await browser.newContext({viewport,isMobile:name==='mobile',hasTouch:name==='mobile',reducedMotion:'reduce'});
    await context.addInitScript(store=>{localStorage.setItem('mijeong.hasSeenTutorial','1');localStorage.setItem('mijeong.store.v6',JSON.stringify(store));},DEMO_STORE);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const capture=async (screen,suffix='')=>{
      try{await page.locator(`[data-screen="${screen}"]`).waitFor({timeout:10000});}catch(error){await page.screenshot({path:'artifacts/evening-screens/debug-current.png'});console.log('CURRENT',await page.locator('[data-screen]').getAttribute('data-screen'),errors);throw error;}await page.waitForTimeout(150);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${screen}: viewport overflow`);
      const heading=page.locator(`[data-screen="${screen}"] h1`).first();if(await heading.count()){const bounds=await heading.boundingBox();assert.ok(bounds&&bounds.y>=10&&bounds.x>=0,`${screen}: heading clipped`);}
      assert.equal(await page.locator(`[data-screen="${screen}"] .observatory-nebula`).count(),screen==='home'?1:0);
      await page.screenshot({path:`artifacts/evening-screens/${name}-${screen}${suffix}.png`});
      if(origin.includes(':5174')&&name==='mobile'&&!suffix&&['analysis','history','idealSelf'].includes(screen)){const html=(await page.content()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('<head>','<head><base href="'+origin+'/">');await (await import('node:fs/promises')).writeFile(`artifacts/evening-screens/audit-${screen}.html`,html);}
    };
    const nav=async label=>{await page.getByRole('navigation').getByRole('button',{name:label,exact:true}).last().click();await page.waitForTimeout(150);};
    await page.goto(origin);await capture('auth');await page.getByText('Browse as a guest',{exact:true}).click();await page.getByText('Get Started',{exact:true}).click();
    for(let i=0;i<3;i++){await page.getByText('Next',{exact:true}).click();await page.waitForTimeout(100);}await capture('onboarding');await page.getByText(/Skip and start|Save and start/).click();
    await page.getByRole('button',{name:'Open profile'}).waitFor();
    await nav('Mind');await capture('analysis');await page.getByRole('button',{name:/Unconscious patterns/}).click();await capture('beliefs');await page.getByRole('button',{name:/Back/}).first().click();await page.getByRole('button',{name:/Distance from your aspiration/}).click();await capture('drift');await page.getByRole('button',{name:/Back/}).first().click();
    await nav('Analysis');await capture('discoveryAnalysis');await page.getByRole('button',{name:"Examine today's discovery"}).click();await page.getByRole('button',{name:'Back to Analysis'}).waitFor();await capture('discoveryAnalysis','-examine');await page.getByRole('button',{name:'Back to Analysis'}).click();
    await nav('Journal');await capture('history');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('textbox',{name:'Search the star catalogue'}).fill('Safety');await capture('history','-search');await page.getByRole('button',{name:'Close',exact:true}).last().click();
    const ground=await page.locator('[data-screen="history"]').evaluate(el=>getComputedStyle(el).getPropertyValue('--evening-ground'));
    await nav('Mind');assert.notEqual(await page.locator('[data-screen="analysis"]').evaluate(el=>getComputedStyle(el).getPropertyValue('--evening-ground')),ground,'Journal and Mind should have different atmosphere');
    await nav('Home');await page.getByRole('button',{name:'Open profile'}).click();await capture('profile');
    await page.getByText('Ideal Self',{exact:true}).click();await capture('idealSelf');
    await page.getByLabel('Qualities I want to nurture').fill('Patience');
    assert.equal(await page.getByRole('button',{name:'Save confirmed profile'}).isDisabled(),true);
    await page.getByRole('button',{name:'Back',exact:true}).click();
    await page.getByText('Notifications',{exact:true}).click();await capture('notifications');
    const reminder=page.getByRole('switch',{name:'Daily reminder',exact:true}),before=await reminder.getAttribute('aria-checked');await reminder.click();assert.notEqual(await reminder.getAttribute('aria-checked'),before);
    await page.getByRole('button',{name:'Go back',exact:true}).click();await page.getByText('Data & Privacy',{exact:true}).click();await capture('dataPrivacy');
    await page.getByRole('button',{name:'Go back',exact:true}).click();await page.getByText('Help',{exact:true}).click();await capture('help');
    await page.getByRole('button',{name:'Go back',exact:true}).click();await nav('Home');
    await page.getByRole('button',{name:'Record a thought',exact:true}).click();await capture('think');
    await page.getByRole('textbox',{name:'Speak your mind'}).fill('A test draft that stays on this screen.');
    await page.getByRole('button',{name:/Stop/}).click();
    await page.setViewportSize({width:320,height:568});await page.getByRole('button',{name:'Open profile'}).click();await capture('profile','-small');await nav('Journal');await capture('history','-small');assert.deepEqual(errors,[]);await context.close();
  }
  const fresh=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await fresh.addInitScript(()=>localStorage.setItem('mijeong.hasSeenTutorial','1'));
  const freshPage=await fresh.newPage();await freshPage.goto(origin);await freshPage.getByText('Browse as a guest',{exact:true}).click();await freshPage.getByText('Get Started',{exact:true}).click();for(let i=0;i<3;i++){await freshPage.getByText('Next',{exact:true}).click();await freshPage.waitForTimeout(100);}await freshPage.getByText(/Skip and start|Save and start/).click();
  for(const [label,screen] of [['Mind','analysis'],['Analysis','discoveryAnalysis'],['Journal','history']]){await freshPage.getByRole('navigation').getByRole('button',{name:label,exact:true}).last().click();await freshPage.locator(`[data-screen="${screen}"]`).waitFor();await freshPage.waitForTimeout(100);await freshPage.screenshot({path:`artifacts/evening-screens/empty-${screen}.png`});}
  await fresh.close();
  console.log('PASS: distinct evening screens, mobile/desktop/320px, empty states, evidence review, search, navigation, settings, Ideal Self gate, and recording draft.');
} finally {await browser.close();}
