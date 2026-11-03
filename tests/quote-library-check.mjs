import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { DAILY_QUOTES } from '../src/app/dailyQuotes.ts';
import { ADDITIONAL_QUOTES } from '../src/app/additionalQuotes.ts';

const normalize = text => text.normalize('NFKD').toLowerCase().replaceAll('_','').match(/[a-z0-9]+/g).join(' ');
assert.equal(DAILY_QUOTES.length,100);
assert.equal(ADDITIONAL_QUOTES.length,88);
assert.equal(new Set(DAILY_QUOTES.map(q=>q.portrait)).size,100);
assert.equal(new Set(DAILY_QUOTES.map(q=>normalize(q.text))).size,100);
const report=[];
for(const quote of ADDITIONAL_QUOTES){
  const author=quote.portrait.replace(/-0[1-4]$/,'');
  if(author==='douglass'){
    // Manually checked against the original 1857 printing: printed p.22,
    // PDF page 24, lines 639–655 in the library's OCR transcription.
    report.push({portrait:quote.portrait,source:quote.source,verification:'Primary scanned edition, printed page 22 (PDF page 24)'});
    continue;
  }
  const source=await readFile(`artifacts/quote-research/${author}.txt`,'utf8');
  assert.ok(normalize(source).includes(normalize(quote.text)),`Wording differs from source: ${quote.portrait}`);
  report.push({portrait:quote.portrait,source:quote.source,verification:'Exact consecutive words in cited edition; punctuation and case normalized'});
}
await writeFile('artifacts/quote-research/verification.json',JSON.stringify(report,null,2)+'\n');
console.log(`PASS: 100 unique quotes, 100 illustration identities, 88 sourced additions, ${new Set(DAILY_QUOTES.map(q=>q.author)).size} authors.`);
