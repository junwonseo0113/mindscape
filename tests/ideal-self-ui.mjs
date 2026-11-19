import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

await mkdir('artifacts/ideal-self',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
const origin=process.env.MINDSCAPE_TEST_URL||'http://127.0.0.1:5173';
const owner='00000000-0000-4000-8000-000000000001';
const entries=[{id:'ideal-test-entry-1',date:'2026.10.01',text:'I held back my needs in a meeting.'},{id:'ideal-test-entry-2',date:'2026.10.02',text:'I shared my needs with a friend.'}];
async function start(context,withEntries=false){
  await context.addInitScript(({withEntries,entries})=>{localStorage.setItem('mijeong.hasSeenTutorial','1');if(withEntries&&!localStorage.getItem('mijeong.store.v6'))localStorage.setItem('mijeong.store.v6',JSON.stringify({history:entries,isPro:true}));},{withEntries,entries});
  const page=await context.newPage();await page.goto(origin);
  await page.getByText('Browse as a guest',{exact:true}).click();await page.getByText('Get Started',{exact:true}).click();
  for(let i=0;i<3;i++){await page.getByText('Next',{exact:true}).click();await page.waitForTimeout(420);}
  await page.getByText(/Skip and start|Save and start/).click();await page.getByRole('button',{name:'Open profile'}).waitFor();
  await page.getByRole('button',{name:'Open profile'}).click();await page.getByText('Ideal Self',{exact:true}).click();
  await page.getByRole('heading',{name:'Ideal Self',exact:true}).waitFor();
  return page;
}
try {
  // Actual installation, no account or API mocks.
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const page=await start(context);
  await page.getByText(/Account storage is not configured|Sign in to save a private Ideal Self profile/).waitFor();
  await page.getByLabel('Qualities I want to nurture').fill('A patient way of responding');
  assert(await page.getByRole('button',{name:'Save confirmed profile'}).isDisabled());
  assert(await page.getByRole('button',{name:'Compare recorded thoughts'}).isDisabled());
  const unauth=await page.request.post(`${origin}/api/ideal-self`,{data:{operation:'compare',isPro:true}});
  assert.equal(unauth.status(),401);
  await page.screenshot({path:'artifacts/ideal-self/unconfigured-mobile.png'});
  await page.setViewportSize({width:320,height:568});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'artifacts/ideal-self/unconfigured-desktop.png'});
  await context.close();

  // Explicit UI test doubles only: no production authorization or persistence is enabled.
  const mockContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await mockContext.route('**/src/app/supabaseClient.ts*',route=>route.fulfill({contentType:'application/javascript',body:`
    const session={access_token:'ui-test-token',user:{id:'${owner}'}};
    const listeners=[];
    export const supabase={auth:{getSession:async()=>({data:{session},error:null}),onAuthStateChange:cb=>{listeners.push(cb);return {data:{subscription:{unsubscribe(){}}}};},signOut:async()=>({error:null})},from:()=>{const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:null,error:null}),upsert:async()=>({error:null})};return query;}};
    export const isCloudSyncConfigured=true;
  `}));
  let profile=null,premium='unavailable',failSave=true,failReview=true,comparisons=[],suggestions=[];
  const requests=[];
  const save=fields=>{profile={user_id:owner,version:crypto.randomUUID(),fields,updated_at:new Date().toISOString()};};
  await mockContext.route('**/api/ideal-self',async route=>{
    const request=route.request(),body=request.postDataJSON();requests.push(body);
    assert.equal(request.headers().authorization,'Bearer ui-test-token');
    let status=200,result={};
    if(body.operation==='load')result={profile,premium,comparisons,suggestions,sources:entries};
    else if(body.operation==='save_profile'){
      if(failSave){failSave=false;status=503;result={code:'storage_unavailable',error:'Simulated save failure. Your input is still here.'};}
      else {assert.equal(body.expectedVersion,profile?.version??null);save(body.fields);result={profile};}
    } else if(body.operation==='review'){
      if(failReview){failReview=false;status=503;result={error:'Simulated review failure. Your edit is still here.'};}
      else {const row=comparisons.find(c=>c.id===body.id);row.review_state=body.action==='edit'?'edited':body.action==='reject'?'rejected':'accepted';if(body.action==='edit')row.reviewed_text=body.text;result={reviewed:true};}
    } else if(body.operation==='suggest'){
      suggestions=[{id:crypto.randomUUID(),user_id:owner,fields:{qualities:'Patience',values:'Care',aspirations:'Express my needs openly',avoid:''},explanation:'One possible direction to consider.',evidence:[{entryId:entries[0].id,quote:'I held back my needs',role:'context'}],inputs_hash:'test-only',review_state:'pending'}];result={created:true};
    } else if(body.operation==='confirm_suggestion'){
      const row=suggestions.find(s=>s.id===body.id);row.review_state=body.action==='edit'?'edited':body.action==='accept'?'accepted':'rejected';if(body.action!=='reject'){assert.equal(body.expectedVersion,profile.version);save(body.action==='edit'?body.fields:row.fields);result={profile};}else result={reviewed:true};
    } else if(body.operation==='delete_profile'){profile=null;comparisons=[];suggestions=[];result={deleted:true};}
    else throw new Error(`Unhandled UI test operation ${body.operation}`);
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
  });
  const mocked=await start(mockContext,true);const pageErrors=[];mocked.on('pageerror',e=>pageErrors.push(e.message));
  const qualities=mocked.getByLabel('Qualities I want to nurture');
  await qualities.fill('Respond patiently');await mocked.getByLabel('What matters to me').fill('Care');
  const saveButton=mocked.getByRole('button',{name:'Save confirmed profile'});
  await saveButton.click();await mocked.getByRole('alert').waitFor();assert.equal(await qualities.inputValue(),'Respond patiently');assert.equal(profile,null);
  await saveButton.click();await mocked.getByRole('heading',{name:'Your confirmed profile'}).waitFor();assert.equal(profile.fields.qualities,'Respond patiently');
  assert(await mocked.getByRole('button',{name:'Compare recorded thoughts'}).isDisabled());
  await mocked.getByRole('button',{name:'Edit profile',exact:true}).click();await mocked.getByLabel('What matters to me').fill('Care and honesty');await saveButton.click();await mocked.getByRole('heading',{name:'Your confirmed profile'}).waitFor();assert.equal(profile.fields.values,'Care and honesty');
  await mocked.screenshot({path:'artifacts/ideal-self/confirmed-profile-ui-fixture.png'});

  premium='allowed';
  comparisons=[{id:crypto.randomUUID(),user_id:owner,profile_version:profile.version,criterionKey:'values',criterionQuote:'Care',interpretation:'These entries may reflect different ways of communicating needs.',relation:'mixed',evidence:[{entryId:entries[0].id,quote:'I held back my needs',role:'supports'},{entryId:entries[1].id,quote:'I shared my needs',role:'complicates'}],question:'What felt different between these situations?',inputs_hash:'test-only',review_state:'pending',reviewed_text:null}];
  await mocked.getByRole('button',{name:'Back',exact:true}).click();await mocked.getByText('Ideal Self',{exact:true}).click();
  await mocked.getByRole('button',{name:'Edit interpretation',exact:true}).click();
  const ownInterpretation=mocked.getByLabel('Your interpretation');await ownInterpretation.fill('My reading depends on the situation.');
  await mocked.getByRole('button',{name:'Save my interpretation'}).click();await mocked.getByText('Simulated review failure. Your edit is still here.').waitFor();assert.equal(await ownInterpretation.inputValue(),'My reading depends on the situation.');
  await mocked.getByRole('button',{name:'Save my interpretation'}).click();await mocked.getByRole('status').filter({hasText:'Your review was saved.'}).waitFor();assert.equal(comparisons[0].reviewed_text,'My reading depends on the situation.');
  await mocked.getByRole('button',{name:"Doesn't fit",exact:true}).click();await mocked.getByRole('status').filter({hasText:'Your review was saved.'}).waitFor();assert.equal(comparisons[0].review_state,'rejected');assert.equal(comparisons[0].reviewed_text,'My reading depends on the situation.');
  await mocked.getByRole('button',{name:/Read entry/}).first().click();await mocked.getByRole('button',{name:/back/i}).first().click();await mocked.getByRole('heading',{name:'Ideal Self',exact:true}).waitFor();
  const confirmedVersion=profile.version;
  await mocked.getByRole('button',{name:'Suggest aspirations from entries'}).click();await mocked.getByRole('heading',{name:'AI-proposed aspiration'}).waitFor();assert.equal(profile.version,confirmedVersion);
  await mocked.getByRole('button',{name:'Edit before confirming'}).click();await mocked.getByLabel('What matters to me').fill('Care with boundaries');assert.equal(profile.version,confirmedVersion);
  await mocked.getByRole('button',{name:'Save confirmed profile'}).click();await mocked.getByRole('heading',{name:'Your confirmed profile'}).waitFor();assert.equal(profile.fields.values,'Care with boundaries');assert.notEqual(profile.version,confirmedVersion);
  await mocked.getByRole('button',{name:'Delete Ideal Self profile',exact:true}).click();await mocked.getByRole('button',{name:'Confirm delete Ideal Self profile'}).click();await mocked.getByRole('button',{name:'Save confirmed profile'}).waitFor();assert.equal(profile,null);assert.equal(await mocked.getByLabel('What matters to me').inputValue(),'');
  const legacy=await mocked.evaluate(()=>JSON.parse(localStorage.getItem('mijeong.store.v6')));assert.equal(legacy.history.length,2);assert.equal(legacy.idealSelf,undefined);
  assert.deepEqual(pageErrors,[]);
  console.log('PASS: actual disabled state and unauthenticated API; mocked account profile CRUD, failed-save/edit preservation, confirmation, rejection, source links, mobile/desktop, no page errors.');
  await mockContext.close();
} finally {await browser.close();}
