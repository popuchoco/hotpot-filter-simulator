const MIN_AMBIENCE_GAIN = .012;
const MAX_AMBIENCE_GAIN = .04;
const MIN_AMBIENCE_RATE = .8;
const MAX_AMBIENCE_RATE = 1.25;
export const AMBIENCE_FIRE_LEVEL_STEPS = 20;
// Mute, pause, and game end fade out over this window instead of cutting to 0 (avoids a click).
export const AMBIENCE_FADE_OUT_S = .08;
// A 0.1 s time constant reaches its new level in about 0.3 s.
export const AMBIENCE_TIME_CONSTANT_S = .1;

export function quantizeFireLevel(fireLevel, steps = AMBIENCE_FIRE_LEVEL_STEPS) {
  const numericLevel = Number(fireLevel);
  const level = Number.isFinite(numericLevel) ? Math.min(1, Math.max(0, numericLevel)) : 0;
  const numericSteps = Number(steps);
  const stepCount = Number.isFinite(numericSteps) && numericSteps > 0
    ? Math.max(1, Math.floor(numericSteps))
    : AMBIENCE_FIRE_LEVEL_STEPS;
  return Math.round(level * stepCount) / stepCount;
}

export function fireLevelAudioSettings(fireLevel, muted = false) {
  const numericLevel = Number(fireLevel);
  const level = Number.isFinite(numericLevel) ? Math.min(1, Math.max(0, numericLevel)) : 0;
  const gain = muted ? 0 : MIN_AMBIENCE_GAIN + (MAX_AMBIENCE_GAIN - MIN_AMBIENCE_GAIN) * level;
  const playbackRate = MIN_AMBIENCE_RATE + (MAX_AMBIENCE_RATE - MIN_AMBIENCE_RATE) * level;
  return { gain, playbackRate };
}

export function shouldRetargetAmbience(previousSettings, nextSettings) {
  return !previousSettings
    || previousSettings.gain !== nextSettings.gain
    || previousSettings.playbackRate !== nextSettings.playbackRate;
}

export function scheduleAmbienceGain(param, targetGain, now, fadeOutS = AMBIENCE_FADE_OUT_S) {
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  if (targetGain === 0) param.linearRampToValueAtTime(0, now + fadeOutS);
  else param.setTargetAtTime(targetGain, now, AMBIENCE_TIME_CONSTANT_S);
}
