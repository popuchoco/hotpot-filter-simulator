import {
  BOIL_WAVE_PULL_MS, DAILY_WAVE_STREAM_XOR, MAX_DEBRIS_PER_WAVE,
  POT_CAP_RATIO, WAVE_FADE_IN_MS, WAVE_INTERVAL_MS, WAVE_LOW_RATIO,
  WAVE_MIN_GAP_MS, WAVE_SIZE_RATIO, WAVE_SPAWN_AVOID_DISTANCE_FACTOR,
  WAVE_SPAWN_RING_MAX_RATIO, WAVE_SPAWN_RING_MIN_RATIO
} from './balance.js';
import { STAGES } from './config.js';
import { mulberry32 } from './rng.js';

const sumCounts = counts => Object.values(counts).reduce((sum, count) => sum + (Number(count) || 0), 0);

function stageDetails(stage) {
  if (typeof stage === 'string') {
    const config = STAGES[stage];
    if (!config) throw new RangeError(`Unknown stage: ${stage}`);
    return { stageId: stage, counts: config.counts };
  }
  if (!stage || !stage.counts) throw new TypeError('stage must be a stage id or an object with counts');
  const stageId = Object.keys(STAGES).find(id => STAGES[id] === stage) || stage.id || 'home';
  return { stageId, counts: stage.counts };
}

// waveIndex 0 preserves the opening load exactly. Refill indices are 1-based:
// they get 35% per configured type (minimum 1); bones appear on even waves 2, 4, ...
export function waveComposition(stageCounts, waveIndex) {
  if (!stageCounts || typeof stageCounts !== 'object') throw new TypeError('stageCounts must be an object');
  const index = Math.max(0, Math.floor(Number(waveIndex) || 0));
  if (index === 0) return { ...stageCounts };

  const composition = {};
  for (const [type, rawCount] of Object.entries(stageCounts)) {
    const count = Math.max(0, Number(rawCount) || 0);
    if (type === 'bone') {
      composition.bone = count > 0 && index % 2 === 0 ? 1 : 0;
    } else if (count > 0) {
      composition[type] = Math.max(1, Math.round(count * WAVE_SIZE_RATIO));
    } else {
      composition[type] = 0;
    }
  }
  return composition;
}

export function createWaveState({ stage, startMs }) {
  const details = stageDetails(stage);
  const intervalMs = WAVE_INTERVAL_MS[details.stageId];
  if (!intervalMs) throw new RangeError(`No wave interval configured for stage: ${details.stageId}`);
  const start = Number(startMs);
  if (!Number.isFinite(start)) throw new TypeError('startMs must be a finite number');
  return {
    stageId: details.stageId,
    stageCounts: { ...details.counts },
    waveIndex: 1,
    lastWaveMs: start,
    nextWaveAtMs: start + intervalMs,
    nextWaveReason: 'timer',
    pendingReason: null,
    boilEventActive: false
  };
}

function makeDecision(state, { spawn = false, reason = null, deferred = false } = {}) {
  return { spawn, reason, deferred, state };
}

// Pure scheduler: callers retain the returned state for the next decision.
// boilEvent is an event pulse (false between events); a held true value is only
// applied once until the next false value is observed.
export function nextWaveDecision(waveState, {
  nowMs, unitsInPot, initialUnits, boilEvent = false
}) {
  const now = Number(nowMs);
  if (!Number.isFinite(now)) throw new TypeError('nowMs must be a finite number');
  const units = Math.max(0, Number(unitsInPot) || 0);
  const initial = Math.max(0, Number(initialUnits) || 0);
  let state = { ...waveState };
  const isBoilPulse = Boolean(boilEvent) && !state.boilEventActive;
  state.boilEventActive = Boolean(boilEvent);

  if (isBoilPulse) {
    state.nextWaveAtMs = Math.max(state.lastWaveMs, state.nextWaveAtMs - BOIL_WAVE_PULL_MS);
    state.nextWaveReason = 'boil';
  }

  let reason = state.pendingReason;
  if (units === 0 && initial > 0) {
    reason = 'clear';
  } else if (!reason) {
    const timerDue = now >= state.nextWaveAtMs;
    const lowDue = initial > 0
      && units <= initial * WAVE_LOW_RATIO
      && now - state.lastWaveMs >= WAVE_MIN_GAP_MS;
    if (timerDue) reason = state.nextWaveReason || 'timer';
    else if (lowDue) reason = 'low';
  }

  if (!reason) return makeDecision(state);

  const waveUnits = sumCounts(waveComposition(state.stageCounts, state.waveIndex));
  if (units + waveUnits > initial * POT_CAP_RATIO) {
    state.pendingReason = reason;
    return makeDecision(state, { reason, deferred: true });
  }

  state = {
    ...state,
    waveIndex: state.waveIndex + 1,
    lastWaveMs: now,
    nextWaveAtMs: now + WAVE_INTERVAL_MS[state.stageId],
    nextWaveReason: 'timer',
    pendingReason: null
  };
  return makeDecision(state, { spawn: true, reason });
}

export function isFadingIn(particle, nowMs) {
  return Number.isFinite(particle?.spawnedAtMs)
    && Number(nowMs) - particle.spawnedAtMs < WAVE_FADE_IN_MS;
}

export function createWaveRng(seed) {
  return mulberry32(((Number(seed) >>> 0) ^ DAILY_WAVE_STREAM_XOR) >>> 0);
}

export function waveSpawnPositions(rng, count, { cx, cy, potRadius, avoid } = {}) {
  if (typeof rng !== 'function') throw new TypeError('rng must be a function');
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const radius = Math.max(0, Number(potRadius) || 0);
  const positions = [];
  for (let index = 0; index < total; index++) {
    let candidate;
    let farthest;
    let farthestDistance = -Infinity;
    for (let attempt = 0; attempt < 256; attempt++) {
      const angle = rng() * Math.PI * 2;
      const ringRadius = radius * (1 + WAVE_SPAWN_RING_MIN_RATIO
        + rng() * (WAVE_SPAWN_RING_MAX_RATIO - WAVE_SPAWN_RING_MIN_RATIO));
      const x = cx + Math.cos(angle) * ringRadius;
      const y = cy + Math.sin(angle) * ringRadius;
      candidate = { x, y, angle };
      if (avoid && Number.isFinite(avoid.r)) {
        const distance = Math.hypot(x - avoid.x, y - avoid.y);
        if (distance > farthestDistance) {
          farthestDistance = distance;
          farthest = candidate;
        }
        if (distance <= avoid.r * WAVE_SPAWN_AVOID_DISTANCE_FACTOR) continue;
      }
      break;
    }
    if (avoid && Number.isFinite(avoid.r)
      && Math.hypot(candidate.x - avoid.x, candidate.y - avoid.y) <= avoid.r * WAVE_SPAWN_AVOID_DISTANCE_FACTOR
      && farthest) candidate = farthest;

    positions.push({
      x: candidate.x,
      y: candidate.y,
      vx: -Math.cos(candidate.angle),
      vy: -Math.sin(candidate.angle)
    });
  }
  return positions;
}

export { MAX_DEBRIS_PER_WAVE };
