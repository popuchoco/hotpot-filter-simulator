import { describe, expect, it } from 'vitest';
import {
  AMBIENCE_FADE_OUT_S, AMBIENCE_FIRE_LEVEL_STEPS, AMBIENCE_TIME_CONSTANT_S, fireLevelAudioSettings,
  quantizeFireLevel, scheduleAmbienceGain, shouldRetargetAmbience
} from '../src/audio.js';

function recordingParam(value) {
  const calls = [];
  const param = { value };
  for (const name of ['cancelScheduledValues', 'setValueAtTime', 'linearRampToValueAtTime', 'setTargetAtTime']) {
    param[name] = (...args) => { calls.push([name, ...args]); return param; };
  }
  return { param, calls };
}

describe('S7 simmer ambience', () => {
  it('raises ambience gain and playback rate with fire level', () => {
    const settings = [0, .25, .5, .75, 1].map(level => fireLevelAudioSettings(level));
    for (let index = 1; index < settings.length; index += 1) {
      expect(settings[index].gain).toBeGreaterThan(settings[index - 1].gain);
      expect(settings[index].playbackRate).toBeGreaterThan(settings[index - 1].playbackRate);
    }
  });

  it('clamps fire level and mutes ambience gain to zero', () => {
    expect(fireLevelAudioSettings(-2)).toEqual(fireLevelAudioSettings(0));
    expect(fireLevelAudioSettings(2)).toEqual(fireLevelAudioSettings(1));
    expect(fireLevelAudioSettings(.75, true).gain).toBe(0);
  });

  it('retargets a slow two-second fire ramp only at the configured steps', () => {
    let previousSettings = null;
    let retargets = 0;

    for (let frame = 0; frame <= 120; frame += 1) {
      const level = quantizeFireLevel(frame / 120);
      const settings = fireLevelAudioSettings(level);
      if (shouldRetargetAmbience(previousSettings, settings)) retargets += 1;
      previousSettings = settings;
    }

    expect(retargets).toBeLessThanOrEqual(AMBIENCE_FIRE_LEVEL_STEPS + 1);
    expect(retargets).toBeLessThan(120);
  });

  it('does not retarget an identical level', () => {
    const settings = fireLevelAudioSettings(quantizeFireLevel(.42));
    expect(shouldRetargetAmbience(settings, fireLevelAudioSettings(quantizeFireLevel(.42)))).toBe(false);
  });

  it('retargets immediately when muted and again when unmuted', () => {
    const activeSettings = fireLevelAudioSettings(quantizeFireLevel(.42));
    const mutedSettings = fireLevelAudioSettings(quantizeFireLevel(.42), true);

    expect(mutedSettings.gain).toBe(0);
    expect(shouldRetargetAmbience(activeSettings, mutedSettings)).toBe(true);
    expect(shouldRetargetAmbience(mutedSettings, activeSettings)).toBe(true);
  });

  it('fades ambience out over a short ramp instead of cutting straight to zero', () => {
    const { param, calls } = recordingParam(.03);
    scheduleAmbienceGain(param, 0, 2);
    expect(AMBIENCE_FADE_OUT_S).toBeGreaterThanOrEqual(.05);
    expect(AMBIENCE_FADE_OUT_S).toBeLessThanOrEqual(.1);
    expect(calls).toEqual([
      ['cancelScheduledValues', 2],
      ['setValueAtTime', .03, 2],
      ['linearRampToValueAtTime', 0, 2 + AMBIENCE_FADE_OUT_S]
    ]);
    expect(calls.some(([name, target]) => name === 'setValueAtTime' && target === 0)).toBe(false);
  });

  it('anchors the current gain before easing toward a non-zero target', () => {
    const { param, calls } = recordingParam(0);
    scheduleAmbienceGain(param, .025, 1.5);
    expect(calls).toEqual([
      ['cancelScheduledValues', 1.5],
      ['setValueAtTime', 0, 1.5],
      ['setTargetAtTime', .025, 1.5, AMBIENCE_TIME_CONSTANT_S]
    ]);
  });
});
