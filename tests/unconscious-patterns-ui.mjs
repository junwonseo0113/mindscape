import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { DEMO_STORE } from '../src/demo/demoData.ts';
import { emptyStore } from '../src/app/types.ts';

await mkdir('artifacts/patterns',{recursive:true});
// Isolated browser fixtures only. No generated fixture information enters real stores.
const fixture=structuredClone(DEMO_STORE),full=fixture.beliefs[0];
const sources=fixture.history.slice(0,3);
full.status='conflicted';full.distancedReframe='You notice yourself looking for safety before taking a step.';
full.possibleCognitivePatterns=['Should statements','All-or-nothing thinking'];
full.confidence=60;full.confidenceHistory=[{date:'2026.01.01',value:40},{date:'2026.01.02',value:50},{date:'2026.01.03',value:60}];
full.supportingEntryIds=sources.map(entry=>entry.id);
full.evidenceQuotes=sources.map(entry=>({date:entry.date,quote:entry.text}));
for(const entry of sources)entry.analysis={observation:{situation:'A decision at work',automaticThought:'I need to be certain first',emotions:[{label:'Worry',intensity:2},{label:'Sadness',intensity:8}],actionUrge:'Wait before taking action'},interpretation:{possibleCognitivePatterns:[],valueDirection:{relatedValues:[],towardOrAway:'unclear',explanation:''}},reasoningSummary:''};
fixture.connections=[{a:fixture.beliefs[0].id,b:fixture.beliefs[1].id,note:'Recorded reinforcing connection'},{a:fixture.beliefs[1].id,b:fixture.beliefs[2].id,note:'Another recorded connection'},{a:fixture.beliefs[0].id,b:fixture.beliefs[2].id,type:'contradiction',note:'Recorded tension explanation'}];
for(let index=0;index<9;index++)fixture.beliefs.push({...structuredClone(fixture.beliefs[2]),id:`fixture-long-${index}`,statement:`A longer recorded belief ${index+1}: ${'I keep waiting for enough certainty before starting something that matters. '.repeat(index===3?6:1)}`,thoughtLabel:undefined,confidenceHistory:undefined,possibleCognitivePatterns:undefined,supportingEntryIds:undefined,evidenceQuotes:[],distancedReframe:undefined});
fixture.beliefs.push({...structuredClone(full),id:'fixture-rejected',statement:'Rejected fixture belief must stay hidden',userReaction:'rejected'});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const report=[];
async function open(context,store,route='beliefs') {
  await context.addInitScript(data=>{localStorage.setItem('mijeong.store.v6',JSON.stringify(data));localStorage.setItem('mijeong.hasSeenTutorial','1');},store);
  await context.route('**/src/app/App.tsx*',async intercepted=>{const response=await intercepted.fetch(),body=await response.text();assert.ok(body.includes('React.useState("quote")'));await intercepted.fulfill({response,body:body.replace('React.useState("quote")',`React.useState(${JSON.stringify(route)})`)});});
  const page=await context.newPage();page.errors=[];page.on('pageerror',error=>page.errors.push(error.message));await page.goto('http://127.0.0.1:5173');await page.locator('.patterns-screen').waitFor();return page;
}
try {
for(const [device,viewport] of [['small',{width:320,height:568}],['mobile',{width:390,height:844}],['tablet',{width:768,height:1024}],['desktop',{width:1440,height:1000}]]) {
 const context=await browser.newContext({viewport,isMobile:device!=='desktop',hasTouch:device!=='desktop',reducedMotion:'reduce'});
 const page=await open(context,fixture),root=page.locator('.patterns-screen'),scroll=root.locator('.patterns-scroll');
 const tab=name=>root.getByRole('tab',{name,exact:true});
 assert.equal(await tab('Beliefs').getAttribute('aria-selected'),'true');
 assert.equal(await root.locator('.patterns-summary').count(),fixture.beliefs.length-1);
 assert.equal(await root.getByText('Rejected fixture belief must stay hidden',{exact:true}).count(),0);
 assert.equal(await root.getByText(`Confidence ${full.confidence}%`,{exact:true}).count(),0,'Dense metrics leaked into overview');
 await page.screenshot({path:`artifacts/patterns/${device}-beliefs.png`});
 await root.getByRole('button',{name:'About this analysis',exact:true}).click();
 await root.getByText('It takes at least 3 similar entries',{exact:false}).waitFor();
 await root.getByText("What's the difference between an unconscious belief and an interpretation?",{exact:true}).waitFor();
 assert.ok((await root.locator('.patterns-about').textContent()).includes(full.statement),'Educational example lost the first visible belief');
 await root.getByRole('button',{name:'About this analysis',exact:true}).click();
 await tab('Beliefs').focus();await page.keyboard.press('ArrowRight');assert.equal(await tab('Interpretations').getAttribute('aria-selected'),'true');
 assert.equal(await root.locator('.patterns-interpretation').count(),fixture.assumptions.length);
 for(const assumption of fixture.assumptions){await root.getByText(assumption.trigger,{exact:true}).waitFor();await root.getByText(`Found in ${assumption.count} conversations`,{exact:true}).first().waitFor();}
 await page.screenshot({path:`artifacts/patterns/${device}-interpretations.png`});
 await tab('Connections').click();await root.getByText('Beliefs That Support Each Other',{exact:true}).waitFor();await root.getByText('Tension Between What You\'ve Said',{exact:true}).waitFor();await root.getByText('Recorded tension explanation',{exact:true}).first().waitFor();
 const connected=root.locator('.patterns-connection-belief').nth(4);await connected.scrollIntoViewIfNeeded();const connectionScroll=await scroll.evaluate(el=>el.scrollTop);await connected.click();
 await root.getByRole('button',{name:'Back to Connections',exact:false}).click();assert.equal(await tab('Connections').getAttribute('aria-selected'),'true');assert.ok(Math.abs(await scroll.evaluate(el=>el.scrollTop)-connectionScroll)<2,'Connections scroll was not restored');
 await scroll.evaluate(el=>el.scrollTop=0);await page.screenshot({path:`artifacts/patterns/${device}-connections.png`});
 await tab('Beliefs').click();const summary=root.locator('.patterns-summary').nth(8);await summary.scrollIntoViewIfNeeded();const saved=await scroll.evaluate(el=>el.scrollTop);await summary.click();
 assert.equal(await root.getByRole('heading',{name:'Belief details',exact:true}).count(),1);
 assert.equal(await root.getByRole('button',{name:/See it from a distance/}).count(),0);assert.equal(await root.getByText('Confidence history',{exact:true}).count(),0);assert.equal(await root.getByText('Recent evidence',{exact:true}).count(),0);assert.equal(await root.getByRole('button',{name:/See why this pattern repeats/}).count(),0);
 await page.screenshot({path:`artifacts/patterns/${device}-sparse-detail.png`});
 await root.getByRole('button',{name:'Back to Beliefs',exact:false}).click();assert.ok(Math.abs(await scroll.evaluate(el=>el.scrollTop)-saved)<2,'Beliefs scroll was not restored');
 assert.ok(await summary.evaluate(el=>el===document.activeElement),'Return did not restore focus');
 await root.locator('.patterns-summary').first().click();
 await root.getByText('Conflicting entries exist',{exact:true}).waitFor();await root.getByText('Confidence 60%',{exact:true}).waitFor();await root.getByText('Predominant emotion · Sadness',{exact:true}).waitFor();await root.getByText('This thought has come back often in recent sessions.',{exact:true}).waitFor();
 await page.screenshot({path:`artifacts/patterns/${device}-detail.png`});
 const reframe=root.getByRole('button',{name:/See it from a distance/});await reframe.click();await root.getByRole('heading',{name:full.distancedReframe,exact:true}).waitFor();await root.getByRole('button',{name:/Back to the original/}).click();await root.getByRole('heading',{name:full.statement,exact:true}).waitFor();
 await root.locator('summary').filter({hasText:/^Confidence history$/}).click();await root.getByText('Confidence over time · 3 entries',{exact:true}).waitFor();await root.getByText('+20',{exact:true}).waitFor();
 const tags=root.locator('.patterns-cognitive');await tags.nth(0).locator('summary').click();await tags.nth(1).locator('summary').click();assert.equal(await tags.nth(0).getAttribute('open'),'');assert.equal(await tags.nth(1).getAttribute('open'),'');assert.equal(await tags.nth(0).getByText('What helps',{exact:true}).isVisible(),true);assert.equal(await tags.nth(1).getByText('What to watch for',{exact:true}).isVisible(),true);await tags.nth(0).locator('summary').click();assert.equal(await tags.nth(0).getAttribute('open'),null);assert.equal(await tags.nth(1).getAttribute('open'),'');
 await root.locator('summary').filter({hasText:/^Recent evidence$/}).click();const quotes=await root.locator('.patterns-evidence').allTextContents();assert.equal(quotes.length,2);assert.ok(quotes[0].includes(full.evidenceQuotes.at(-1).quote));assert.ok(quotes[1].includes(full.evidenceQuotes.at(-2).quote));
 await root.getByRole('button',{name:/See why this pattern repeats/}).click();for(const text of ['Situation','Automatic thought','Emotion','Action','Sadness (intensity 8)'])await root.getByText(text,{exact:true}).waitFor();assert.equal(await root.getByRole('button',{name:/Collapse repeat structure/}).getAttribute('aria-expanded'),'true');await page.screenshot({path:`artifacts/patterns/${device}-tools.png`});await root.getByRole('button',{name:/Collapse repeat structure/}).click();assert.equal(await root.locator('.patterns-loop').count(),0);
 const overflow=await root.evaluate(el=>[el,...el.querySelectorAll('*')].filter(node=>node.getBoundingClientRect().width>0&&node.scrollWidth>node.clientWidth+2&&!['svg','path','circle','line','polyline'].includes(node.tagName.toLowerCase())).map(node=>node.className));assert.deepEqual(overflow,[],'Content has horizontal clipping');
 await root.getByRole('button',{name:"This observation doesn't match how I see it",exact:true}).click();await tab('Beliefs').waitFor();assert.equal(await root.locator(`[data-open-belief="${full.id}"]`).count(),0);
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('mijeong.store.v6')));assert.equal(stored.beliefs.find(b=>b.id===full.id).userReaction,'rejected');assert.deepEqual(stored.history,fixture.history,'Rejecting deleted or changed journal entries');
 await root.getByRole('button',{name:'Back to Mind',exact:false}).click();await page.locator('[data-screen="analysis"]').waitFor();assert.deepEqual(page.errors,[]);
 report.push({device,result:'PASS'});console.log('PASS',device,'all views, optional data, tools, confidence, evidence ordering, rejection, scroll/focus and Back to Mind');await context.close();
}
for(const [name,store] of [['empty',emptyStore()],['all-rejected',{...structuredClone(fixture),beliefs:fixture.beliefs.map(b=>({...b,userReaction:'rejected'}))}]]){
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await open(context,store);
 await page.getByText('No unconscious beliefs discovered yet.',{exact:true}).waitFor();await page.getByRole('button',{name:'About this analysis',exact:true}).click();assert.ok((await page.locator('.patterns-about').textContent()).includes("I can only start once it's perfect"),'Empty educational example lost its existing fallback');await page.getByRole('button',{name:'About this analysis',exact:true}).click();await page.getByRole('tab',{name:'Interpretations',exact:true}).click();if(!store.assumptions.length)await page.getByText('No unconscious interpretations discovered yet.',{exact:true}).waitFor();await page.getByRole('tab',{name:'Connections',exact:true}).click();assert.equal(await page.locator('.patterns-connection-pair').count(),0);await page.getByText('No discovered connections yet.',{exact:true}).waitFor();await page.screenshot({path:`artifacts/patterns/${name}.png`});assert.deepEqual(page.errors,[]);report.push({state:name,result:'PASS'});await context.close();
}
const previewContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
const preview=await open(previewContext,DEMO_STORE);
await preview.screenshot({path:'artifacts/patterns/mobile-populated.png'});
const html=await preview.evaluate(()=>{const documentCopy=document.documentElement.cloneNode(true);documentCopy.querySelectorAll('script').forEach(script=>script.remove());return '<!doctype html>'+documentCopy.outerHTML;});
await writeFile('artifacts/patterns/inspection.html',html);
await previewContext.close();
await writeFile('artifacts/patterns/checks.json',JSON.stringify(report,null,2));
} finally {await browser.close();}
