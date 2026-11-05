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
for(const width of [320,390,768,1440]){
 const {page,context}=await setup(width);const root=page.locator('.journal-workspace');
 await page.screenshot({path:`artifacts/journal/${width}-catalogue.png`});
 const rows=root.locator('[data-journal-node]');assert.equal(await rows.count(),fixture.beliefs.filter(b=>b.userReaction!=='rejected').length);
 await root.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('textbox').fill(fixture.beliefs[0].statement.slice(0,12));await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');assert.equal(await page.getByRole('textbox').evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Escape');await page.getByText('Clear search',{exact:true}).waitFor();
 await root.getByRole('button',{name:'Filter',exact:true}).click();await page.getByRole('button',{name:/Most recurrent/}).click();
 await root.getByRole('button',{name:'Calendar',exact:true}).click();const dates=page.getByRole('dialog').locator('[role=button]').filter({hasText:/discovered/});if(await dates.count())await dates.first().click();else await page.keyboard.press('Escape');
 const scroll=root.locator('.journal-scroll');await scroll.evaluate(el=>el.scrollTop=140);const top=await scroll.evaluate(el=>el.scrollTop);const id=fixture.beliefs[0].id;const row=root.locator(`[data-journal-node="${id}"]`);await row.focus();await page.keyboard.press('Enter');await page.locator('.journal-node-hero').waitFor();assert.equal(await page.locator('.journal-node-hero h1').textContent(),fixture.beliefs[0].thoughtLabel||fixture.beliefs[0].statement);
 await page.screenshot({path:`artifacts/journal/${width}-node.png`});
 const entry=page.locator('.journal-node-entry').first();await entry.scrollIntoViewIfNeeded();const nodeTop=await page.locator('.journal-node-screen').evaluate(el=>el.scrollTop);await entry.click();await page.locator('.journal-original-writing').waitFor();assert.equal(await page.locator('.journal-original-writing').textContent(),fixture.history[0].text);await page.screenshot({path:`artifacts/journal/${width}-entry.png`});
 await page.getByRole('button',{name:'Go back'}).first().click();await page.locator('.journal-node-hero').waitFor();assert.ok(Math.abs(await page.locator('.journal-node-screen').evaluate(el=>el.scrollTop)-nodeTop)<3,'Node scroll lost');await page.getByRole('button',{name:'Back to Journal',exact:false}).click();await root.waitFor();await root.getByText('Clear search',{exact:true}).waitFor();await root.getByText('Clear filter',{exact:true}).waitFor();assert.ok(Math.abs(await scroll.evaluate(el=>el.scrollTop)-top)<3);assert.equal(await row.evaluate(el=>el===document.activeElement),true);
 await root.getByRole('tab',{name:/Trends/}).click();await page.screenshot({path:`artifacts/journal/${width}-trends.png`});assert.equal(await scroll.evaluate(el=>el.scrollWidth>el.clientWidth),false,'Trends overflow');if(width===1440)await writeFile('dist/journal-inspection.html',(await page.content()).replace(/<script[\s\S]*?<\/script>/g,''));for(const title of ['Emotion distribution','Value shifts','Thinking patterns (CBT)','Recording consistency','Self-talk over time'])assert.ok((await root.textContent()).toLowerCase().includes(title.toLowerCase()));assert.equal(await root.locator('[data-journal-node]').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await root.getByRole('tab',{name:'Catalogue',exact:true}).click();await root.getByText('Clear search',{exact:true}).waitFor();report.push({width,passed:true});await context.close();
}
for(const pro of [false,true]){const data={...emptyStore(),isPro:pro};const {page,context}=await setup(390,data);await page.getByText('Nothing catalogued yet.',{exact:false}).waitFor();assert.equal(await page.getByText('Nothing here yet.',{exact:true}).count(),6);assert.equal(await page.getByRole('tab',{name:/Trends/}).count(),pro?1:0);if(pro){await page.getByRole('tab',{name:/Trends/}).click();await page.getByText('No emotion data yet.',{exact:false}).waitFor();await page.getByText('No value-direction data yet.',{exact:false}).waitFor();await page.getByText('No recurring thinking patterns yet.',{exact:false}).waitFor();await page.getByText('Not enough weeks of recorded language yet',{exact:false}).waitFor();}await context.close();}
// Long text, rejection, undated discovery, missing optionals and unavailable nodes.
const edge=structuredClone(fixture);edge.beliefs[0].thoughtLabel=undefined;edge.beliefs[0].statement='An extended saved thought. '.repeat(35);edge.beliefs[0].confidenceHistory=[];edge.beliefs[0].supportingEntryIds=[];edge.beliefs[0].evidenceQuotes=[];edge.beliefs[0].evidenceCount=0;edge.beliefs[1].userReaction='rejected';
{const {page,context}=await setup(320,edge);const row=page.locator(`[data-journal-node="${edge.beliefs[0].id}"]`);assert.equal(await page.locator(`[data-journal-node="${edge.beliefs[1].id}"]`).count(),0);assert.ok((await row.textContent()).includes(edge.beliefs[0].statement));await row.click();await page.getByText('Not recorded',{exact:true}).first().waitFor();await page.getByText('No linked journal entries are available',{exact:false}).waitFor();assert.equal(await page.getByText('Development',{exact:true}).count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'artifacts/journal/long-node.png'});await context.close();}
{const {page,context}=await setup(390,fixture,'journalNode');await page.getByText('This star is no longer available',{exact:true}).waitFor();await context.close();}
await writeFile('artifacts/journal/checks.json',JSON.stringify(report,null,2));console.log('Journal browser checks passed',report);
}finally{await browser.close();}


