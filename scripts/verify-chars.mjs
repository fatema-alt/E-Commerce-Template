import fs from 'node:fs';

const content = fs.readFileSync('apps/admin/src/components/cms/cms-workspace.tsx', 'utf8');

console.log('Checking for stray LaTeX-like artifacts (e.g. \\to):');
console.log('  content.includes("\\\\to"):', content.includes('\\to'));

const lines = content.split(/\r?\n/);

const l248 = lines[247];
const dashChar = l248.match(/1(.)64/)?.[1];
console.log(`Line 248 dash: "${dashChar}", code: U+${dashChar?.charCodeAt(0).toString(16).toUpperCase()} (Expected U+2013 EN DASH)`);

const l454 = lines[453];
const heroQuotes = l454.match(/key (.)hero(.)/);
console.log(`Line 454 hero left quote: "${heroQuotes?.[1]}", code: U+${heroQuotes?.[1].charCodeAt(0).toString(16).toUpperCase()} (Expected U+201C)`);
console.log(`Line 454 hero right quote: "${heroQuotes?.[2]}", code: U+${heroQuotes?.[2].charCodeAt(0).toString(16).toUpperCase()} (Expected U+201D)`);

const l477 = lines[476];
const ellChar = l477.match(/Loading CMS(.)/)?.[1];
console.log(`Line 477 ellipsis: "${ellChar}", code: U+${ellChar?.charCodeAt(0).toString(16).toUpperCase()} (Expected U+2026)`);

const l715 = lines[714];
const dotMatches = [...l715.matchAll(/·/g)];
console.log(`Line 715 middle dots count: ${dotMatches.length}, code: U+${dotMatches[0]?.[0].charCodeAt(0).toString(16).toUpperCase()} (Expected U+00B7)`);

const l949 = lines[948];
const arrowUp = l949.match(/\"(.)\" : \"(.)\"/)?.[1];
const arrowDn = l949.match(/\"(.)\" : \"(.)\"/)?.[2];
console.log(`Line 949 arrow up: "${arrowUp}", code: U+${arrowUp?.charCodeAt(0).toString(16).toUpperCase()} (Expected U+2191)`);
console.log(`Line 949 arrow down: "${arrowDn}", code: U+${arrowDn?.charCodeAt(0).toString(16).toUpperCase()} (Expected U+2193)`);
