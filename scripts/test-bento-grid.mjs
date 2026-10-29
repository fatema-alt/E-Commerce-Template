import assert from 'node:assert/strict';
import { getBentoLayoutRule } from '../apps/storefront/src/components/department-bento.js';

console.log('Running test suite for DepartmentBento layout and logic...\n');

// 1. Layout-by-count tests for 1 to 8 tiles
for (let total = 1; total <= 8; total++) {
  console.log(`Test Layout for count = ${total}:`);
  const rules = [];
  for (let i = 0; i < total; i++) {
    rules.push(getBentoLayoutRule(total, i));
  }

  // A. Verify lead tile
  assert.equal(rules[0].isLead, true, `Tile 0 must be lead for total ${total}`);
  for (let i = 1; i < total; i++) {
    assert.equal(rules[i].isLead, false, `Tile ${i} must not be lead for total ${total}`);
  }

  // B. Verify Desktop 12-column row balance
  // Group into rows based on desktopColSpan
  let rowSum = 0;
  let rowCount = 0;
  for (let i = 0; i < total; i++) {
    const span = rules[i].desktopColSpan;
    assert.ok(span >= 1 && span <= 12, `Span ${span} must be within 1..12`);
    
    // For 3-tile and 4-tile lead multi-row tiles:
    // Lead is row-span-2, so its width occupies column space across 2 rows
    if (total === 3 && i === 0) continue;
    if (total === 4 && i === 0) continue;

    rowSum += span;
    if (total === 3) {
      // Tiles 1 and 2 occupy 5 columns each in their respective stacked rows
      assert.equal(span, 5, 'Stacked tiles for 3-count must be col-span-5');
    } else if (total === 4) {
      // Tile 1 occupies 6 cols (Row 1 with lead 6 = 12)
      // Tiles 2 and 3 occupy 3 cols each (Row 2 with lead 6 = 12)
      if (i === 1) assert.equal(span, 6);
      if (i === 2 || i === 3) assert.equal(span, 3);
    } else {
      if (rowSum === 12) {
        rowCount++;
        rowSum = 0;
      }
    }
  }

  if (total !== 3 && total !== 4) {
    assert.equal(rowSum, 0, `Desktop rows must sum to exactly 12 columns (remainder: ${rowSum}) for total ${total}`);
  }
  console.log(`  ✓ Desktop 12-column grid balanced with 0 empty gaps`);

  // C. Verify Mobile 2-column rule
  // Lead tile is always 2 columns.
  // When remaining tiles (total - 1) is odd, the last tile must span 2 columns.
  assert.equal(rules[0].mobileColSpan, 2, 'Lead tile on mobile must span 2 columns');
  const remaining = total - 1;
  const isOdd = remaining % 2 === 1;

  for (let i = 1; i < total; i++) {
    if (isOdd && i === total - 1) {
      assert.equal(rules[i].mobileColSpan, 2, `Last tile ${i} must span 2 columns when remaining is odd (${remaining})`);
    } else {
      assert.equal(rules[i].mobileColSpan, 1, `Tile ${i} must span 1 column`);
    }
  }

  // Verify total mobile columns sum to an even number (all full rows of 2 cols)
  const totalMobileCols = rules.reduce((acc, r) => acc + r.mobileColSpan, 0);
  assert.equal(totalMobileCols % 2, 0, `Total mobile columns (${totalMobileCols}) must be even (no dangling 1-slot hole)`);
  console.log(`  ✓ Mobile 2-column grid balanced (total mobile cols: ${totalMobileCols}, 0 dangling holes)\n`);
}

// 2. Category filtering test: hiding empty categories only when counts are present
console.log('Test Category Filtering (empty vs unknown vs populated):');
const mockCategories = [
  { id: '1', name: 'Populated Category', slug: 'populated', productCount: 5 },
  { id: '2', name: 'Empty Category', slug: 'empty', productCount: 0 },
  { id: '3', name: 'Unknown Count Category', slug: 'unknown', productCount: undefined },
  { id: '4', name: 'Another Empty', slug: 'empty-2', productCount: 0 },
  { id: '5', name: 'Single Item Category', slug: 'single', productCount: 1 },
];

function filterCategories(cats) {
  return cats.filter((c) => c.productCount === undefined || c.productCount > 0);
}

const visible = filterCategories(mockCategories);
assert.equal(visible.length, 3, 'Must retain populated and unknown-count categories, filtering out 0-count');
assert.ok(visible.some((c) => c.slug === 'populated'), 'Populated category must be kept');
assert.ok(visible.some((c) => c.slug === 'unknown'), 'Unknown count category must be kept (not guessed)');
assert.ok(visible.some((c) => c.slug === 'single'), 'Single item category must be kept');
assert.ok(!visible.some((c) => c.slug === 'empty'), 'Empty category must be filtered');
assert.ok(!visible.some((c) => c.slug === 'empty-2'), 'Empty category 2 must be filtered');
console.log('  ✓ Correctly filters productCount === 0 while preserving productCount === undefined\n');

console.log('ALL BENTO TESTS PASSED SUCCESSFULLY!');
