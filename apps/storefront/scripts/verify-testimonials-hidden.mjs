import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/components/customer-reviews-section.tsx', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { CustomerReviewsSection } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
for (const props of [{}, { title:'Existing published title', limit:6 }, {limit:0}]) assert.equal(CustomerReviewsSection(props), null);
assert.doesNotMatch(source, /2,400|4\.9|rev-1|Tanvir Ahmed/);
console.log('PASS: existing testimonials configs render no fake data or claims');
