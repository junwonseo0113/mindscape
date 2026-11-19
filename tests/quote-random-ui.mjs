import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {DAILY_QUOTES} from '../src/app/dailyQuotes.ts';

const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
try {
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const authors=[];
  for(let i=0;i<8;i++) {
    await page.goto(process.env.MINDSCAPE_TEST_URL||'http://127.0.0.1:5173');
    const image=page.locator('.quote-line-portrait');await image.waitFor();
    const id=await image.getAttribute('data-portrait'),quote=DAILY_QUOTES.find(q=>q.portrait===id);
    assert.ok(quote);await page.getByText(quote.text,{exact:false}).waitFor();
    if(authors.length)assert.notEqual(quote.author,authors.at(-1),'Reopening repeated the previous author');
    authors.push(quote.author);
    await page.setViewportSize({width:i%2?390:414,height:844});await page.waitForTimeout(60);
    assert.equal(await image.getAttribute('data-portrait'),id,'The quote changed during the visit');
  }
  assert.ok(new Set(authors).size>=3,'Opening selection did not vary across launches');
  console.log('PASS: random matching quote/portraits on eight launches, no consecutive author repeats, stable during the visit.');
} finally {await browser.close();}
