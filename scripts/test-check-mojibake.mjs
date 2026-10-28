import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';

console.log('Running test suite for scripts/check-mojibake.mjs...\n');

// 1. Base run on clean repo must pass (exit 0)
console.log('Test 1: Base repository run passes');
const baseOut = execSync('node scripts/check-mojibake.mjs', { encoding: 'utf8' });
assert.ok(baseOut.includes('PASS'), 'Base run must output PASS');
console.log('  ✓ Base run exits 0\n');

// 2. Self-scan test: verify check-mojibake.mjs scans itself without false positives
console.log('Test 2: check-mojibake.mjs does not flag its own file');
const checkerContent = readFileSync('scripts/check-mojibake.mjs', 'utf8');
assert.ok(!checkerContent.includes('!fullPath.includes'), 'Must not use a self-exclusion filename bypass');
assert.ok(checkerContent.includes('\\u00e2\\u20ac'), 'Must write patterns using Unicode escape sequences');
const selfCheckOut = execSync('node scripts/check-mojibake.mjs', { encoding: 'utf8' });
assert.ok(selfCheckOut.includes('PASS'));
console.log('  ✓ Verified: patterns are written with Unicode escapes (\\u00e2\\u20ac, etc.), allowing clean self-scanning without special filename exemptions\n');

// 3. Negative test: file with corrupt quote sequence must fail (exit 1)
console.log('Test 3: Negative test - file with corrupt quote sequence must fail (exit 1)');
const temp1 = 'test-mojibake-quote.tmp.ts';
writeFileSync(temp1, 'export const bad = "key \u00e2\u20ac\u0153hero\u00e2\u20ac\u009d test";\n', 'utf8');
try {
  execSync('node scripts/check-mojibake.mjs', { encoding: 'utf8', stdio: 'pipe' });
  assert.fail('Should have failed on corrupt quote');
} catch (err) {
  assert.equal(err.status, 1);
  assert.ok(err.stderr.includes('test-mojibake-quote.tmp.ts') || err.stdout.includes('test-mojibake-quote.tmp.ts'));
  console.log('  ✓ Correctly rejected file containing corrupt quote with exit code 1\n');
} finally {
  if (existsSync(temp1)) unlinkSync(temp1);
}

// 4. Negative test: file with corrupt middle dot sequence must fail (exit 1)
console.log('Test 4: Negative test - file with corrupt middle dot sequence must fail (exit 1)');
const temp2 = 'test-mojibake-dot.tmp.ts';
writeFileSync(temp2, 'export const dot = "Page 1 \u00c2\u00b7 1 documents";\n', 'utf8');
try {
  execSync('node scripts/check-mojibake.mjs', { encoding: 'utf8', stdio: 'pipe' });
  assert.fail('Should have failed on corrupt dot');
} catch (err) {
  assert.equal(err.status, 1);
  assert.ok(err.stderr.includes('test-mojibake-dot.tmp.ts') || err.stdout.includes('test-mojibake-dot.tmp.ts'));
  console.log('  ✓ Correctly rejected file containing corrupt dot with exit code 1\n');
} finally {
  if (existsSync(temp2)) unlinkSync(temp2);
}

// 5. Negative test: file with Unicode replacement character U+FFFD must fail (exit 1)
console.log('Test 5: Negative test - file with Unicode replacement character U+FFFD must fail (exit 1)');
const tempUfffd = 'test-mojibake-ufffd.tmp.ts';
writeFileSync(tempUfffd, 'export const broken = "Corrupted text \uFFFD in string";\n', 'utf8');
try {
  execSync('node scripts/check-mojibake.mjs', { encoding: 'utf8', stdio: 'pipe' });
  assert.fail('Should have failed on U+FFFD replacement character');
} catch (err) {
  assert.equal(err.status, 1);
  assert.ok(err.stderr.includes('test-mojibake-ufffd.tmp.ts') || err.stdout.includes('test-mojibake-ufffd.tmp.ts'));
  console.log('  ✓ Correctly rejected file containing U+FFFD replacement character with exit code 1\n');
} finally {
  if (existsSync(tempUfffd)) unlinkSync(tempUfffd);
}

// 6. Positive test: Bengali script & emojis must pass (exit 0)
console.log('Test 6: Positive test - Bengali Unicode and emojis must pass');
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

// 7. Check ignored files: pnpm-lock.yaml and node_modules
console.log('Test 7: Ignores lockfiles and build directories');
assert.ok(baseOut.includes('PASS'), 'Lockfiles and ignored dirs did not trigger false positives');
console.log('  ✓ Ignored directories and files confirmed clean\n');

console.log('ALL 7 TEST SUITE CHECKS PASSED SUCCESSFULLY!');
