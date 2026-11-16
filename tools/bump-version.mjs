import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function taipeiDateVersion() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const date = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${date.year}${date.month}${date.day}`;
}

const suppliedVersion = process.argv[2];
if (process.argv.length > 3) throw new Error('Usage: node tools/bump-version.mjs [version]');
const version = suppliedVersion ?? taipeiDateVersion();
if (!/^[A-Za-z0-9._-]+$/.test(version)) throw new Error('Version may contain only letters, numbers, dots, underscores, and hyphens.');

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = resolve(repoRoot, 'src');
const srcFiles = (await readdir(srcRoot)).filter(file => file.endsWith('.js')).sort();
const files = [resolve(repoRoot, 'index.html'), ...srcFiles.map(file => resolve(srcRoot, file))];
const versionPattern = /(\?v=)[^"'`\s&#)>]+/g;
let replacements = 0;

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const updated = source.replace(versionPattern, (match, prefix) => {
    replacements++;
    return `${prefix}${version}`;
  });
  if (updated !== source) await writeFile(file, updated);
}

console.log(`Set ${replacements} cache version${replacements === 1 ? '' : 's'} to ${version}.`);
