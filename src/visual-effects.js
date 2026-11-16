export const MAX_VISUAL_EFFECTS = 48;

export const VISUAL_EFFECT_DURATION_MS = Object.freeze({
  splash: 420,
  ripple: 620,
  drip: 520,
  score: 1_050
});

export function addVisualEffect(pool, effect, { reduceMotion = false } = {}) {
  if (!Array.isArray(pool) || !effect || !Object.hasOwn(VISUAL_EFFECT_DURATION_MS, effect.kind)) return false;
  if (reduceMotion && effect.kind !== 'score') return false;

  if (pool.length >= MAX_VISUAL_EFFECTS) {
    pool.splice(0, pool.length - MAX_VISUAL_EFFECTS + 1);
  }
  pool.push({
    ...effect,
    durationMs: VISUAL_EFFECT_DURATION_MS[effect.kind],
    static: reduceMotion && effect.kind === 'score'
  });
  return true;
}

export function pruneVisualEffects(pool, now) {
  if (!Array.isArray(pool)) return 0;
  let write = 0;
  for (let read = 0; read < pool.length; read++) {
    const effect = pool[read];
    if (now - effect.createdAt < effect.durationMs) pool[write++] = effect;
  }
  pool.length = write;
  return write;
}

export function visualEffectProgress(effect, now) {
  if (!effect || !(effect.durationMs > 0)) return 1;
  return Math.max(0, Math.min(1, (now - effect.createdAt) / effect.durationMs));
}
