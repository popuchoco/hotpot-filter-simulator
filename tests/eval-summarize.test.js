import { describe, expect, it } from 'vitest';
import { summarize } from '../tools/eval/summarize.mjs';

describe('evaluation summary bonus median', () => {
  it('reports the median bonus while ignoring rows without the field', () => {
    const markdown = summarize([
      { stage: 'home', rule: 'score', broth: 'clear', strategy: 'steady', score: 100, perfectClearBonus: 0 },
      { stage: 'home', rule: 'score', broth: 'clear', strategy: 'steady', score: 200, perfectClearBonus: 20 },
      { stage: 'home', rule: 'score', broth: 'clear', strategy: 'steady', score: 150 }
    ]);

    expect(markdown).toContain('| bonus median |');
    expect(markdown.split('\n')[2]).toContain('| 10 |');
  });

  it('shows a dash for legacy rows without bonus data', () => {
    const markdown = summarize([
      { stage: 'home', rule: 'score', broth: 'clear', strategy: 'steady', score: 100 }
    ]);

    expect(markdown.split('\n')[2]).toContain('| — |');
  });
});
