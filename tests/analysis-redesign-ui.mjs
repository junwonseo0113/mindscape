import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {DEMO_STORE} from '../src/demo/demoData.ts';
import {emptyStore} from '../src/app/types.ts';
import {ADDITIONAL_QUOTES} from '../src/app/additionalQuotes.ts';
await mkdir('artifacts/analysis',{recursive:true});
const fixture=structuredClone(DEMO_STORE);fixture.goals=[];delete fixture.goalsBeliefSnapshot;
fixture.literaryMatch={passageId:'nin-becoming',themes:['independence'],selectedDate:'2026.01.01'};
fixture.beliefs[0].contradictoryEntryIds=[fixture.history[0].id];
fixture.hypotheses[0].evidence=[{date:'2025.01.01',quote:'Oldest fixture excerpt'},...fixture.hypotheses[0].evidence];
fixture.hypotheses[0].evidence.at(-1).domain='Career';
fixture.hypotheses[1].investigate=undefined;
fixture.beliefs[2].lastUpdatedAt='2026.11.01';fixture.beliefs[2].evidenceQuotes=[{date:'2026.01.01',quote:'Earliest belief evidence'},{date:'2026.10.01',quote:'Latest belief evidence'}];
fixture.beliefs.push({...structuredClone(fixture.beliefs[2]),id:'fixture-long-belief',thoughtLabel:undefined,statement:'A longer recorded thought: '+('I wait for certainty before trying something important. '.repeat(12)),lastUpdatedAt:'2026.11.02',evidenceQuotes:[],confidenceHistory:undefined});
fixture.beliefs.push({...structuredClone(fixture.beliefs[2]),id:'fixture-rejected',statement:'Rejected fixture interpretation',userReaction:'rejected'});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const report=[];
let activePage=null;
async function setup(viewport,store=fixture,options={}) {
 const context=await browser.newContext({viewport,reducedMotion:'reduce',isMobile:viewport.width<=480,hasTouch:viewport.width<=480});
 await context.addInitScript(data=>{localStorage.setItem('mijeong.store.v6',JSON.stringify(data));localStorage.setItem('mijeong.hasSeenTutorial','1');},store);
 // All API calls in this harness are isolated doubles; no user data or AI calls.
 let mode='reinterpret',goalCalls=0,reinterpretCalls=0;
 await context.route('**/api/**',async route=>{
  if(route.request().url().endsWith('/infer-goals')){goalCalls++;return route.fulfill({json:{goals:Array.from({length:4},(_,index)=>({statement:`Fixture growth direction ${index+1}`,basedOnDomains:['Career']}))}});}
  if(route.request().url().endsWith('/reinterpret')){reinterpretCalls++;await new Promise(resolve=>setTimeout(resolve,350));return mode==='error'?route.fulfill({status:503,json:{error:'Fixture unavailable'}}):route.fulfill({json:mode==='exhausted'?{interpretation:null,confidence:null,exhausted:true}:{interpretation:'A reconsidered fixture interpretation of the same evidence.',confidence:66,exhausted:false}});}
  return route.fulfill({status:503,json:{error:'Fixture: endpoint not used'}});
 });
 await context.route('**/src/app/App.tsx*',async route=>{const response=await route.fetch(),body=await response.text();assert.ok(body.includes('React.useState("quote")'));await route.fulfill({response,body:body.replace('React.useState("quote")',`React.useState(${JSON.stringify(options.start||'discoveryAnalysis')})`)});});
 if(options.library)await context.route('**/src/app/literaryPassages.ts*',async route=>{const response=await route.fetch(),body=await response.text();const expression=/export const LITERARY_PASSAGES = \[[\s\S]*?\n\];/;assert.ok(expression.test(body),'Library fixture no longer matches');await route.fulfill({response,body:body.replace(expression,'export const LITERARY_PASSAGES = '+JSON.stringify(options.library)+';')});});
 const page=await context.newPage(),errors=[];activePage=page;page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:5173');
 return {context,page,errors,counts:()=>({goalCalls,reinterpretCalls}),mode:value=>{mode=value;}};
}
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('mijeong.store.v6')));
async function noOverflow(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const root=page.locator('.analysis-workspace,.analysis-investigation');const box=await root.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=await page.evaluate(()=>innerWidth));}
try{
for(const [device,viewport] of [['small',{width:320,height:568}],['mobile',{width:390,height:844}],['tablet',{width:768,height:1024}],['desktop',{width:1440,height:1000}]]){
 const app=await setup(viewport),{page}=app,root=page.locator('.analysis-workspace');await root.waitFor();
 const hero=root.locator('.analysis-featured');assert.ok((await hero.textContent()).includes(fixture.hypotheses[0].thoughtLabel));
 assert.equal(await root.getByText('Rejected fixture interpretation',{exact:true}).count(),0);
 const keys=await root.locator('.analysis-insight').evaluateAll(nodes=>nodes.map(node=>node.dataset.insightKey));assert.deepEqual(keys,['belief:fixture-long-belief','belief:demo-belief-2','hyp:2','hyp:1']);
 await page.screenshot({path:`artifacts/analysis/${device}-overview.png`});await noOverflow(page);
 const next=root.getByRole('button',{name:'Next insights',exact:true});assert.equal(await next.isEnabled(),true);await next.click();await page.waitForTimeout(150);assert.ok(await root.locator('.analysis-carousel').evaluate(el=>el.scrollLeft)>0);assert.equal(await root.getByRole('button',{name:'Previous insights',exact:true}).isEnabled(),true);
 // Every card opens its own complete target, including a long statement.
 for(const key of keys){const card=root.locator(`[data-insight-key="${key}"]`);await card.scrollIntoViewIfNeeded();const left=await root.locator('.analysis-carousel').evaluate(el=>el.scrollLeft);const top=await root.locator('.analysis-scroll').evaluate(el=>el.scrollTop);await card.click();await root.locator('.analysis-examine-hero').waitFor();const expected=key.startsWith('hyp:')?fixture.hypotheses[Number(key.split(':')[1])].title:fixture.beliefs.find(b=>`belief:${b.id}`===key).statement;assert.equal(await root.locator('.analysis-examine-hero h2').textContent(),expected);await noOverflow(page);
  if(key==='hyp:1')assert.equal(await root.getByRole('button',{name:'Dig deeper',exact:true}).count(),0);
  if(key==='belief:fixture-long-belief'){await root.getByText('No entries to cite as evidence yet.',{exact:true}).waitFor();assert.equal(await root.locator('summary').filter({hasText:/^How this has evolved$/}).count(),0);await page.screenshot({path:`artifacts/analysis/${device}-long-detail.png`});}
  if(key==='belief:demo-belief-2'){await root.locator('summary').filter({hasText:/^How this has evolved$/}).click();await root.getByText('Earliest belief evidence',{exact:true}).last().waitFor();await root.getByText('Latest belief evidence',{exact:true}).last().waitFor();}
  await root.getByRole('button',{name:'Back to Analysis',exact:true}).click();assert.ok(Math.abs(await root.locator('.analysis-carousel').evaluate(el=>el.scrollLeft)-left)<2,'Carousel position was lost');assert.ok(Math.abs(await root.locator('.analysis-scroll').evaluate(el=>el.scrollTop)-top)<2,`Overview scroll was lost for ${key}: expected ${top}, actual ${await root.locator('.analysis-scroll').evaluate(el=>el.scrollTop)}`);assert.equal(await card.evaluate(el=>el===document.activeElement),true);
 }
 await root.getByRole('button',{name:"Examine today's discovery",exact:true}).click();
 await page.screenshot({path:`artifacts/analysis/${device}-evidence.png`});
  await root.getByText('Entries pointing the other way',{exact:true}).waitFor();await root.locator('.analysis-evidence-meta').getByText('Career',{exact:true}).first().waitFor();
 const expectedEvidence=fixture.hypotheses[0].evidence.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3).sort((a,b)=>a.date.localeCompare(b.date));const visible=await root.locator('.analysis-evidence').first().locator('p').allTextContents();for(const quote of expectedEvidence)assert.ok(visible.some(text=>text.includes(quote.quote)));assert.ok(!visible.some(text=>text.includes('Oldest fixture excerpt')));
 await page.getByText('Fixture growth direction 3',{exact:true}).waitFor();assert.equal(await page.getByText('Fixture growth direction 4',{exact:true}).count(),0);assert.equal(app.counts().goalCalls,1);
 await root.locator('summary').filter({hasText:/^For where you are now$/}).click();await root.getByText('Keep writing.',{exact:true}).waitFor();assert.equal(await root.getByText(/Excerpt pending rights clearance|Anaïs Nin/).count(),0);assert.equal((await stored(page)).literaryMatch,null);
 await root.locator('summary').filter({hasText:/^How this has evolved$/}).click();const inv=fixture.hypotheses[0].investigate;await root.getByText(inv.origin.quote,{exact:true}).last().waitFor();
 await root.getByRole('button',{name:/Review this interpretation/}).click();await root.getByRole('button',{name:'I agree',exact:true}).click();await root.getByText('You accepted this observation.',{exact:true}).waitFor();assert.equal(await root.getByRole('button',{name:'I agree',exact:true}).count(),0);assert.equal((await stored(page)).hypotheses[0].reaction,'agree');
 await page.screenshot({path:`artifacts/analysis/${device}-examine.png`});
 const dig=root.getByRole('button',{name:'Dig deeper',exact:true});await dig.scrollIntoViewIfNeeded();const detailTop=await root.locator('.analysis-scroll').evaluate(el=>el.scrollTop);await dig.click();await page.locator('.analysis-investigation').waitFor();await page.getByLabel('Step 1 of 4',{exact:true}).waitFor();await page.getByRole('button',{name:'Start',exact:true}).click();await page.getByLabel('Step 2 of 4',{exact:true}).waitFor();await page.getByText(inv.origin.quote,{exact:false}).waitFor();await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByLabel('Step 3 of 4',{exact:true}).waitFor();for(const text of [...inv.compareSteps1,...inv.compareSteps2])await page.getByText(text,{exact:true}).first().waitFor();await page.screenshot({path:`artifacts/analysis/${device}-investigation.png`});await page.getByRole('button',{name:'Previous investigation step',exact:true}).click();await page.getByLabel('Step 2 of 4',{exact:true}).waitFor();await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByLabel('Step 4 of 4',{exact:true}).waitFor();await page.getByRole('heading',{name:inv.related,exact:true}).waitFor();await page.getByRole('button',{name:'Back to the hypothesis',exact:true}).last().click();await root.waitFor();assert.equal(await root.locator('.analysis-examine-hero h2').textContent(),fixture.hypotheses[0].title);assert.ok(Math.abs(await root.locator('.analysis-scroll').evaluate(el=>el.scrollTop)-detailTop)<2,'Investigation lost Examine scroll');assert.equal(await root.locator('details').filter({has:page.locator('summary').filter({hasText:/^How this has evolved$/})}).getAttribute('open'),'');
 await root.getByRole('button',{name:'Back to Analysis',exact:true}).click();assert.ok((await hero.textContent()).includes(fixture.hypotheses[0].thoughtLabel),'Acceptance changed the pinned discovery');
 // Reconsideration, failures and exhaustion preserve the selected target.
 await root.locator('[data-insight-key="hyp:1"]').click();app.mode('error');await root.getByRole('button',{name:"Doesn't feel right",exact:true}).click();await root.getByText('Reconsidering...',{exact:true}).waitFor();await root.getByRole('alert').waitFor();assert.equal(await root.locator('.analysis-examine-hero h2').textContent(),fixture.hypotheses[1].title);
 app.mode('reinterpret');await root.getByRole('button',{name:"Doesn't feel right",exact:true}).click();await root.getByRole('heading',{name:'A reconsidered fixture interpretation of the same evidence.',exact:true}).waitFor();assert.equal((await stored(page)).hypotheses[1].id,fixture.hypotheses[1].id);
 app.mode('exhausted');await root.getByRole('button',{name:"Doesn't feel right",exact:true}).click();await root.getByText("That's as far as we've gotten for now.",{exact:true}).waitFor();assert.equal(await root.getByRole('button',{name:"Doesn't feel right",exact:true}).count(),0);await noOverflow(page);assert.deepEqual(app.errors,[]);report.push({device,result:'PASS'});console.log('PASS',device,'selection, ordering, exact targets, scroll, evidence, growth, placeholder fallback, review states and four investigation steps');await app.context.close();
}
// Empty states, fallback belief selection, Premium restrictions and direct review entry.
for(const [name,store] of [['empty',emptyStore()],['below-threshold',{...emptyStore(),beliefs:fixture.beliefs.slice(0,2),isPro:false}],['belief-tiebreak',{...emptyStore(),beliefs:fixture.beliefs.slice(0,2).map((belief,index)=>({...belief,lastUpdatedAt:'2026.01.01',confidence:index?90:40})),isPro:true}]]){
 const app=await setup({width:390,height:844},store),root=app.page.locator('.analysis-workspace');await root.waitFor();if(!store.beliefs.length){await root.getByText("Nothing discovered yet. It'll show up here after you leave a few thoughts.",{exact:true}).waitFor();await root.getByText('No other insights yet',{exact:false}).waitFor();}else{await root.getByRole('button',{name:"Examine today's discovery",exact:true}).click();if(name==='belief-tiebreak')assert.equal(await root.locator('.analysis-examine-hero h2').textContent(),store.beliefs[1].statement);if(!store.isPro)assert.equal(await root.locator('summary').filter({hasText:/^For where you are now$/}).count(),0);assert.equal(app.counts().goalCalls,0);}await app.page.screenshot({path:`artifacts/analysis/${name}.png`});await noOverflow(app.page);assert.deepEqual(app.errors,[]);await app.context.close();report.push({state:name,result:'PASS'});
}
{
 const app=await setup({width:390,height:844},fixture,{start:'home'});await app.page.getByRole('button',{name:/discover.*to review/}).click();await app.page.locator('.analysis-examine-hero').waitFor();assert.equal(await app.page.locator('.analysis-examine-hero h2').textContent(),fixture.hypotheses[0].title);await app.page.getByRole('button',{name:'Back to Analysis',exact:true}).click();await app.page.locator('.analysis-featured').waitFor();assert.deepEqual(app.errors,[]);await app.context.close();report.push({state:'direct-home-review',result:'PASS'});
}
// Belief review uses its existing override/reaction fields, never rejection.
{
 const data=structuredClone(fixture);data.hypotheses=[];data.beliefs[0].lastUpdatedAt='2026.12.01';
 const app=await setup({width:390,height:844},data),root=app.page.locator('.analysis-workspace');
 await root.getByRole('button',{name:"Examine today's discovery",exact:true}).click();
 await root.getByRole('button',{name:"Doesn't feel right",exact:true}).click();
 await root.getByRole('heading',{name:'A reconsidered fixture interpretation of the same evidence.',exact:true}).waitFor();
 const updated=(await stored(app.page)).beliefs.find(b=>b.id===data.beliefs[0].id);assert.equal(updated.discoveryInterpretationOverride,'A reconsidered fixture interpretation of the same evidence.');assert.notEqual(updated.userReaction,'rejected');assert.equal(updated.confidence,data.beliefs[0].confidence);
 await root.getByRole('button',{name:'I agree',exact:true}).click();await root.getByText('You accepted this observation.',{exact:true}).waitFor();assert.equal((await stored(app.page)).beliefs[0].discoveryReaction,'agree');
 assert.deepEqual(app.errors,[]);await app.context.close();report.push({state:'belief-review-semantics',result:'PASS'});
}
// Verified pre-existing quote text is used ONLY as a controlled test library.
const readings=[['Mary Wollstonecraft','independence'],['Jane Austen','fear']].map(([author,theme],index)=>{const quote=ADDITIONAL_QUOTES.find(q=>q.author===author);return {id:`fixture-reading-${index}`,exactText:quote.text,author:quote.author,authorId:quote.portrait.replace(/-0[1-4]$/,''),work:quote.source.title,source:quote.source.url,rightsStatus:'public-domain',themes:[theme]};});
{
 const data=structuredClone(fixture);data.hypotheses=[];data.beliefs=data.beliefs.slice(0,3);data.beliefs.forEach((belief,index)=>{belief.evidenceQuotes=[];belief.supportingEntryIds=[];belief.contradictoryEntryIds=[];belief.thoughtLabel=undefined;belief.domain='';belief.statement=index===0?'I want to live independently and alone.':index===1?'I feel anxious and afraid.':'The timetable has four appointments.';belief.lastUpdatedAt=index===0?'2026.11.03':'2026.11.01';});
 const app=await setup({width:390,height:844},data,{library:readings}),root=app.page.locator('.analysis-workspace');await root.getByRole('button',{name:"Examine today's discovery",exact:true}).click();await root.locator('summary').filter({hasText:/^For where you are now$/}).click();await root.getByText(readings[0].exactText,{exact:true}).waitFor();assert.equal(await root.locator('.analysis-literary img').count(),0,'Unrelated portrait substituted');const initial=(await stored(app.page)).literarySelections['belief:demo-belief-0'];
 await root.getByRole('button',{name:'Back to Analysis',exact:true}).click();await root.locator('[data-insight-key="belief:demo-belief-1"]').click();await root.locator('summary').filter({hasText:/^For where you are now$/}).click();await root.getByText(readings[1].exactText,{exact:true}).waitFor();assert.ok((await stored(app.page)).literarySelections['belief:demo-belief-0']);
 await root.getByRole('button',{name:'Back to Analysis',exact:true}).click();await root.getByRole('button',{name:"Examine today's discovery",exact:true}).click();assert.equal((await stored(app.page)).literarySelections['belief:demo-belief-0'].signature,initial.signature);
 await app.page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('mijeong.store.v6'));data.beliefs[0].statement='I feel anxious and afraid.';localStorage.setItem('mijeong.store.v6',JSON.stringify(data));});
 // Reload only the store. Disable the fixture's addInitScript re-seed for this reload.
 await app.context.unroute('**/src/app/App.tsx*');await app.context.route('**/src/app/App.tsx*',async route=>{const response=await route.fetch(),body=await response.text();await route.fulfill({response,body:body.replace('React.useState("quote")','React.useState("discoveryAnalysis")')});});
 // addInitScript re-seeds on navigation; exercise unchanged-count cache refresh via a new context.
 const changed=await stored(app.page);await app.context.close();const updated=await setup({width:390,height:844},changed,{library:readings});const updatedRoot=updated.page.locator('.analysis-workspace');await updatedRoot.getByRole('button',{name:"Examine today's discovery",exact:true}).click();await updatedRoot.locator('summary').filter({hasText:/^For where you are now$/}).click();await updatedRoot.getByText(readings[1].exactText,{exact:true}).waitFor();assert.notEqual((await stored(updated.page)).literarySelections['belief:demo-belief-0'].signature,initial.signature);assert.deepEqual(updated.errors,[]);await updated.context.close();report.push({state:'per-discovery-reading-and-same-count-refresh',result:'PASS'});
}
// Presentation-only preview from the existing example store; avoid AI calls.
{
 const data=structuredClone(DEMO_STORE);data.goalsBeliefSnapshot=data.beliefs.length;
 const app=await setup({width:390,height:844},data),root=app.page.locator('.analysis-workspace');await root.waitFor();await app.page.screenshot({path:'artifacts/analysis/mobile-populated.png'});
 await root.getByRole('button',{name:"Examine today's discovery",exact:true}).click();await root.locator('.analysis-examine-hero').waitFor();await app.page.screenshot({path:'artifacts/analysis/mobile-examine-populated.png'});
 await root.getByRole('button',{name:'Back to Analysis',exact:true}).click();
 const html=await app.page.evaluate(()=>{const copy=document.documentElement.cloneNode(true);copy.querySelectorAll('script').forEach(script=>script.remove());return '<!doctype html>'+copy.outerHTML;});await writeFile('artifacts/analysis/inspection.html',html);await app.context.close();
}
await writeFile('artifacts/analysis/checks.json',JSON.stringify(report,null,2));
}catch(error){if(activePage&&!activePage.isClosed()){await activePage.screenshot({path:'artifacts/analysis/failure.png'});await writeFile('artifacts/analysis/failure-state.json',JSON.stringify({url:activePage.url(),text:await activePage.locator('body').innerText(),store:await stored(activePage)},null,2));}throw error;}finally{await browser.close();}
