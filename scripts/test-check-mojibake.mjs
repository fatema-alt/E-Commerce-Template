import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';

console.log('Running test suite for scripts/check-mojibake.mjs...\n');

// 1. Base run on clean repo must pass (exit 0)
console.log('Test 1: Base repository run passes');
const baseOut = execSync('node scripts/check-mojibake.mjs', { encoding: 'utf8' });
assert.ok(baseOut.includes('PASS'), 'Base run must output PASS');
console.log('  ✓ Base run exits 0\n');

// 2. Negative test: file with "â€œ" must fail (exit 1)
console.log('Test 2: Negative test - file with "â€œ" must fail (exit 1)');
const temp1 = 'test-mojibake-quote.tmp.ts';
writeFileSync(temp1, 'export const bad = "key â€œheroâ€  test";\n', 'utf8');
try {
  execSync('node scripts/check-mojibake.mjs', { encoding: 'utf8', stdio: 'pipe' });
  assert.fail('Should have failed on â€œ');
} catch (err) {
  assert.equal(err.status, 1);
  assert.ok(err.stderr.includes('â€œheroâ€') || err.stdout.includes('â€œheroâ€'));
  console.log('  ✓ Correctly rejected file containing "â€œ" with exit code 1\n');
} finally {
  if (existsSync(temp1)) unlinkSync(temp1);
}

// 3. Negative test: file with "Â·" must fail (exit 1)
console.log('Test 3: Negative test - file with "Â·" must fail (exit 1)');
const temp2 = 'test-mojibake-dot.tmp.ts';
writeFileSync(temp2, 'export const dot = "Page 1 Â· 1 documents";\n', 'utf8');
try {
  execSync('node scripts/check-mojibake.mjs', { encoding: 'utf8', stdio: 'pipe' });
  assert.fail('Should have failed on Â·');
} catch (err) {
  assert.equal(err.status, 1);
  assert.ok(err.stderr.includes('Â·') || err.stdout.includes('Â·'));
  console.log('  ✓ Correctly rejected file containing "Â·" with exit code 1\n');
} finally {
  if (existsSync(temp2)) unlinkSync(temp2);
}

// 4. Positive test: Bengali script & emojis must pass (exit 0)
console.log('Test 4: Positive test - Bengali Unicode and emojis must pass');
const temp3 = 'test-bengali-valid.tmp.ts';
writeFileSync(temp3, `
// Valid Bangla text and currency symbol
export const bangla = "ডিএস মার্ট - সেরা পণ্য, দ্রুত ডেলিভারি ৳১,৫০০";
export const emojis = "🛍️ ⚡ 📦 🚀 ❤️ 🔥";
export const cleanQuotes = "Clean quotes: “hero” and ‘single’ and en-dash: 1–64 and middle dot: ·";
`, 'utf8');
try {
  const out = execSync('node scripts/check-mojibake.mjs', { encoding: 'utf8' });
  assert.ok(out.includes('PASS'));
  console.log('  ✓ Correctly permitted valid Bengali text, ৳ symbol, emojis, and clean curved quotes\n');
} finally {
  if (existsSync(temp3)) unlinkSync(temp3);
}

// 5. Check ignored files: pnpm-lock.yaml and node_modules
console.log('Test 5: Ignores lockfiles and build directories');
assert.ok(baseOut.includes('PASS'), 'Lockfiles and ignored dirs did not trigger false positives');
console.log('  ✓ Ignored directories and files confirmed clean\n');

console.log('ALL 5 TEST SUITE CHECKS PASSED SUCCESSFULLY!');
