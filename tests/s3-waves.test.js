import { describe, expect, it } from 'vitest';
import {
  CLEAR_RULE_DURATION_MS, COMBO_MAX, COMBO_STEP, COMBO_WINDOW_MS,
  DAILY_WAVE_STREAM_XOR, POT_CAP_RATIO, WAVE_CLEAR_BONUS_PER_S,
  WAVE_FADE_IN_MS, WAVE_INTERVAL_MS, WAVE_LOW_RATIO, WAVE_MIN_GAP_MS,
  WAVE_SIZE_RATIO, WAVE_SPAWN_INWARD_SPEED
} from '../src/balance.js';
import { STAGES } from '../src/config.js';
import { mulberry32 } from '../src/rng.js';
import {
  clearRuleDurationMs, comboMultiplier, nextCombo, waveClearBonus
} from '../src/rules.js';
import {
  createWaveRng, createWaveState, isFadingIn, nextWaveDecision,
  waveComposition, waveSpawnPositions
} from '../src/waves.js';

describe('S3 wave balance and composition', () => {
  it('keeps the initial S3 tuning values in the balance module', () => {
    expect(WAVE_SIZE_RATIO).toBe(.35);
    expect(WAVE_INTERVAL_MS).toEqual({ starter: 9_000, home: 8_000, feast: 7_000 });
    expect(WAVE_LOW_RATIO).toBe(.25);
    expect(WAVE_MIN_GAP_MS).toBe(2_500);
    expect(POT_CAP_RATIO).toBe(1.3);
    expect(WAVE_FADE_IN_MS).toBe(600);
    expect(WAVE_SPAWN_INWARD_SPEED).toBe(2.2);
    expect(COMBO_WINDOW_MS).toBe(1_500);
    expect(COMBO_STEP).toBe(.05);
    expect(COMBO_MAX).toBe(10);
    expect(WAVE_CLEAR_BONUS_PER_S).toBe(15);
    expect(CLEAR_RULE_DURATION_MS).toEqual({ starter: 75_000, home: 60_000, feast: 55_000 });
    expect(DAILY_WAVE_STREAM_XOR).toBe(0x9E3779B9);
  });

  it('preserves wave zero, rounds refill sizes, and keeps each active type at least one', () => {
    const counts = { meat: 10, veg: 7, oil: 4, bone: 3 };
    expect(waveComposition(counts, 0)).toEqual(counts);
    expect(waveComposition(counts, 1)).toEqual({ meat: 4, veg: 2, oil: 1, bone: 0 });
    expect(waveComposition(counts, 1).meat + waveComposition(counts, 1).veg + waveComposition(counts, 1).oil)
      .toBe(7);
    expect(waveComposition({ meat: 1, veg: 0, oil: 2 }, 3)).toEqual({ meat: 1, veg: 0, oil: 1 });
  });

  it('adds one bone only on even refill waves starting at wave two', () => {
    const counts = { meat: 4, bone: 3 };
    expect(waveComposition(counts, 1).bone).toBe(0);
    expect(waveComposition(counts, 2).bone).toBe(1);
    expect(waveComposition(counts, 3).bone).toBe(0);
    expect(waveComposition(counts, 4).bone).toBe(1);
  });
});

describe('S3 wave scheduler', () => {
  const initialUnits = 90;

  it('triggers on the stage timer', () => {
    const state = createWaveState({ stage: 'home', startMs: 1_000 });
    const early = nextWaveDecision(state, { nowMs: 8_999, unitsInPot: 50, initialUnits });
    expect(early).toMatchObject({ spawn: false, reason: null, deferred: false });
    const due = nextWaveDecision(state, { nowMs: 9_000, unitsInPot: 50, initialUnits });
    expect(due).toMatchObject({ spawn: true, reason: 'timer', deferred: false });
    expect(due.state.waveIndex).toBe(2);
  });

  it('triggers at low amount after the minimum gap', () => {
    const state = createWaveState({ stage: 'home', startMs: 0 });
    const tooSoon = nextWaveDecision(state, { nowMs: WAVE_MIN_GAP_MS - 1, unitsInPot: 20, initialUnits });
    expect(tooSoon.spawn).toBe(false);
    const low = nextWaveDecision(state, { nowMs: WAVE_MIN_GAP_MS, unitsInPot: 20, initialUnits });
    expect(low).toMatchObject({ spawn: true, reason: 'low', deferred: false });
  });

  it('defers an over-cap wave without dropping it and retries when space opens', () => {
    const state = createWaveState({ stage: 'home', startMs: 0 });
    const deferred = nextWaveDecision(state, { nowMs: 8_000, unitsInPot: 90, initialUnits });
    expect(deferred).toMatchObject({ spawn: false, reason: 'timer', deferred: true });
    expect(state.pendingReason).toBeNull();
    expect(deferred.state.pendingReason).toBe('timer');
    const retried = nextWaveDecision(deferred.state, { nowMs: 8_100, unitsInPot: 80, initialUnits });
    expect(retried).toMatchObject({ spawn: true, reason: 'timer', deferred: false });
  });

  it('pulls the next deadline earlier once for a boil event', () => {
    const state = createWaveState({ stage: 'home', startMs: 1_000 });
    const pulled = nextWaveDecision(state, { nowMs: 7_000, unitsInPot: 50, initialUnits, boilEvent: true });
    expect(pulled.spawn).toBe(false);
    expect(pulled.state.nextWaveAtMs).toBe(7_500);
    const beforeDue = nextWaveDecision(pulled.state, { nowMs: 7_499, unitsInPot: 50, initialUnits });
    const due = nextWaveDecision(beforeDue.state, { nowMs: 7_500, unitsInPot: 50, initialUnits });
    expect(due).toMatchObject({ spawn: true, reason: 'boil', deferred: false });
  });

  it('counts the debris merged into a boil wave against the pot cap', () => {
    const state = createWaveState({ stage: 'home', startMs: 0 });
    const deferred = nextWaveDecision(state, {
      nowMs: 6_500, unitsInPot: 99, initialUnits: 100, boilEvent: true, debrisUnits: 2
    });
    expect(deferred).toMatchObject({ spawn: false, reason: 'boil', deferred: true });
  });

  it('immediately schedules the next wave when the current pot is cleared', () => {
    const state = createWaveState({ stage: 'starter', startMs: 0 });
    expect(nextWaveDecision(state, { nowMs: 1, unitsInPot: 0, initialUnits: 48 }))
      .toMatchObject({ spawn: true, reason: 'clear', deferred: false });
  });
});

describe('S3 fading, spawn placement, and deterministic stream', () => {
  it('marks particles as fading for the full 600 ms spawn interval', () => {
    const particle = { spawnedAtMs: 1_000 };
    expect(isFadingIn(particle, 1_000)).toBe(true);
    expect(isFadingIn(particle, 1_000 + WAVE_FADE_IN_MS - 1)).toBe(true);
    expect(isFadingIn(particle, 1_000 + WAVE_FADE_IN_MS)).toBe(false);
    expect(isFadingIn({}, 1_000)).toBe(false);
  });

  it('places particles outside the rim, moving inward, clear of the scoop area', () => {
    const avoid = { x: 210, y: 200, r: 20 };
    const positions = waveSpawnPositions(mulberry32(22), 20, {
      cx: 100, cy: 200, potRadius: 100, avoid
    });
    expect(positions).toHaveLength(20);
    for (const position of positions) {
      const radius = Math.hypot(position.x - 100, position.y - 200);
      expect(radius).toBeGreaterThanOrEqual(110);
      expect(radius).toBeLessThanOrEqual(120);
      expect(Math.hypot(position.x - avoid.x, position.y - avoid.y)).toBeGreaterThan(30);
      expect(position.vx * (position.x - 100) + position.vy * (position.y - 200)).toBeLessThan(0);
    }
  });

  it('keeps wave output deterministic even after independent physics RNG use', () => {
    const seed = 0x1234ABCD;
    const expected = waveSpawnPositions(createWaveRng(seed), 8, { cx: 0, cy: 0, potRadius: 100 });
    const physicsRng = mulberry32(seed);
    for (let i = 0; i < 10_000; i++) physicsRng();
    const actual = waveSpawnPositions(createWaveRng(seed), 8, { cx: 0, cy: 0, potRadius: 100 });
    expect(actual).toEqual(expected);
  });

  it('keeps the daily random stream aligned when tool avoidance changes placement', () => {
    const left = createWaveRng(0xA11CE);
    const right = createWaveRng(0xA11CE);
    waveSpawnPositions(left, 12, { cx: 0, cy: 0, potRadius: 100, avoid: { x: 0, y: 100, r: 25 } });
    waveSpawnPositions(right, 12, { cx: 0, cy: 0, potRadius: 100, avoid: { x: 0, y: 0, r: 25 } });
    expect(left()).toBe(right());
  });
});

describe('S3 scoring rules', () => {
  it('increases combo multiplier up to the x1.5 cap', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(4)).toBe(1.2);
    expect(comboMultiplier(COMBO_MAX)).toBe(1.5);
    expect(comboMultiplier(COMBO_MAX + 5)).toBe(1.5);
  });

  it('increments inside the combo window, restarts after it, and resets on failure', () => {
    expect(nextCombo(2, 1_000, 2_500, true)).toBe(3);
    expect(nextCombo(4, 1_000, 2_501, true)).toBe(1);
    expect(nextCombo(4, 1_000, 1_500, false)).toBe(0);
    expect(nextCombo(0, null, 1_500, true)).toBe(1);
  });

  it('floors partial seconds for wave-clear bonus and uses the clear duration table', () => {
    expect(waveClearBonus(3_999)).toBe(45);
    expect(waveClearBonus(999)).toBe(0);
    expect(waveClearBonus(-1)).toBe(0);
    expect(Object.keys(CLEAR_RULE_DURATION_MS)).toEqual(['starter', 'home', 'feast']);
    expect(Object.fromEntries(Object.keys(STAGES).map(stage => [stage, clearRuleDurationMs(stage)])))
      .toEqual({ starter: 75_000, home: 60_000, feast: 55_000 });
  });
});
