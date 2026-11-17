import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// index.html loads src/game.js with a cache-busting query. Every in-repo import of
// game.js must use the exact same specifier, otherwise the browser evaluates a
// second game.js module instance (two games, doubled listeners and audio).
describe('single game.js module instance', () => {
  it('imports game.js with the same ?v query that index.html uses', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const entry = html.match(/<script type="module" src="src\/(game\.js[^"]*)"/);
    expect(entry).not.toBeNull();
    const srcDir = new URL('../src/', import.meta.url);
    const importers = readdirSync(srcDir).filter(file => file.endsWith('.js'));
    const specifiers = importers.flatMap(file => [...readFileSync(new URL(file, srcDir), 'utf8')
      .matchAll(/from\s+['"]\.\/(game\.js[^'"]*)['"]/g)].map(match => ({ file, specifier: match[1] })));
    expect(specifiers.length).toBeGreaterThan(0);
    for (const { specifier } of specifiers) expect(specifier).toBe(entry[1]);
  });
});
