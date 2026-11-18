import { describe, expect, it } from 'vitest';
import {
  AMBIENCE_FIRE_LEVEL_STEPS, fireLevelAudioSettings, quantizeFireLevel, shouldRetargetAmbience
} from '../src/audio.js';

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
});
