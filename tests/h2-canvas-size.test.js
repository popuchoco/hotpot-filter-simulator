import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  POT_REFERENCE_CANVAS_SIZE, POT_RADIUS_RATIO, TOOL_SHAPE_REFERENCE_POT_RADIUS, scaledToolShape
} from '../src/config.js';

// Follow renderer.js's cache-busting query so tools/bump-version.mjs does not break this mock.
const rendererSource = readFileSync(new URL('../src/renderer.js', import.meta.url), 'utf8');
const gameImportQuery = rendererSource.match(/from '\.\/game\.js(\?v=[^']*)?'/)?.[1] ?? '';
vi.doMock(`../src/game.js${gameImportQuery}`, () => ({
  brothId: 'clear', canvasHeight: 0, canvasWidth: 0, ctx: {}, currentTool: 'spoon',
  highContrast: false, isOilChilled: () => false, mouse: { x: 0, y: 0 },
  particleGroups: {}, reduceMotion: false, selectedSkin: 'steel', visualEffects: []
}));
vi.stubGlobal('window', { location: { search: '' } });
const { drawnPotRadius } = await import('../src/renderer.js');
vi.unstubAllGlobals();

const styleSource = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const gameSource = readFileSync(new URL('../src/game.js', import.meta.url), 'utf8');

describe('H2 desktop canvas size', () => {
  it('allows the intended desktop pot size while preserving reference tool scaling', () => {
    expect(POT_REFERENCE_CANVAS_SIZE).toBe(510);

    const referenceShape = scaledToolShape('spoon', TOOL_SHAPE_REFERENCE_POT_RADIUS);
    const doubleSizeShape = scaledToolShape('spoon', TOOL_SHAPE_REFERENCE_POT_RADIUS * 2);
    expect(doubleSizeShape.radiusX).toBe(referenceShape.radiusX * 2);
  });

  it('calculates the drawn pot radius from the smaller canvas dimension', () => {
    expect(drawnPotRadius(800, 600)).toBe(600 * POT_RADIUS_RATIO);
    expect(drawnPotRadius(600, 800)).toBe(600 * POT_RADIUS_RATIO);
  });

  it('uses the configured display size for the canvas CSS width', () => {
    const canvasRule = styleSource.match(/\.canvas-stage\s+#canvas\s*\{([^}]*)\}/)?.[1];
    expect(canvasRule).toContain('width: min(100%, var(--canvas-max-display-size));');
    expect(styleSource).not.toContain('800px');
    expect(gameSource).toMatch(/document\.documentElement\.style\.setProperty\(\s*'--canvas-max-display-size',\s*`\$\{CONFIG\.CANVAS_MAX_DISPLAY_SIZE\}px`\s*\)/);
  });
});
