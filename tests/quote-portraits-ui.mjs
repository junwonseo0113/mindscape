import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {DAILY_QUOTES} from '../src/app/dailyQuotes.ts';

await mkdir('artifacts/quote-portraits',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',timezoneId:'Asia/Seoul'});
  const page=await context.newPage(),errors=[],transparencyProblems=[],seen=new Set();page.on('pageerror',e=>errors.push(e.message));
  // Explicit artwork fixture: inspect every portrait independently of random launch selection.
  let artworkQuote=DAILY_QUOTES[0];
  await context.route('**/src/app/dailyQuotes.ts*',route=>route.fulfill({contentType:'application/javascript',body:`export const DAILY_QUOTES=${JSON.stringify(DAILY_QUOTES)};export function getOpeningQuote(){return ${JSON.stringify(artworkQuote)};}`}));
  for(let i=0;i<DAILY_QUOTES.length;i++){
    artworkQuote=DAILY_QUOTES[i];
    await page.goto(process.env.MINDSCAPE_TEST_URL||'http://127.0.0.1:5173');
    const portrait=page.locator('.quote-line-portrait');await portrait.waitFor();await page.waitForTimeout(180);
    const id=await portrait.getAttribute('data-portrait'),quote=DAILY_QUOTES.find(q=>q.portrait===id);assert.ok(quote);seen.add(id);console.log(`Checking ${id}`);
    const picture=portrait.locator('img');await picture.evaluate(image=>image.decode());
    assert.equal(await page.getByText('Quote of the day',{exact:true}).count(),0,'Visible quote heading was not removed');
    assert.ok(await picture.evaluate(image=>image.naturalWidth>=1000),'Portrait resolution is too low');
    const alpha=await picture.evaluate(image=>{const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d');const cell=image.parentElement.dataset.cell;if(cell!==undefined){c.width=image.naturalWidth/2;c.height=image.naturalHeight/2;ctx.drawImage(image,(Number(cell)%2)*c.width,Math.floor(Number(cell)/2)*c.height,c.width,c.height,0,0,c.width,c.height);}else ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;let clear=0;for(let j=3;j<pixels.length;j+=4)if(pixels[j]===0)clear++;return clear/(pixels.length/4);});
    if(alpha<=.2)transparencyProblems.push(id);console.log(id,'clear alpha',alpha);
    await page.getByText(quote.text,{exact:false}).waitFor();const passage=await page.locator('.daily-quote-passage').boundingBox();const hintBox=await page.getByText('Tap anywhere to continue',{exact:true}).boundingBox();assert.ok(passage&&hintBox&&passage.y+passage.height<hintBox.y,`${id}: passage overlaps the continue hint`);assert.equal(await picture.getAttribute('alt'),`Pen-and-ink portrait of ${quote.author}`);
    await page.screenshot({path:`artifacts/quote-portraits/${id}.png`});
    if(i===0){await page.waitForTimeout(2800);assert.equal(await portrait.isVisible(),true,'Quote disappears before the portrait can be read');}
  }
  assert.equal(seen.size,100,'Every daily quote needs its own drawing');
  for(const viewport of [{width:320,height:568},{width:1440,height:1000}]){
    await page.setViewportSize(viewport);artworkQuote=DAILY_QUOTES.reduce((longest,q)=>q.text.length>longest.text.length?q:longest);await page.goto(process.env.MINDSCAPE_TEST_URL||'http://127.0.0.1:5173');await page.locator('.quote-line-portrait').waitFor();await page.waitForTimeout(180);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const passageBox=await page.locator('.daily-quote-passage').boundingBox();assert.ok(passageBox&&passageBox.x>=0&&passageBox.x+passageBox.width<=viewport.width,'Quote text clips horizontally');
    const hint=await page.getByText('Tap anywhere to continue',{exact:true}).boundingBox(),portrait=await page.locator('.quote-line-portrait').boundingBox();assert.ok(hint&&portrait&&portrait.y>=0&&portrait.y+portrait.height<hint.y,'Portrait clips or overlaps the continue hint');
    await page.screenshot({path:`artifacts/quote-portraits/layout-${viewport.width}.png`});
  }
  assert.deepEqual(transparencyProblems,[],'Portrait backdrops must be transparent');assert.deepEqual(errors,[]);console.log('PASS: 100 detailed quote-specific portraits, author matching, transparent artwork, no top heading, quote timing, mobile/small/desktop layouts.');
}finally{await browser.close();}
