import {
  BIG_OIL_SCORE_MULTIPLIER, BIG_PARTICLE_RADIUS, BIG_VEG_SCORE_MULTIPLIER, BOIL_CYCLE_MS, BOIL_DURATION_MS,
  BONE_SCORE_BONUS, CHILLED_OIL_SCORE_MULTIPLIER, SCORE_BASE, SCORE_PER_RADIUS,
  DAILY_ACHIEVEMENT_MIN_SUCCESSFUL_SCOOPS, FIRST_ACHIEVEMENT_MIN_PLAY_MS,
  FIRST_ACHIEVEMENT_MIN_SUCCESSFUL_SCOOPS, RESULT_COMMENT_HIGH_SCORE_THRESHOLD,
  RESULT_COMMENT_CLEAN_PERCENT, RESULT_COMMENT_MID_SCORE_THRESHOLD, RESULT_COMMENT_MIN_ACCURACY_PERCENT,
  PERFECT_LIVES, SOUP_LOSS_CAP_ML, SPOON_STREAK_SOUP_LOSS_INCREMENT, TOOL_CONFIG,
  TOOL_SHAPE_REFERENCE_POT_RADIUS, scaledToolShape,
  VEG_SOUP_LOSS_MULTIPLIER, WRONG_TOOL_BASE_PENALTY, WRONG_TOOL_PENALTY_PER_RADIUS
} from './config.js';
import {
  CLEAR_RULE_DURATION_MS, COMBO_MAX, COMBO_STEP, COMBO_WINDOW_MS, FIRST_BOIL_DELAY_MS,
  WAVE_CLEAR_BONUS_PER_S
} from './balance.js';
import { hashSeed } from './rng.js';

export function boilStateAt(simulationTimeMs, broth, {
  firstBoilDelayMs = FIRST_BOIL_DELAY_MS,
  cycleMs = BOIL_CYCLE_MS,
  durationMs = BOIL_DURATION_MS
} = {}) {
  const elapsedSinceFirstBoil = simulationTimeMs - firstBoilDelayMs;
  if (elapsedSinceFirstBoil < 0) return false;
  const boilFactor = broth.boilFactor || 1;
  const cycle = cycleMs / boilFactor;
  const activeDuration = Math.min(cycle * .55, durationMs * boilFactor);
  return (elapsedSinceFirstBoil % cycle) < activeDuration;
}

// Finds the true closest point on the filled ellipse using the standard Lagrange
// multiplier equation. A particle is caught when its circle touches that ellipse.
function circleIntersectsEllipse(dx, dy, particleRadius, radiusX, radiusY) {
  const x = Math.abs(dx);
  const y = Math.abs(dy);
  const a2 = radiusX * radiusX;
  const b2 = radiusY * radiusY;
  if ((x * x) / a2 + (y * y) / b2 <= 1) return true;

  const ellipseEquation = lambda => {
    const xTerm = radiusX * x / (lambda + a2);
    const yTerm = radiusY * y / (lambda + b2);
    return xTerm * xTerm + yTerm * yTerm - 1;
  };
  let low = 0;
  let high = Math.max(radiusX * x, radiusY * y, 1);
  while (ellipseEquation(high) > 0) high *= 2;
  for (let iteration = 0; iteration < 40; iteration++) {
    const middle = (low + high) / 2;
    if (ellipseEquation(middle) > 0) low = middle;
    else high = middle;
  }
  const closestX = a2 * x / (high + a2);
  const closestY = b2 * y / (high + b2);
  return Math.hypot(x - closestX, y - closestY) <= particleRadius + 1e-9;
}

export function getHitParticles(particles, x, y, toolId, potRadius = TOOL_SHAPE_REFERENCE_POT_RADIUS) {
  const shape = scaledToolShape(toolId, potRadius);
  if (!shape) return [];
  return particles.filter(particle => {
    const dx = particle.x - x;
    const dy = particle.y - y;
    const particleRadius = Math.max(0, particle.r || 0);
    if (shape.type === 'circle') return Math.hypot(dx, dy) <= shape.radius + particleRadius;
    const cosine = Math.cos(shape.rotation);
    const sine = Math.sin(shape.rotation);
    const localX = cosine * dx + sine * dy;
    const localY = -sine * dx + cosine * dy;
    return circleIntersectsEllipse(localX, localY, particleRadius, shape.radiusX, shape.radiusY);
  });
}

export function isGoodToolFor(particle, toolId, oilChilled = false) {
  if (particle.type === 'oil' && oilChilled) return toolId === 'strainer';
  if (particle.type === 'bone') return toolId === 'holey';
  return TOOL_CONFIG[toolId].types.includes(particle.type);
}

export function selectPrimaryTarget(particles, x, y) {
  let primary = null;
  let nearestDistance = Infinity;
  for (const particle of particles) {
    const distance = (particle.x - x) ** 2 + (particle.y - y) ** 2;
    if (distance < nearestDistance) {
      primary = particle;
      nearestDistance = distance;
    }
  }
  return primary;
}

export function getScoopTargets(particles, x, y, toolId, potRadius, oilChilled = false) {
  const hits = getHitParticles(particles, x, y, toolId, potRadius);
  const primary = selectPrimaryTarget(hits, x, y);
  const suitable = hits.filter(particle => isGoodToolFor(particle, toolId, oilChilled));
  return {
    hits,
    primary,
    suitable,
    failure: Boolean(primary && !isGoodToolFor(primary, toolId, oilChilled))
  };
}

export function loseLife(lives) {
  return Math.max(0, Math.floor(lives) - 1);
}

export function noLivesRemaining(lives) {
  return lives <= 0;
}

export function scoopDecision(particle, toolId, oilChilled = false) {
  const correct = isGoodToolFor(particle, toolId, oilChilled);
  const remove = correct && !(particle.type === 'bone' && particle.integrity > 1);
  return { correct, remove, removedMass: remove ? (particle.mass || 1) : 0 };
}

export function scoreParticle(particle, toolId, { oilChilled = false } = {}) {
  const tool = TOOL_CONFIG[toolId];
  const isBig = particle.r > BIG_PARTICLE_RADIUS;
  let points = Math.round(particle.r * SCORE_PER_RADIUS + SCORE_BASE);
  if (particle.type === 'bone') points += BONE_SCORE_BONUS;
  if (particle.type === 'oil' && isBig) points = Math.round(points * BIG_OIL_SCORE_MULTIPLIER);
  if (particle.type === 'veg' && isBig) points = Math.round(points * BIG_VEG_SCORE_MULTIPLIER);
  if (particle.type === 'oil' && oilChilled) points = Math.round(points * CHILLED_OIL_SCORE_MULTIPLIER);
  return Math.round(points * tool.scoreMultiplier);
}

export function parseFriendScore(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value <= 99_999 ? value : null;
  }
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const score = Number(value);
  return Number.isInteger(score) && score <= 99_999 ? score : null;
}

export function wrongToolPenalty(particle) {
  return Math.round(particle.r * WRONG_TOOL_PENALTY_PER_RADIUS + WRONG_TOOL_BASE_PENALTY);
}

export function soupLossForParticle(particle, toolId, spoonStreak = 0) {
  const tool = TOOL_CONFIG[toolId];
  const spoonPenalty = toolId === 'spoon' ? 1 + spoonStreak * SPOON_STREAK_SOUP_LOSS_INCREMENT : 1;
  return tool.soupLossMl * (particle.type === 'veg' ? VEG_SOUP_LOSS_MULTIPLIER : 1) * spoonPenalty;
}

export function applySoupLoss(currentLoss, additionalLoss) {
  return Math.min(SOUP_LOSS_CAP_ML, currentLoss + additionalLoss);
}

export function categoryCleanliness(initialMass, removedMass, type) {
  if (!initialMass[type]) return null;
  return Math.max(0, Math.min(100, Math.round(removedMass[type] / initialMass[type] * 100)));
}

export function overallCleanliness(initialMass, removedMass) {
  const categoryRates = Object.fromEntries(['meat', 'veg', 'oil', 'bone', 'debris'].map(type => [
    type, categoryCleanliness(initialMass, removedMass, type)
  ]));
  const activeRates = Object.values(categoryRates).filter(rate => rate !== null);
  return {
    categoryRates,
    cleanliness: activeRates.length ? Math.round(activeRates.reduce((sum, rate) => sum + rate, 0) / activeRates.length) : 100,
    hasTargets: activeRates.length > 0
  };
}

export function allFoodCorrectlyRemoved(particles, initialMass, removedMass) {
  if (particles.length) return false;
  return ['meat', 'veg', 'oil', 'bone', 'debris'].every(type =>
    (removedMass[type] || 0) + 1e-6 >= (initialMass[type] || 0)
  );
}

export function missionSuccess(rule, reason, {
  particles = [], initialMass = {}, removedMass = {}, failures = 0,
  lives = Math.max(0, PERFECT_LIVES - failures)
} = {}) {
  if (rule === 'clear') return reason === 'cleared' && allFoodCorrectlyRemoved(particles, initialMass, removedMass);
  if (rule === 'perfect') return reason === 'timeout' && lives > 0;
  return null;
}

export function isEligibleDailyChallenge({ date, seed, todayDate }) {
  return date === todayDate && seed === hashSeed(`hotpot-filter-daily-${date}`);
}

export function achievementConditions({ cleanliness, correctRate, attempts, successful, successfulScoops, playedMs, totalSoupLoss, isTodayDailyChallenge }) {
  return {
    first: successfulScoops >= FIRST_ACHIEVEMENT_MIN_SUCCESSFUL_SCOOPS || playedMs >= FIRST_ACHIEVEMENT_MIN_PLAY_MS,
    clean: cleanliness >= 100,
    accurate: attempts >= 8 && correctRate >= 90,
    gentle: successful >= 8 && totalSoupLoss <= 20,
    daily: isTodayDailyChallenge && successfulScoops >= DAILY_ACHIEVEMENT_MIN_SUCCESSFUL_SCOOPS
  };
}

export function resultComment({
  gameMode, challengeRule, missionWon, cleanliness = 0, score, correctRate = 0,
  remaining, reason, failures = 0, lives = 0
}) {
  if (reason === 'manual') return gameMode === 'practice' ? '練習已中止。' : '本局已中止。';
  if (gameMode === 'practice') return '練習完成！可以換湯底、規則與工具再試；冷藏效果和冷卻時間都會依時間計算。';
  if (challengeRule === 'clear') return missionWon ? '全清成功！整鍋食材都已清乾淨。' : `全清挑戰未完成，還有 ${remaining} 份食材留在鍋中。`;
  if (challengeRule === 'perfect') {
    if (!missionWon) return '挑戰結束：命數用完，試著看清主要目標後再下手。';
    return failures === 0 ? '無失誤完成！全程都選對工具。' : `剩 ${lives} 命完成！熟悉主要目標後，試著挑戰無失誤。`;
  }
  if (correctRate < RESULT_COMMENT_MIN_ACCURACY_PERCENT) return '工具正確率還可以再提升，先確認食材類型再選工具。';
  if (score >= RESULT_COMMENT_HIGH_SCORE_THRESHOLD && cleanliness >= RESULT_COMMENT_CLEAN_PERCENT) return '湯底清得很漂亮！眼力和工具都掌握得很好。';
  if (score >= RESULT_COMMENT_HIGH_SCORE_THRESHOLD) return '撈得不錯，工具選擇也很準確！再留意鍋裡剩下的食材。';
  if (score >= RESULT_COMMENT_MID_SCORE_THRESHOLD) return '已經上手了，工具選得不錯；試著更快切換到合適的工具。';
  return '再試一次，先用濾網清理肉沫，再處理蔬菜和浮油。';
}

export function comboMultiplier(combo) {
  const count = Math.max(0, Number(combo) || 0);
  return 1 + Math.min(count, COMBO_MAX) * COMBO_STEP;
}

export function nextCombo(prevCombo, lastSuccessMs, nowMs, success) {
  if (!success) return 0;
  const previous = Math.max(0, Number(prevCombo) || 0);
  const elapsed = Number(nowMs) - Number(lastSuccessMs);
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= COMBO_WINDOW_MS
    ? previous + 1
    : 1;
}

// Clear-wave seconds are rounded down, so a partial second earns no bonus.
export function waveClearBonus(msUntilNextWave) {
  return Math.max(0, Math.floor((Number(msUntilNextWave) || 0) / 1_000))
    * WAVE_CLEAR_BONUS_PER_S;
}

export function clearRuleDurationMs(stageId) {
  return CLEAR_RULE_DURATION_MS[stageId];
}
