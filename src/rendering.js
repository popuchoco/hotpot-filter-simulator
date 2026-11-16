import { BOIL_CYCLE_MS, BOIL_DURATION_MS } from './config.js';
import { FIRST_BOIL_DELAY_MS } from './balance.js';

export const MAX_STEAM_WISPS = 24;
const PARTICLE_TYPES = Object.freeze(['meat', 'veg', 'oil', 'bone', 'debris']);
const NO_BOB_OFFSET = Object.freeze({ x: 0, y: 0 });

export function renderCacheKey(size, skin, broth, highContrast, devicePixelRatio) {
  const dimensions = typeof size === 'number' ? [size, size] : [size.width, size.height];
  return JSON.stringify([
    dimensions[0], dimensions[1], skin, broth, Boolean(highContrast), devicePixelRatio
  ]);
}

export function debugHitEnabled(search) {
  const params = new URLSearchParams(search);
  // `?debug=hit` (S2, scoop outline) stays supported; `?test=1&debugHit=1` is the S7 test URL.
  return params.get('debug') === 'hit' || (params.get('test') === '1' && params.get('debugHit') === '1');
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

export function particleBobOffset(particle, now, enabled = true) {
  const radius = Math.max(0, Number(particle?.r) || 0);
  if (!enabled || radius === 0) return NO_BOB_OFFSET;
  const typeIndex = Math.max(0, PARTICLE_TYPES.indexOf(particle.type));
  const detail = particle.rotation ?? particle.shimmer ?? particle.shade ?? particle.integrity ?? 0;
  const seed = (Math.round(radius * 1000) ^ Math.imul(typeIndex + 1, 0x9e3779b9) ^ Math.round(detail * 1000)) | 0;
  const phase = now * .00115 + visualNoise(seed) * Math.PI * 2;
  const amplitude = radius * .08;
  return {
    x: Math.cos(phase) * amplitude * .5,
    y: Math.sin(phase) * amplitude * .5
  };
}
