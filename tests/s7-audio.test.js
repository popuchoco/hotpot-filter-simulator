import { describe, expect, it } from 'vitest';
import { fireLevelAudioSettings } from '../src/audio.js';

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
});
