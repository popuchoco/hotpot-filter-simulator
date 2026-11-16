import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BROTHS, TOOL_CONFIG, TOOL_SHAPES } from '../src/config.js';
import {
  achievementConditions, applySoupLoss, categoryCleanliness, getHitParticles,
  isGoodToolFor, missionSuccess, overallCleanliness, resultComment,
  scoreParticle, soupLossForParticle
} from '../src/rules.js';
import { dailyChallengeDescriptor, hashSeed, mulberry32 } from '../src/rng.js';
import { updatePhysics } from '../src/physics.js';

describe('rng', () => {
  it('matches the base hash for a daily seed string', () => {
    expect(hashSeed('hotpot-filter-daily-2026-11-16')).toBe(1697949458);
  });

  it('generates the current mulberry32 sequence deterministically', () => {
    const first = mulberry32(1);
    const second = mulberry32(1);
    const sequence = Array.from({ length: 4 }, () => first());
    expect(sequence).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741]);
    expect(Array.from({ length: 4 }, () => second())).toEqual(sequence);
  });

  it('accepts valid shared descriptors and falls back for invalid dates or seeds', () => {
    expect(dailyChallengeDescriptor('?daily=20261116&seed=4294967295', '20261117')).toEqual({
      date: '20261116', seed: 4294967295, shared: true
    });
    expect(dailyChallengeDescriptor('?daily=2026-11-16&seed=1', '20261117')).toEqual({
      date: '20261117', seed: 1933096999, shared: false
    });
    expect(dailyChallengeDescriptor('?daily=20261116&seed=0', '20261117').shared).toBe(false);
  });
});

describe('rules', () => {
  it('uses the drawn ellipse and includes tangent particle circles', () => {
    const particleRadius = 10;
    const shape = TOOL_SHAPES.spoon;
    const angle = shape.rotation;
    const edgeDistance = shape.radiusX + particleRadius;
    const tangentParticle = {
      x: edgeDistance * Math.cos(angle), y: edgeDistance * Math.sin(angle), r: particleRadius
    };
    const outsideParticle = {
      x: (edgeDistance + .001) * Math.cos(angle),
      y: (edgeDistance + .001) * Math.sin(angle), r: particleRadius
    };
    expect(getHitParticles([tangentParticle], 0, 0, 'spoon')).toEqual([tangentParticle]);
    expect(getHitParticles([outsideParticle], 0, 0, 'spoon')).toEqual([]);
    expect(TOOL_CONFIG.spoon.radius).toBe(43);
  });

  it('classifies normal, chilled-oil, and bone tools as before', () => {
    expect(isGoodToolFor({ type: 'meat' }, 'strainer')).toBe(true);
    expect(isGoodToolFor({ type: 'meat' }, 'spoon')).toBe(false);
    expect(isGoodToolFor({ type: 'oil' }, 'spoon')).toBe(true);
    expect(isGoodToolFor({ type: 'oil' }, 'strainer', true)).toBe(true);
    expect(isGoodToolFor({ type: 'oil' }, 'holey', true)).toBe(false);
    expect(isGoodToolFor({ type: 'bone' }, 'holey')).toBe(true);
  });

  it('keeps current score and soup-loss arithmetic', () => {
    expect(scoreParticle({ type: 'meat', r: 5 }, 'strainer')).toBe(13);
    expect(scoreParticle({ type: 'bone', r: 20 }, 'holey')).toBe(54);
    expect(scoreParticle({ type: 'oil', r: 24 }, 'spoon', { oilChilled: true })).toBe(98);
    expect(soupLossForParticle({ type: 'veg' }, 'holey')).toBe(4.5);
    expect(soupLossForParticle({ type: 'oil' }, 'spoon', 2)).toBe(10.5);
    expect(applySoupLoss(4999, 9)).toBe(5000);
  });

  it('calculates category and overall cleanliness from the existing mass ratios', () => {
    const initial = { meat: 10, veg: 0, oil: 4, bone: 0, debris: 0 };
    const removed = { meat: 5, veg: 0, oil: 2, bone: 0, debris: 0 };
    expect(categoryCleanliness(initial, removed, 'meat')).toBe(50);
    expect(categoryCleanliness(initial, removed, 'veg')).toBeNull();
    expect(overallCleanliness(initial, removed)).toMatchObject({ cleanliness: 50, hasTargets: true });
    expect(overallCleanliness({}, {}).cleanliness).toBe(100);
  });

  it('evaluates mission, achievement, and result-comment rules', () => {
    const allRemoved = { particles: [], initialMass: { meat: 1 }, removedMass: { meat: 1 } };
    expect(missionSuccess('clear', 'cleared', allRemoved)).toBe(true);
    expect(missionSuccess('clear', 'timeout', allRemoved)).toBe(false);
    expect(missionSuccess('perfect', 'timeout', { failures: 0 })).toBe(true);
    expect(missionSuccess('perfect', 'timeout', { failures: 1 })).toBe(true);
    expect(missionSuccess('perfect', 'timeout', { lives: 0 })).toBe(false);
    expect(missionSuccess('perfect', 'mistake', { failures: 1 })).toBe(false);
    expect(missionSuccess('score', 'timeout', {})).toBeNull();
    expect(achievementConditions({ cleanliness: 100, correctRate: 100, attempts: 0, successful: 0, successfulScoops: 0, playedMs: 0, totalSoupLoss: 0, isTodayDailyChallenge: false })).toMatchObject({ first: false, clean: true, accurate: false, gentle: false, daily: false });
    expect(resultComment({ gameMode: 'challenge', challengeRule: 'score', missionWon: null, cleanliness: 75, score: 0, correctRate: 70, remaining: 1 })).toContain('再試一次');
    expect(resultComment({ gameMode: 'practice', challengeRule: 'score', missionWon: null, cleanliness: 0, score: 0, remaining: 1 })).toContain('練習完成');
  });
});

describe('physics', () => {
  it('steps particles in Node without DOM or canvas access', () => {
    const meat = { x: 100, y: 100, r: 5, vx: 1, vy: 0, type: 'meat' };
    const oil = { x: 160, y: 160, r: 3, vx: 0, vy: 0, type: 'oil', mass: 9, units: 1 };
    const state = {
      particles: [meat, oil],
      particleGroups: { meat: [meat], oil: [oil], veg: [], bone: [], debris: [] },
      canvasWidth: 400, canvasHeight: 400, brothId: 'clear', BROTHS,
      boilingNow: false, reduceMotion: true, random: () => 1,
      refreshParticleGroups: () => {
        state.particleGroups = Object.fromEntries(['oil', 'meat', 'veg', 'bone', 'debris'].map(type => [
          type, state.particles.filter(particle => particle.type === type)
        ]));
      }
    };
    updatePhysics(1, state);
    // Exact value is pinned so later refactors notice physics drift (random() fixed to 1).
    expect(Number.isFinite(meat.x) && meat.x > 100).toBe(true);
    expect(meat.x).toBeCloseTo(104.1211, 3);
    expect(state.particles).toHaveLength(2);
  });
});

it('pure rules, rng, and physics sources do not reference browser globals', () => {
  for (const moduleName of ['rules.js', 'rng.js', 'physics.js']) {
    const source = readFileSync(new URL(`../src/${moduleName}`, import.meta.url), 'utf8');
    expect(source).not.toMatch(/\b(?:document|window)\b/);
  }
});
