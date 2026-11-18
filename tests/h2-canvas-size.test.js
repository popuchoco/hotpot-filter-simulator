import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CANVAS_MAX_DISPLAY_SIZE, POT_RADIUS_RATIO, POT_REFERENCE_CANVAS_SIZE,
  TOOL_SHAPE_REFERENCE_POT_RADIUS, scaledToolShape
} from '../src/config.js';

const styleSource = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const gameSource = readFileSync(new URL('../src/game.js', import.meta.url), 'utf8');

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

  it('uses the configured display size for the canvas CSS width', () => {
    const canvasRule = styleSource.match(/\.canvas-stage\s+#canvas\s*\{([^}]*)\}/)?.[1];
    expect(canvasRule).toContain('width: min(100%, var(--canvas-max-display-size));');
    expect(styleSource).not.toContain('800px');
    expect(gameSource).toMatch(/document\.documentElement\.style\.setProperty\(\s*'--canvas-max-display-size',\s*`\$\{CONFIG\.CANVAS_MAX_DISPLAY_SIZE\}px`\s*\)/);
  });
});
