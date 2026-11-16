import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PERFECT_LIVES, POT_RADIUS_RATIO, POT_REFERENCE_CANVAS_SIZE,
  TOOL_SHAPES, TOOL_SHAPE_REFERENCE_POT_RADIUS, scaledToolShape
} from '../src/config.js';
import {
  getHitParticles, getScoopTargets, loseLife, missionSuccess,
  noLivesRemaining, resultComment, selectPrimaryTarget
} from '../src/rules.js';

describe('S2 scoop geometry', () => {
  it.each(Object.entries(TOOL_SHAPES))('uses the %s drawn boundary for particle-circle hits', (toolId, shape) => {
    const particleRadius = 2;
    const headRadius = shape.radius ?? shape.radiusX;
    const edge = headRadius + particleRadius;
    const angle = shape.rotation || 0;
    const particleAt = distance => ({
      x: distance * Math.cos(angle), y: distance * Math.sin(angle), r: particleRadius
    });
    const inside = particleAt(edge - .01);
    const outside = particleAt(edge + .01);

    expect(getHitParticles([inside], 0, 0, toolId)).toEqual([inside]);
    expect(getHitParticles([outside], 0, 0, toolId)).toEqual([]);
  });

  it('keeps the renderer head dimensions in the shared shape table', () => {
    const renderer = readFileSync(new URL('../src/renderer.js', import.meta.url), 'utf8');
    expect(TOOL_SHAPES.strainer.radius).toBe(16.5);
    expect(TOOL_SHAPES.spoon).toMatchObject({ radiusX: 26.66, radiusY: 17.2 });
    expect(TOOL_SHAPES.holey).toMatchObject({ radiusX: 21.96, radiusY: 14.04 });
    expect(renderer).toContain('scaledToolShape');
    expect(renderer).not.toContain('TOOL_CONFIG');
    expect(renderer).not.toMatch(/scoopRadius\s*\*/);
    expect(renderer).not.toMatch(/26\.66|17\.2|21\.96|14\.04|16\.5/);
  });

  it('selects the nearest hit particle as the primary target', () => {
    const farther = { x: 4, y: 0, r: 2, type: 'oil' };
    const nearest = { x: 1, y: 0, r: 2, type: 'meat' };
    expect(selectPrimaryTarget([farther, nearest], 0, 0)).toBe(nearest);
  });

  it('scoops all suitable collateral and ignores unsuited collateral for failure', () => {
    const primaryOil = { x: 1, y: 0, r: 3, type: 'oil' };
    const collateralOil = { x: 12, y: 0, r: 3, type: 'oil' };
    const unsuitedMeat = { x: 8, y: 4, r: 2, type: 'meat' };
    const result = getScoopTargets([primaryOil, collateralOil, unsuitedMeat], 0, 0, 'spoon');

    expect(result.primary).toBe(primaryOil);
    expect(result.suitable).toEqual([primaryOil, collateralOil]);
    expect(result.hits).toContain(unsuitedMeat);
    expect(result.failure).toBe(false);
  });

  it('still scoops suitable collateral when the primary target is a failure', () => {
    const primaryMeat = { x: 0, y: 0, r: 3, type: 'meat' };
    const collateralOil = { x: 10, y: 0, r: 3, type: 'oil' };
    const result = getScoopTargets([primaryMeat, collateralOil], 0, 0, 'spoon');
    expect(result.primary).toBe(primaryMeat);
    expect(result.failure).toBe(true);
    expect(result.suitable).toEqual([collateralOil]);
  });

  it('scales all tool shapes by the pot radius, preserving the desktop reference size', () => {
    expect(TOOL_SHAPE_REFERENCE_POT_RADIUS).toBe(POT_REFERENCE_CANVAS_SIZE * POT_RADIUS_RATIO);
    for (const toolId of Object.keys(TOOL_SHAPES)) {
      const desktopShape = scaledToolShape(toolId, TOOL_SHAPE_REFERENCE_POT_RADIUS);
      const mobileShape = scaledToolShape(toolId, TOOL_SHAPE_REFERENCE_POT_RADIUS / 2);
      expect(mobileShape.scale).toBeCloseTo(desktopShape.scale / 2);
      expect(mobileShape.radius ?? mobileShape.radiusX).toBeCloseTo((desktopShape.radius ?? desktopShape.radiusX) / 2);

      const particleRadius = 1;
      const distance = (desktopShape.radius ?? desktopShape.radiusX) * .7;
      const angle = desktopShape.rotation || 0;
      const particle = { x: distance * Math.cos(angle), y: distance * Math.sin(angle), r: particleRadius };
      expect(getHitParticles([particle], 0, 0, toolId, TOOL_SHAPE_REFERENCE_POT_RADIUS)).toEqual([particle]);
      expect(getHitParticles([particle], 0, 0, toolId, TOOL_SHAPE_REFERENCE_POT_RADIUS / 2)).toEqual([]);
    }
  });
});

describe('S2 forgiving perfect challenge', () => {
  it('counts down three lives and ends only when no lives remain', () => {
    let lives = PERFECT_LIVES;
    expect(noLivesRemaining(lives)).toBe(false);
    lives = loseLife(lives);
    expect(lives).toBe(2);
    expect(noLivesRemaining(lives)).toBe(false);
    lives = loseLife(lives);
    expect(lives).toBe(1);
    lives = loseLife(lives);
    expect(lives).toBe(0);
    expect(noLivesRemaining(lives)).toBe(true);
    expect(loseLife(lives)).toBe(0);
  });

  it('wins on timeout with lives left and reports zero-failure vs remaining-life finishes', () => {
    expect(missionSuccess('perfect', 'timeout', { failures: 1, lives: 2 })).toBe(true);
    expect(missionSuccess('perfect', 'timeout', { failures: 3, lives: 0 })).toBe(false);
    expect(missionSuccess('perfect', 'manual', { failures: 0, lives: 3 })).toBe(false);
    expect(resultComment({
      gameMode: 'challenge', challengeRule: 'perfect', missionWon: true,
      reason: 'timeout', failures: 0, lives: 3
    })).toContain('無失誤');
    expect(resultComment({
      gameMode: 'challenge', challengeRule: 'perfect', missionWon: true,
      reason: 'timeout', failures: 1, lives: 2
    })).toContain('剩 2 命完成');
  });
});
