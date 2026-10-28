import fs from 'node:fs';
import path from 'node:path';

// Regex identifying common mojibake sequences produced by decoding UTF-8 as CP1252/ISO-8859-1.
// Written strictly with Unicode escape codes (\u00e2\u20ac, \u00c2\u00b7, etc.) so that this script
// contains no literal mojibake and does not trigger false positives when scanning itself.
const MOJIBAKE_REGEX = /(?:\u00e2\u20ac|\u00c2\u00b7|\u00e2\u2020|\u00c3[\u00a1-\u00ff]|\uFFFD|\u00c2[\u00a9\u00ae\u00b0\u00b1\u00b2\u00b3\u00b4\u00b5\u00b6\u00b7\u00b9\u00ba\u00bb\u00bc\u00bd\u00be\u00bf])/;

const ignoreDirs = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.turbo',
  '.gemini',
  '.worktrees',
]);

const ignoreFiles = new Set([
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
]);

const textExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.css',
  '.html',
  '.sql',
  '.prisma',
  '.yml',
  '.yaml',
]);

const findings = [];

function scan(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoreDirs.has(entry.name) && !entry.name.startsWith('.next')) {
        scan(path.join(dir, entry.name));
      }
    } else if (entry.isFile()) {
      if (ignoreFiles.has(entry.name)) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (textExtensions.has(ext)) {
        const fullPath = path.join(dir, entry.name);
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split(/\r?\n/);
        lines.forEach((line, index) => {
          if (MOJIBAKE_REGEX.test(line)) {
            findings.push({
              file: path.relative(process.cwd(), fullPath).replace(/\\/g, '/'),
              line: index + 1,
              content: line.trim(),
            });
          }
        });
      }
    }
  }
}

scan('.');

if (findings.length > 0) {
  console.error(`FAILED: Found ${findings.length} mojibake / encoding issue(s):`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line} -> ${f.content}`);
  }
  process.exit(1);
} else {
  console.log('PASS: No mojibake encoding issues detected across workspace files.');
  process.exit(0);
}
