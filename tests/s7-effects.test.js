import { describe, expect, it } from 'vitest';
import { particleBobOffset } from '../src/rendering.js';
import {
  addVisualEffect, MAX_VISUAL_EFFECTS, pruneVisualEffects, visualEffectProgress
} from '../src/visual-effects.js';

describe('S7 interaction effect helpers', () => {
  it('caps the effect pool and keeps the most recent effects', () => {
    const pool = [];
    for (let index = 0; index < MAX_VISUAL_EFFECTS + 7; index++) {
      expect(addVisualEffect(pool, {
        kind: 'ripple', x: index, y: 0, createdAt: index
      })).toBe(true);
    }

    expect(pool).toHaveLength(MAX_VISUAL_EFFECTS);
    expect(pool[0].x).toBe(7);
    expect(pool.at(-1).x).toBe(MAX_VISUAL_EFFECTS + 6);
  });

  it('gates animated effects for reduced motion while allowing static score text', () => {
    const pool = [];
    expect(addVisualEffect(pool, { kind: 'splash', createdAt: 0 }, { reduceMotion: true })).toBe(false);
    expect(addVisualEffect(pool, { kind: 'drip', createdAt: 0 }, { reduceMotion: true })).toBe(false);
    expect(addVisualEffect(pool, {
      kind: 'score', amount: 12, comboText: '連擊 ×1.10', createdAt: 0
    }, { reduceMotion: true })).toBe(true);

    expect(pool).toHaveLength(1);
    expect(pool[0]).toMatchObject({ kind: 'score', amount: 12, static: true });
  });

  it('prunes expired entries and reports normalized animation progress', () => {
    const pool = [];
    addVisualEffect(pool, { kind: 'ripple', createdAt: 100 });
    addVisualEffect(pool, { kind: 'score', createdAt: 200 });

    expect(visualEffectProgress(pool[0], 410)).toBeCloseTo(0.5);
    expect(pruneVisualEffects(pool, 721)).toBe(1);
    expect(pool[0].kind).toBe('score');
    expect(pruneVisualEffects(pool, 1_251)).toBe(0);
  });

  it('keeps draw-time bob deterministic, bounded by 0.08 of the food radius, and off for reduced motion', () => {
    const particle = { type: 'veg', r: 20, rotation: 0.7 };
    const first = particleBobOffset(particle, 900);
    const repeated = particleBobOffset(particle, 900);
    expect(repeated).toEqual(first);
    expect(Math.hypot(first.x, first.y)).toBeLessThanOrEqual(particle.r * .08);
    expect(particleBobOffset(particle, 900, false)).toEqual({ x: 0, y: 0 });
    expect(particle).not.toHaveProperty('x');
    expect(particle).not.toHaveProperty('y');
  });
});
