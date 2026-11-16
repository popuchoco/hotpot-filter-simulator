import {
  BIG_OIL_SCORE_MULTIPLIER, BIG_PARTICLE_RADIUS, BIG_VEG_SCORE_MULTIPLIER,
  BONE_SCORE_BONUS, CHILLED_OIL_SCORE_MULTIPLIER, SCORE_BASE, SCORE_PER_RADIUS,
  DAILY_ACHIEVEMENT_MIN_SUCCESSFUL_SCOOPS, FIRST_ACHIEVEMENT_MIN_PLAY_MS,
  FIRST_ACHIEVEMENT_MIN_SUCCESSFUL_SCOOPS, RESULT_COMMENT_HIGH_SCORE_THRESHOLD,
  RESULT_COMMENT_CLEAN_PERCENT, RESULT_COMMENT_MID_SCORE_THRESHOLD, RESULT_COMMENT_MIN_ACCURACY_PERCENT,
  SOUP_LOSS_CAP_ML, SPOON_STREAK_SOUP_LOSS_INCREMENT, TOOL_CONFIG,
  VEG_SOUP_LOSS_MULTIPLIER, WRONG_TOOL_BASE_PENALTY, WRONG_TOOL_PENALTY_PER_RADIUS
} from './config.js';
import { hashSeed } from './rng.js';

export function getHitParticles(particles, x, y, toolId) {
  const tool = TOOL_CONFIG[toolId];
  return particles.filter(particle => Math.hypot(particle.x - x, particle.y - y) < tool.radius * .8 + particle.r * .4);
}

export function isGoodToolFor(particle, toolId, oilChilled = false) {
  if (particle.type === 'oil' && oilChilled) return toolId === 'strainer';
  if (particle.type === 'bone') return toolId === 'holey';
  return TOOL_CONFIG[toolId].types.includes(particle.type);
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

export function missionSuccess(rule, reason, { particles = [], initialMass = {}, removedMass = {}, failures = 0 } = {}) {
  if (rule === 'clear') return reason === 'cleared' && allFoodCorrectlyRemoved(particles, initialMass, removedMass);
  if (rule === 'perfect') return reason === 'timeout' && failures === 0;
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

export function resultComment({ gameMode, challengeRule, missionWon, cleanliness = 0, score, correctRate = 0, remaining, reason }) {
  if (reason === 'manual') return gameMode === 'practice' ? '練習已中止。' : '本局已中止。';
  if (gameMode === 'practice') return '練習完成！可以換湯底、規則與工具再試；冷藏效果和冷卻時間都會依時間計算。';
  if (challengeRule === 'clear') return missionWon ? '全清成功！整鍋食材都已清乾淨。' : `全清挑戰未完成，還有 ${remaining} 份食材留在鍋中。`;
  if (challengeRule === 'perfect') return missionWon ? '無失誤完成！全程都選對工具。' : '挑戰結束：出現工具失誤，試著看清食材後再下手。';
  if (correctRate < RESULT_COMMENT_MIN_ACCURACY_PERCENT) return '工具正確率還可以再提升，先確認食材類型再選工具。';
  if (score >= RESULT_COMMENT_HIGH_SCORE_THRESHOLD && cleanliness >= RESULT_COMMENT_CLEAN_PERCENT) return '湯底清得很漂亮！眼力和工具都掌握得很好。';
  if (score >= RESULT_COMMENT_HIGH_SCORE_THRESHOLD) return '撈得不錯，工具選擇也很準確！再留意鍋裡剩下的食材。';
  if (score >= RESULT_COMMENT_MID_SCORE_THRESHOLD) return '已經上手了，工具選得不錯；試著更快切換到合適的工具。';
  return '再試一次，先用濾網清理肉沫，再處理蔬菜和浮油。';
}
