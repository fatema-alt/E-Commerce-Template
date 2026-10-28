import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const { outputText } = ts.transpileModule(readFileSync(new URL('../src/lib/shipping-copy.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const { shippingSummary } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
for (const freeAbove of [3456, 7890]) {
  const text = shippingSummary({ freeAbove, insideDhaka: 93, outsideDhaka: 171 });
  assert.ok(text.includes(`at least ৳${freeAbove.toLocaleString('en-BD')} after discounts`));
  assert.ok(text.includes('৳93 inside Dhaka'));
  assert.ok(text.includes('৳171 elsewhere'));
  assert.doesNotMatch(text, /orders over|৳2,000|৳80|৳150/);
}
assert.doesNotMatch(shippingSummary({ freeAbove: 0, insideDhaka: 93, outsideDhaka: 171 }), /Free delivery|at least/);
const source = readFileSync(new URL('../src/components/cart-checkout.tsx', import.meta.url), 'utf8');
assert.ok(source.includes('shippingSummary(quote.shippingRates)'), 'Both cart and checkout consume the server quote rates');
console.log('PASS: dynamic shipping thresholds, inclusive after-discount wording, disabled free shipping');
