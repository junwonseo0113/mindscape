import { chromium } from 'playwright';
import { ADDITIONAL_QUOTES } from '../src/app/additionalQuotes.ts';
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
try {
  const page=await browser.newPage({viewport:{width:1400,height:1000}});
  await page.goto('http://127.0.0.1:5173');
  const authors=ADDITIONAL_QUOTES.filter((_,i)=>i%4===0);
  await page.setContent(`<body style="margin:0;padding:20px;background:#0d1923;color:#f9e9d1;font:16px sans-serif;display:grid;grid-template-columns:repeat(4,1fr);gap:20px">${authors.map(q=>`<article><div>${q.author}</div><img style="width:100%" src="http://127.0.0.1:5173/src/assets/quote-portraits/${q.portrait.replace(/-01$/,'-plate')}.png"></article>`).join('')}</body>`);
  await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  await page.screenshot({path:'artifacts/quote-portraits/new-author-gallery.png',fullPage:true});
} finally {await browser.close();}
