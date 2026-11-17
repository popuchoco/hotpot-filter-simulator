// S3 tuning values. Wave index 0 is the unchanged opening pot; refill waves
// start at 1 and use these values.
export const WAVE_SIZE_RATIO = 0.35;
export const WAVE_INTERVAL_MS = Object.freeze({ starter: 9_000, home: 8_000, feast: 7_000 });
export const WAVE_LOW_RATIO = 0.25;
export const WAVE_MIN_GAP_MS = 2_500;
export const POT_CAP_RATIO = 1.3;
export const BOIL_WAVE_PULL_MS = 1_500;
export const MAX_DEBRIS_PER_WAVE = 2;
export const WAVE_FADE_IN_MS = 600;
export const FIRST_BOIL_DELAY_MS = 6_000;
export const WAVE_SPAWN_RING_MIN_RATIO = 0.1;
export const WAVE_SPAWN_RING_MAX_RATIO = 0.2;
export const WAVE_SPAWN_AVOID_DISTANCE_FACTOR = 1.5;
export const WAVE_SPAWN_INWARD_SPEED = 2.2;

export const COMBO_WINDOW_MS = 1_500;
export const COMBO_STEP = 0.05;
export const COMBO_MAX = 10;
export const WAVE_CLEAR_BONUS_PER_S = 15;
export const PERFECT_CLEAR_BONUS_PER_S = 10;

export const CLEAR_RULE_DURATION_MS = Object.freeze({ starter: 75_000, home: 60_000, feast: 55_000 });
export const DAILY_WAVE_STREAM_XOR = 0x9E3779B9;
export const PRACTICE_WAVES_ENABLED = false;
