const MIN_AMBIENCE_GAIN = .012;
const MAX_AMBIENCE_GAIN = .04;
const MIN_AMBIENCE_RATE = .8;
const MAX_AMBIENCE_RATE = 1.25;

export function fireLevelAudioSettings(fireLevel, muted = false) {
  const numericLevel = Number(fireLevel);
  const level = Number.isFinite(numericLevel) ? Math.min(1, Math.max(0, numericLevel)) : 0;
  const gain = muted ? 0 : MIN_AMBIENCE_GAIN + (MAX_AMBIENCE_GAIN - MIN_AMBIENCE_GAIN) * level;
  const playbackRate = MIN_AMBIENCE_RATE + (MAX_AMBIENCE_RATE - MIN_AMBIENCE_RATE) * level;
  return { gain, playbackRate };
}
