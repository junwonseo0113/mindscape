const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 500, height: 950 } });
  await page.addInitScript(() => { localStorage.setItem('mijeong.isDemoMode', '1'); });
  await page.goto('http://localhost:5199', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const skip = page.getByText(/^Skip/);
  if (await skip.count()) await skip.first().click();
  await page.waitForTimeout(1000);

  const info = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div')).filter(d => getComputedStyle(d).overflowY === 'auto');
    return els.map(d => ({ scrollHeight: d.scrollHeight, clientHeight: d.clientHeight, overflow: d.scrollHeight > d.clientHeight }));
  });
  console.log('SCROLL INFO', JSON.stringify(info));

  await page.screenshot({ path: 'C:\\Users\\user\\AppData\\Local\\Temp\\claude\\c--Users-user-Desktop-Astro\\ad7ae8de-7784-497f-a097-609ed1280bca\\scratchpad\\lower_speak.png' });
  await browser.close();
})();
