import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOOL_SHAPES } from '../src/config.js';
import {
  FOOD_SPRITE_TYPES, foodSpriteBodyRadius, foodSpriteCacheKey,
  foodSpriteVariant, quantizedFoodRadius
} from '../src/food-sprites.js';
import { debugHitEnabled } from '../src/rendering.js';

const particles = [
  { type: 'meat', r: 4.13, shade: .2 },
  { type: 'veg', r: 19.75, name: '南瓜' },
  { type: 'bone', r: 21.25, integrity: 1 },
  { type: 'oil', r: 8.61 },
  { type: 'debris', debrisKind: 'chili', r: 8.25 },
  { type: 'debris', debrisKind: 'miso', r: 7.5 }
];

describe('S7 food sprite geometry', () => {
  it('derives the visible circular body radius from p.r for every sprite type', () => {
    expect(FOOD_SPRITE_TYPES).toEqual(['meat', 'veg', 'bone', 'oil', 'chili', 'miso']);
    for (const particle of particles) {
      const variant = foodSpriteVariant(particle);
      const quantizedRadius = quantizedFoodRadius(particle.r);
      expect(variant).toBeTruthy();
      expect(foodSpriteBodyRadius(particle.r, quantizedRadius)).toBeCloseTo(particle.r, 10);
    }
  });

  it('scales cached sprite canvases back to p.r and keys every appearance setting', () => {
    const sprites = readFileSync(new URL('../src/food-sprites.js', import.meta.url), 'utf8');
    expect(sprites).toContain('const scale = radius / sprite.bodyRadius');
    expect(sprites).toContain('target.drawImage(sprite.surface');
    expect(sprites).toContain('circle(ctx, radius)');
    expect(sprites).toContain('ctx.clip()');

    const key = foodSpriteCacheKey(particles[3], false, 2, false);
    expect(foodSpriteCacheKey(particles[3], false, 2, false)).toBe(key);
    expect(foodSpriteCacheKey(particles[3], true, 2, false)).not.toBe(key);
    expect(foodSpriteCacheKey(particles[3], false, 1, false)).not.toBe(key);
    expect(foodSpriteCacheKey(particles[3], false, 2, true)).not.toBe(key);
    expect(foodSpriteCacheKey({ ...particles[3], r: 9 }, false, 2, false)).not.toBe(key);
  });

  it('keeps the scoop renderer on TOOL_SHAPES and gates hit overlays to the test URL', () => {
    const renderer = readFileSync(new URL('../src/renderer.js', import.meta.url), 'utf8');
    const config = readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
    expect(renderer).toContain('TOOL_SHAPES[currentTool]');
    expect(renderer).toContain('scaledToolShape(currentTool, potRadius)');
    expect(config).toContain('const shape = TOOL_SHAPES[toolId]');
    expect(renderer).not.toMatch(/26\.66|17\.2|21\.96|14\.04|16\.5/);

    expect(debugHitEnabled('?test=1&debugHit=1')).toBe(true);
    expect(debugHitEnabled('?debugHit=1')).toBe(false);
    expect(debugHitEnabled('?test=0&debugHit=1')).toBe(false);
    expect(debugHitEnabled('?test=1&debugHit=0')).toBe(false);
    expect(debugHitEnabled('?debug=hit')).toBe(true);
    expect(debugHitEnabled('')).toBe(false);
    expect(TOOL_SHAPES.strainer.radius).toBeGreaterThan(0);
  });
});
