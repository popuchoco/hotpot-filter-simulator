import { describe, expect, it } from 'vitest';
import {
  CANVAS_MAX_DISPLAY_SIZE, POT_RADIUS_RATIO, POT_REFERENCE_CANVAS_SIZE,
  TOOL_SHAPE_REFERENCE_POT_RADIUS, scaledToolShape
} from '../src/config.js';

describe('H2 desktop canvas size', () => {
  it('allows the intended desktop pot size while preserving reference tool scaling', () => {
    const potDiameterToViewportHeight = CANVAS_MAX_DISPLAY_SIZE * 2 * POT_RADIUS_RATIO / 1080;
    expect(potDiameterToViewportHeight).toBeGreaterThanOrEqual(.60);
    expect(potDiameterToViewportHeight).toBeLessThanOrEqual(.65);
    expect(POT_REFERENCE_CANVAS_SIZE).toBe(510);

    const referenceShape = scaledToolShape('spoon', TOOL_SHAPE_REFERENCE_POT_RADIUS);
    const doubleSizeShape = scaledToolShape('spoon', TOOL_SHAPE_REFERENCE_POT_RADIUS * 2);
    expect(doubleSizeShape.radiusX).toBe(referenceShape.radiusX * 2);
  });
});
