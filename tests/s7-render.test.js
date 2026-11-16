import { describe, expect, it } from 'vitest';
import { BROTHS } from '../src/config.js';
import {
  bubbleCountForHeat, heatLevelAt, MAX_STEAM_WISPS, renderCacheKey,
  steamWispCount, visualNoise
} from '../src/rendering.js';

describe('S7 visual render helpers', () => {
  it('maps elapsed boil phases to calm, simmer, and boil without changing game timing', () => {
    expect(heatLevelAt(5_999, BROTHS.clear)).toBe(0);
    expect(heatLevelAt(6_000, BROTHS.clear)).toBe(.5);
    expect(heatLevelAt(7_400, BROTHS.clear)).toBe(1);
    expect(heatLevelAt(9_800, BROTHS.clear)).toBe(0);
    expect(heatLevelAt(6_000, BROTHS.mala)).toBe(.5);
    expect(heatLevelAt(6_000, BROTHS.miso)).toBe(.5);
  });

  it('separates cached surfaces by every visual setting and canvas dimension', () => {
    const key = renderCacheKey({ width: 480, height: 480 }, 'steel', 'clear', false, 2);
    expect(renderCacheKey({ width: 480, height: 480 }, 'steel', 'clear', false, 2)).toBe(key);
    expect(renderCacheKey({ width: 480, height: 480 }, 'jade', 'clear', false, 2)).not.toBe(key);
    expect(renderCacheKey({ width: 480, height: 480 }, 'steel', 'mala', false, 2)).not.toBe(key);
    expect(renderCacheKey({ width: 481, height: 480 }, 'steel', 'clear', false, 2)).not.toBe(key);
    expect(renderCacheKey({ width: 480, height: 480 }, 'steel', 'clear', true, 2)).not.toBe(key);
    expect(renderCacheKey({ width: 480, height: 480 }, 'steel', 'clear', false, 1)).not.toBe(key);
  });

  it('scales steam and bubble counts with heat and caps both counts', () => {
    expect(steamWispCount(0)).toBe(3);
    expect(steamWispCount(.5)).toBeGreaterThan(steamWispCount(0));
    expect(steamWispCount(1)).toBeGreaterThan(steamWispCount(.5));
    expect(steamWispCount(100)).toBe(MAX_STEAM_WISPS);
    expect(bubbleCountForHeat(0)).toBe(0);
    expect(bubbleCountForHeat(.5)).toBeGreaterThan(0);
    expect(bubbleCountForHeat(1)).toBeGreaterThan(bubbleCountForHeat(.5));
    expect(bubbleCountForHeat(100)).toBe(MAX_STEAM_WISPS);
  });

  it('uses deterministic visual noise independent of simulation randomness', () => {
    expect(visualNoise(91)).toBe(visualNoise(91));
    expect(visualNoise(91)).not.toBe(visualNoise(92));
    expect(visualNoise(91)).toBeGreaterThanOrEqual(0);
    expect(visualNoise(91)).toBeLessThan(1);
  });
});
