import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseFriendScore } from '../src/rules.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('S6 share links and cache versions', () => {
  it('accepts friend scores from 0 through 99999 and rejects invalid values', () => {
    expect(parseFriendScore('0')).toBe(0);
    expect(parseFriendScore('99999')).toBe(99999);
    expect(parseFriendScore('0042')).toBe(42);
    for (const value of [null, '', '-1', '100000', '1.5', '1e2', ' 42', 'abc', NaN, 42.5]) {
      expect(parseFriendScore(value)).toBeNull();
    }
  });

  it('uses one cache version across index.html and every source module', () => {
    const srcRoot = resolve(repoRoot, 'src');
    const files = [
      resolve(repoRoot, 'index.html'),
      ...readdirSync(srcRoot).filter(file => file.endsWith('.js')).map(file => resolve(srcRoot, file))
    ];
    const versions = files.flatMap(file => {
      const content = readFileSync(file, 'utf8');
      return [...content.matchAll(/\?v=([^"'`\s&#)]+)/g)].map(match => match[1]);
    });

    expect(versions.length).toBeGreaterThan(0);
    expect(new Set(versions).size).toBe(1);
  });
});
