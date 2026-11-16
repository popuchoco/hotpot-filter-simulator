import { describe, expect, it } from 'vitest';
import {
  DAILY_ACHIEVEMENT_MIN_SUCCESSFUL_SCOOPS, FIRST_ACHIEVEMENT_MIN_PLAY_MS,
  FIRST_ACHIEVEMENT_MIN_SUCCESSFUL_SCOOPS, RESULT_COMMENT_HIGH_SCORE_THRESHOLD,
  RESULT_COMMENT_MID_SCORE_THRESHOLD, RESULT_COMMENT_MIN_ACCURACY_PERCENT
} from '../src/config.js';
import {
  achievementConditions, allFoodCorrectlyRemoved, isEligibleDailyChallenge,
  missionSuccess, overallCleanliness, resultComment, scoopDecision
} from '../src/rules.js';
import { hashSeed } from '../src/rng.js';

describe('S1 rule and achievement regressions', () => {
  it('does not remove a particle or improve cleanliness when the tool is wrong', () => {
    const meat = { x: 0, y: 0, r: 5, type: 'meat', mass: 1 };
    const decision = scoopDecision(meat, 'spoon');
    const initialMass = { meat: 1 };
    const removedMass = { meat: decision.removedMass };
    const particles = decision.remove ? [] : [meat];

    expect(decision).toEqual({ correct: false, remove: false, removedMass: 0 });
    expect(particles).toEqual([meat]);
    expect(overallCleanliness(initialMass, removedMass).cleanliness).toBe(0);
  });

  it('does not let repeated wrong-tool scoops satisfy a full-clear challenge', () => {
    const meat = { x: 0, y: 0, r: 5, type: 'meat', mass: 1 };
    const particles = [meat];
    const initialMass = { meat: 1 };
    const removedMass = { meat: 0 };

    for (let attempt = 0; attempt < 100; attempt++) {
      const decision = scoopDecision(meat, 'spoon');
      if (decision.remove) particles.splice(0, 1);
      removedMass.meat += decision.removedMass;
    }

    expect(allFoodCorrectlyRemoved(particles, initialMass, removedMass)).toBe(false);
    expect(missionSuccess('clear', 'cleared', { particles, initialMass, removedMass })).toBe(false);
  });

  it('requires every food category to be correctly removed for a clear win', () => {
    const initialMass = { meat: 1, oil: 4 };
    const removedMass = { meat: 1, oil: 3 };
    expect(allFoodCorrectlyRemoved([], initialMass, removedMass)).toBe(false);
    expect(missionSuccess('clear', 'cleared', { particles: [], initialMass, removedMass })).toBe(false);
    removedMass.oil = 4;
    expect(missionSuccess('clear', 'cleared', { particles: [], initialMass, removedMass })).toBe(true);
  });

  it('only awards a perfect win on timeout with no failures; manual end is aborted', () => {
    expect(missionSuccess('perfect', 'manual', { failures: 0 })).toBe(false);
    expect(missionSuccess('perfect', 'timeout', { failures: 1 })).toBe(false);
    expect(missionSuccess('perfect', 'timeout', { failures: 0 })).toBe(true);
    expect(resultComment({
      gameMode: 'challenge', challengeRule: 'perfect', missionWon: false,
      cleanliness: 0, score: 0, correctRate: 0, remaining: 1, reason: 'manual'
    })).toContain('已中止');
  });

  it('applies first and daily achievement minimums', () => {
    const base = {
      cleanliness: 50, correctRate: 50, attempts: 0, successful: 0,
      successfulScoops: 0, playedMs: 0, totalSoupLoss: 0, isTodayDailyChallenge: false
    };
    expect(achievementConditions(base).first).toBe(false);
    expect(achievementConditions({ ...base, successfulScoops: FIRST_ACHIEVEMENT_MIN_SUCCESSFUL_SCOOPS }).first).toBe(true);
    expect(achievementConditions({ ...base, playedMs: FIRST_ACHIEVEMENT_MIN_PLAY_MS }).first).toBe(true);
    expect(achievementConditions({ ...base, isTodayDailyChallenge: true, successfulScoops: DAILY_ACHIEVEMENT_MIN_SUCCESSFUL_SCOOPS - 1 }).daily).toBe(false);
    expect(achievementConditions({ ...base, isTodayDailyChallenge: true, successfulScoops: DAILY_ACHIEVEMENT_MIN_SUCCESSFUL_SCOOPS }).daily).toBe(true);
  });

  it('rejects a forged seed for today’s daily achievement', () => {
    const date = '20261117';
    const officialSeed = hashSeed(`hotpot-filter-daily-${date}`);
    const forgedSeed = officialSeed === 1 ? 2 : 1;
    expect(isEligibleDailyChallenge({ date, seed: officialSeed, todayDate: date })).toBe(true);
    expect(isEligibleDailyChallenge({ date, seed: forgedSeed, todayDate: date })).toBe(false);

    const forgedRun = achievementConditions({
      cleanliness: 100, correctRate: 100, attempts: 8, successful: 8,
      successfulScoops: DAILY_ACHIEVEMENT_MIN_SUCCESSFUL_SCOOPS, playedMs: FIRST_ACHIEVEMENT_MIN_PLAY_MS,
      totalSoupLoss: 0,
      isTodayDailyChallenge: isEligibleDailyChallenge({ date, seed: forgedSeed, todayDate: date })
    });
    expect(forgedRun.daily).toBe(false);
  });

  it('grades score comments by accuracy and named score tiers', () => {
    const comment = (score, correctRate) => resultComment({
      gameMode: 'challenge', challengeRule: 'score', missionWon: null,
      cleanliness: 50, score, correctRate, remaining: 0, reason: 'timeout'
    });
    expect(comment(RESULT_COMMENT_HIGH_SCORE_THRESHOLD, RESULT_COMMENT_MIN_ACCURACY_PERCENT - 1))
      .toContain('工具正確率還可以再提升');
    expect(comment(RESULT_COMMENT_HIGH_SCORE_THRESHOLD, RESULT_COMMENT_MIN_ACCURACY_PERCENT))
      .toContain('工具選擇也很準確');
    expect(comment(RESULT_COMMENT_MID_SCORE_THRESHOLD, RESULT_COMMENT_MIN_ACCURACY_PERCENT))
      .toContain('已經上手');
    expect(comment(RESULT_COMMENT_MID_SCORE_THRESHOLD - 1, RESULT_COMMENT_MIN_ACCURACY_PERCENT))
      .toContain('再試一次');
  });
});

describe('S1 comment tiers with cleanliness', () => {
  it('only gives the top praise when accuracy, score, and cleanliness all clear their thresholds', () => {
    const base = { gameMode: 'challenge', challengeRule: 'score', missionWon: null, remaining: 0, score: 500 };
    expect(resultComment({ ...base, cleanliness: 100, correctRate: 95 })).toContain('掌握得很好');
    expect(resultComment({ ...base, cleanliness: 100, correctRate: 40 })).not.toContain('掌握得很好');
    expect(resultComment({ ...base, cleanliness: 50, correctRate: 95 })).not.toContain('掌握得很好');
  });
});
