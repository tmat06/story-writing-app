// scripts/check-tokens.js
// Validates that all CSS custom property references in src/**/*.css are defined in tokens.css.
// Exits with code 1 if any undefined references are found.

const fs = require('fs');
const path = require('path');

// 1. Collect defined tokens from tokens.css
const tokenSrc = fs.readFileSync('src/styles/tokens.css', 'utf8');
const defined = new Set([...tokenSrc.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));

// 2. Find all CSS files under src/ (excluding tokens.css itself)
function collectCss(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectCss(full));
    else if (entry.name.endsWith('.css')) out.push(full);
  }
  return out;
}

const files = collectCss('src').filter(f => !f.endsWith('tokens.css'));

// 3. Check each file for undefined var() references
let errors = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/var\((--[\w-]+)/g)) {
    if (!defined.has(m[1])) {
      console.error(`UNDEFINED TOKEN: ${m[1]} in ${file}`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\n${errors} undefined token reference(s) found. Fix before merging.`);
  process.exit(1);
} else {
  console.log('Token check passed — all CSS custom property references are defined.');
}
