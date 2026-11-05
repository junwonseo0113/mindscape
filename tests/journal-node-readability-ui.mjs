import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {DEMO_STORE} from '../src/demo/demoData.ts';
import {emptyStore} from '../src/app/types.ts';
await mkdir('artifacts/journal',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const fixture=structuredClone(DEMO_STORE);fixture.isPro=true;
fixture.beliefs[0].supportingEntryIds=[fixture.history[0].id];
const report=[];
async function setup(width,store=fixture,start='history'){const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});await context.addInitScript(data=>{localStorage.setItem('mijeong.store.v6',JSON.stringify(data));localStorage.setItem('mijeong.hasSeenTutorial','1');},store);await context.route('**/api/**',r=>r.fulfill({status:503,json:{error:'Test isolated'}}));await context.route('**/src/app/App.tsx*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('React.useState("quote")',`React.useState(${JSON.stringify(start)})`)});});const page=await context.newPage();await page.goto('http://127.0.0.1:5173');await page.locator(start==='history'?'.journal-workspace':'.journal-node-screen').waitFor();return {page,context};}
try{
for(const width of [320,390,1440]){
 const data=structuredClone(fixture);data.connections=data.beliefs.slice(1,4).map(b=>({a:data.beliefs[0].id,b:b.id,note:'Saved explanation '+b.statement}));
 const {page,context}=await setup(width,data);await page.locator(`[data-journal-node="${data.beliefs[0].id}"]`).click();const root=page.locator('.journal-node-screen');
 assert.equal(await root.locator('h1').textContent(),data.beliefs[0].statement);assert.equal(await root.locator('.journal-node-label').textContent(),data.beliefs[0].thoughtLabel);
 const headings=await root.locator('h2').allTextContents();assert.ok(headings.indexOf('Supporting entries')<headings.indexOf('Development'));assert.equal(await root.locator('.journal-node-connection').count(),3);
 const disclosure=root.locator('summary').filter({hasText:'About this interpretation'});await disclosure.focus();await page.keyboard.press('Enter');assert.equal(await disclosure.locator('..').getAttribute('open'),'');await root.getByText('An interpretation to reflect on.',{exact:false}).waitFor();
 await root.locator('summary').filter({hasText:'About confidence history'}).click();await root.getByText('confidence is not a measure of personal improvement.',{exact:false}).waitFor();
 await root.evaluate(el=>el.scrollTop=0);await page.screenshot({path:`artifacts/journal/${width}-node-readability.png`});
 await root.locator('h1,p,blockquote,dt,dd,time,strong,summary,h2,button').evaluateAll(nodes=>{const sizes=nodes.map(el=>parseFloat(getComputedStyle(el).fontSize));nodes.forEach((el,i)=>el.style.setProperty('font-size',`${sizes[i]*2}px`,'important'));});assert.equal(await root.evaluate(el=>el.scrollWidth>el.clientWidth),false,'200% text overflows');await page.screenshot({path:`artifacts/journal/${width}-node-text-zoom.png`});report.push({width,textZoom:'200%',passed:true});await context.close();
}
await writeFile('artifacts/journal/node-readability-checks.json',JSON.stringify(report,null,2));console.log('Node readability, keyboard disclosure, multiple connections and 200% text checks passed',report);
}finally{await browser.close();}
