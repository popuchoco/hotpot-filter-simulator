import { BOIL_CYCLE_MS, BOIL_DURATION_MS } from './config.js';
import { FIRST_BOIL_DELAY_MS } from './balance.js';

export const MAX_STEAM_WISPS = 24;

export function renderCacheKey(size, skin, broth, highContrast, devicePixelRatio) {
  const dimensions = typeof size === 'number' ? [size, size] : [size.width, size.height];
  return JSON.stringify([
    dimensions[0], dimensions[1], skin, broth, Boolean(highContrast), devicePixelRatio
  ]);
}

export function heatLevelAt(simulationTimeMs, broth, {
  firstBoilDelayMs = FIRST_BOIL_DELAY_MS,
  cycleMs = BOIL_CYCLE_MS,
  durationMs = BOIL_DURATION_MS
} = {}) {
  const elapsed = simulationTimeMs - firstBoilDelayMs;
  if (elapsed < 0) return 0;

  const boilFactor = broth.boilFactor || 1;
  const cycle = cycleMs / boilFactor;
  const activeDuration = Math.min(cycle * .55, durationMs * boilFactor);
  const phase = elapsed % cycle;
  if (phase >= activeDuration) return 0;
  return phase / activeDuration < .35 ? .5 : 1;
}

export function steamWispCount(heatLevel, maximum = MAX_STEAM_WISPS) {
  return Math.min(maximum, Math.max(0, Math.round(3 + Math.max(0, heatLevel) * 14)));
}

export function bubbleCountForHeat(heatLevel, maximum = MAX_STEAM_WISPS) {
  if (heatLevel <= 0) return 0;
  return Math.min(maximum, Math.round(4 + heatLevel * 12));
}

export function visualNoise(seed) {
  let value = seed | 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x1_0000_0000;
}
