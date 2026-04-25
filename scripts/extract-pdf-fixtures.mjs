#!/usr/bin/env node
/**
 * Extract raw pdf-parse text from sample PDFs and save as fixture files.
 * Run from project root: node scripts/extract-pdf-fixtures.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const PDFS = [
  { name: 'robinhood',       src: 'data/sample_pdfs/robinhood.pdf' },
  { name: 'chase',           src: 'data/sample_pdfs/chase.pdf' },
  { name: 'schwab',          src: 'data/sample_pdfs/charles_schwab.PDF' },
  { name: 'wealthfront',     src: 'data/sample_pdfs/wealthfront.pdf' },
];

const FIXTURE_DIR = join(root, 'web/__tests__/fixtures');
mkdirSync(FIXTURE_DIR, { recursive: true });

const { default: pdfParse } = await import(join(root, 'web/node_modules/pdf-parse/dist/pdf-parse/esm/index.js'));

for (const { name, src } of PDFS) {
  const pdfPath = join(root, src);
  console.log(`Extracting ${src}...`);
  try {
    const buffer = readFileSync(pdfPath);
    const result = await pdfParse(buffer);
    const outPath = join(FIXTURE_DIR, `${name}_sample.txt`);
    writeFileSync(outPath, result.text, 'utf8');
    console.log(`  → ${outPath} (${result.text.length} chars, ${result.numpages} pages)`);
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
  }
}
