// Canvas rendering functions. Game state is imported explicitly from game.js.
import {
  brothId, canvasHeight, canvasWidth, ctx, currentTool, highContrast,
  isOilChilled, mouse, particleGroups, reduceMotion, selectedSkin, visualEffects
} from './game.js';
import { BROTHS, POT_RADIUS_RATIO, POT_SKINS, scaledToolShape, TOOL_SHAPES } from './config.js';
import { WAVE_FADE_IN_MS } from './balance.js';
import { drawFoodSprite } from './food-sprites.js';
import {
  bubbleCountForHeat, debugHitEnabled, heatLevelAt, particleBobOffset,
  renderCacheKey, steamWispCount, visualNoise
} from './rendering.js';
import { pruneVisualEffects, visualEffectProgress } from './visual-effects.js';
const DEBUG_HIT_OVERLAY = debugHitEnabled(window.location.search);
const SPLASH_DIRECTIONS = Object.freeze([-2.7, -2.12, -1.58, -.98, -.42]);
const DRIP_OFFSETS = Object.freeze([-6, 0, 6]);
const POT_GEOMETRY = Object.freeze({
  outerRadiusX: POT_RADIUS_RATIO,
  outerRadiusY: .93,
  basinInset: .925,
  soupRadiusX: .875,
  soupRadiusY: .855
});
const POT_BODY_GRADIENT_OFFSETS = Object.freeze([0, .06, .14, .24, .29, .76, .93, 1]);
const POT_RIM_STOPS = Object.freeze([[0, '#fff9e9'], [.1, '#59564f'], [.24, '#e4ddcf'], [.42, '#777268'], [.58, '#f8f0df'], [.76, '#625c51'], [1, '#282622']]);
const POT_INTERIOR_STOPS = Object.freeze([[0, '#d9d3c6'], [.13, '#6e6b63'], [.3, '#a59e8c'], [.52, '#4a4842'], [.75, '#242321'], [1, '#121211']]);
const BROTH_APPEARANCE = Object.freeze({
  clear: Object.freeze({
    stops: Object.freeze(['rgba(255,241,199,.83)', 'rgba(230,192,119,.72)', 'rgba(171,116,61,.58)', 'rgba(91,53,32,.62)']),
    oil: 'rgba(255,245,208,.46)', edge: 'rgba(255,248,220,.68)', cloud: null
  }),
  mala: Object.freeze({
    stops: Object.freeze(['#e87642', '#cb4428', '#922d23', '#4a1c18']),
    oil: 'rgba(255,174,86,.56)', edge: 'rgba(255,206,141,.8)', cloud: null
  }),
  miso: Object.freeze({
    stops: Object.freeze(['#f8e6a7', '#dec27c', '#b58c4e', '#75502f']),
    oil: 'rgba(255,244,198,.38)', edge: 'rgba(255,236,177,.74)', cloud: 'rgba(255,244,206,.22)'
  })
});
let potCache = null;
let brothCache = null;

function makeOffscreenCanvas(width, height, dpr) {
  const surface = document.createElement('canvas');
  surface.width = Math.max(1, Math.round(width * dpr));
  surface.height = Math.max(1, Math.round(height * dpr));
  const surfaceContext = surface.getContext('2d');
  surfaceContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { surface, surfaceContext };
}

function drawHandle(target, cx, cy, rx, ry, side) {
  const hx = cx + side * rx * 1.06;
  const hy = cy + ry * 0.04;
  const metal = target.createLinearGradient(hx - rx * 0.12, hy - ry * 0.08, hx + rx * 0.12, hy + ry * 0.1);
  metal.addColorStop(0, '#554f45');
  metal.addColorStop(0.25, '#f1e9d8');
  metal.addColorStop(0.52, '#888176');
  metal.addColorStop(0.78, '#ded5c3');
  metal.addColorStop(1, '#36332e');

  target.save();
  target.lineCap = 'round';
  target.strokeStyle = 'rgba(0,0,0,.78)';
  target.lineWidth = Math.max(8, rx * 0.05);
  target.beginPath();
  target.moveTo(cx + side * rx * 0.82, hy);
  target.lineTo(cx + side * rx * 1.04, hy);
  target.stroke();
  target.strokeStyle = metal;
  target.lineWidth = Math.max(5, rx * 0.028);
  target.beginPath();
  target.ellipse(hx, hy, rx * 0.13, ry * 0.085, 0, 0, Math.PI * 2);
  target.stroke();
  target.beginPath();
  target.moveTo(cx + side * rx * 0.84, hy - ry * 0.012);
  target.lineTo(cx + side * rx * 1.04, hy - ry * 0.012);
  target.stroke();
  target.strokeStyle = 'rgba(255,255,255,.68)';
  target.lineWidth = Math.max(1, rx * 0.005);
  target.beginPath();
  target.moveTo(cx + side * rx * 0.88, hy - ry * 0.018);
  target.lineTo(cx + side * rx * 1.01, hy - ry * 0.018);
  target.stroke();
  target.restore();
}

function drawTableAndPot(target, w, h, skinId, contrast) {
  const size = Math.min(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const rx = size * POT_GEOMETRY.outerRadiusX;
  const ry = rx * POT_GEOMETRY.outerRadiusY;

  const backdrop = target.createRadialGradient(cx, cy, size * 0.08, cx, cy, size * 0.74);
  backdrop.addColorStop(0, '#534235');
  backdrop.addColorStop(.55, '#30251e');
  backdrop.addColorStop(1, '#15120f');
  target.fillStyle = backdrop;
  target.fillRect(0, 0, w, h);

  target.save();
  target.fillStyle = 'rgba(0,0,0,.35)';
  target.beginPath();
  target.ellipse(cx, cy + ry * .56, rx * 1.08, ry * .43, 0, 0, Math.PI * 2);
  target.fill();
  target.shadowColor = 'rgba(0,0,0,.72)';
  target.shadowBlur = size * .052;
  target.shadowOffsetY = size * .045;
  target.fillStyle = 'rgba(0,0,0,.64)';
  target.beginPath();
  target.ellipse(cx, cy + ry * .48, rx * 1.015, ry * .49, 0, 0, Math.PI * 2);
  target.fill();
  target.restore();

  drawHandle(target, cx, cy, rx, ry, -1);
  drawHandle(target, cx, cy, rx, ry, 1);

  target.save();
  target.shadowColor = 'rgba(0,0,0,.74)';
  target.shadowBlur = size * .052;
  target.shadowOffsetY = size * .028;
  const potBody = target.createLinearGradient(cx - rx, cy - ry, cx + rx * .48, cy + ry);
  const potStops = POT_SKINS[skinId].outer;
  POT_BODY_GRADIENT_OFFSETS.forEach((offset, index) => potBody.addColorStop(offset, potStops[index]));
  target.fillStyle = potBody;
  target.beginPath();
  target.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  target.fill();
  target.restore();

  // Broad, soft reflection bands mimic the room reflected in polished metal.
  target.save();
  target.beginPath();
  target.ellipse(cx, cy, rx * .992, ry * .992, 0, 0, Math.PI * 2);
  target.clip();
  const reflection = target.createLinearGradient(cx - rx, 0, cx + rx, 0);
  reflection.addColorStop(0, 'rgba(255,255,255,.02)');
  reflection.addColorStop(.16, 'rgba(255,255,255,.23)');
  reflection.addColorStop(.24, 'rgba(255,255,255,.025)');
  reflection.addColorStop(.48, 'rgba(255,255,255,.13)');
  reflection.addColorStop(.61, 'rgba(255,255,255,.012)');
  reflection.addColorStop(.82, 'rgba(255,255,255,.17)');
  reflection.addColorStop(1, 'rgba(255,255,255,.015)');
  target.fillStyle = reflection;
  target.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  const brightBand = target.createLinearGradient(0, cy - ry * .72, 0, cy + ry * .68);
  brightBand.addColorStop(0, 'rgba(255,255,255,.48)');
  brightBand.addColorStop(.16, 'rgba(255,255,255,.02)');
  brightBand.addColorStop(.62, 'rgba(0,0,0,.04)');
  brightBand.addColorStop(1, 'rgba(0,0,0,.5)');
  target.fillStyle = brightBand;
  target.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  target.restore();

  const rimGradient = target.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
  POT_RIM_STOPS.forEach(([offset, color]) => rimGradient.addColorStop(offset, color));
  target.strokeStyle = '#12110f';
  target.lineWidth = Math.max(9, size * .026);
  target.beginPath();
  target.ellipse(cx, cy, rx * .985, ry * .985, 0, 0, Math.PI * 2);
  target.stroke();
  target.strokeStyle = rimGradient;
  target.lineWidth = Math.max(4, size * .012);
  target.beginPath();
  target.ellipse(cx, cy, rx * .97, ry * .97, 0, 0, Math.PI * 2);
  target.stroke();
  target.strokeStyle = 'rgba(255,251,236,.9)';
  target.lineWidth = Math.max(1.2, size * .003);
  target.beginPath();
  target.ellipse(cx, cy, rx * .951, ry * .951, 0, Math.PI * 1.06, Math.PI * 1.94);
  target.stroke();
  target.strokeStyle = 'rgba(15,13,11,.76)';
  target.lineWidth = Math.max(1, size * .0025);
  target.beginPath();
  target.ellipse(cx, cy, rx * .932, ry * .932, 0, 0, Math.PI * 2);
  target.stroke();

  const basinX = rx * POT_GEOMETRY.basinInset;
  const basinY = ry * POT_GEOMETRY.basinInset;
  const inside = target.createRadialGradient(cx - rx * .24, cy - ry * .27, size * .04, cx, cy, rx * 1.03);
  POT_INTERIOR_STOPS.forEach(([offset, color]) => inside.addColorStop(offset, color));
  target.fillStyle = inside;
  target.beginPath();
  target.ellipse(cx, cy, basinX, basinY, 0, 0, Math.PI * 2);
  target.fill();

  target.strokeStyle = contrast ? '#fff' : 'rgba(255,251,235,.35)';
  target.lineWidth = contrast ? Math.max(2, size * .006) : Math.max(1, size * .002);
  target.beginPath();
  target.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  target.stroke();

  // Small, fixed specular points catch the light along the rolled lip.
  for (const [xRatio, yRatio, radius] of [[-.53, -.81, .012], [.61, -.74, .008], [.91, .05, .006]]) {
    target.fillStyle = contrast ? '#fff' : 'rgba(255,255,244,.86)';
    target.beginPath();
    target.ellipse(cx + rx * xRatio, cy + ry * yRatio, size * radius, size * radius * .52, -.35, 0, Math.PI * 2);
    target.fill();
  }
}

function drawBrothBase(target, w, h, brothId, contrast) {
  const size = Math.min(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const rx = size * POT_GEOMETRY.outerRadiusX * POT_GEOMETRY.soupRadiusX;
  const ry = size * POT_GEOMETRY.outerRadiusX * POT_GEOMETRY.outerRadiusY * POT_GEOMETRY.soupRadiusY;
  const appearance = BROTH_APPEARANCE[brothId];

  target.save();
  target.beginPath();
  target.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  target.clip();
  const surface = target.createRadialGradient(cx - rx * .3, cy - ry * .47, size * .025, cx, cy + ry * .06, rx * 1.23);
  appearance.stops.forEach((color, index) => surface.addColorStop(index / (appearance.stops.length - 1), color));
  target.fillStyle = surface;
  target.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

  const lowerDepth = target.createLinearGradient(0, cy - ry * .2, 0, cy + ry);
  lowerDepth.addColorStop(0, 'rgba(28,16,12,0)');
  lowerDepth.addColorStop(.55, 'rgba(37,21,13,.08)');
  lowerDepth.addColorStop(1, brothId === 'clear' ? 'rgba(62,34,20,.32)' : 'rgba(31,12,10,.34)');
  target.fillStyle = lowerDepth;
  target.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

  const surfaceLight = target.createRadialGradient(cx - rx * .32, cy - ry * .45, 0, cx - rx * .32, cy - ry * .45, rx * .8);
  surfaceLight.addColorStop(0, brothId === 'mala' ? 'rgba(255,190,112,.2)' : 'rgba(255,249,222,.36)');
  surfaceLight.addColorStop(1, 'rgba(255,255,255,0)');
  target.fillStyle = surfaceLight;
  target.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

  if (appearance.cloud) {
    for (let i = 0; i < 11; i++) {
      const x = cx + (visualNoise(i * 3 + 17) - .5) * rx * 1.5;
      const y = cy + (visualNoise(i * 5 + 31) - .5) * ry * 1.4;
      const cloud = target.createRadialGradient(x, y, 0, x, y, size * (.035 + visualNoise(i + 71) * .045));
      cloud.addColorStop(0, appearance.cloud);
      cloud.addColorStop(1, 'rgba(255,244,206,0)');
      target.fillStyle = cloud;
      target.fillRect(x - size * .09, y - size * .09, size * .18, size * .18);
    }
  }

  // Static oil films and reflected window streaks sit on the broth surface.
  target.fillStyle = appearance.oil;
  target.beginPath();
  target.ellipse(cx - rx * .23, cy - ry * .42, rx * .2, ry * .045, -.18, 0, Math.PI * 2);
  target.fill();
  target.beginPath();
  target.ellipse(cx + rx * .38, cy + ry * .16, rx * .12, ry * .027, .3, 0, Math.PI * 2);
  target.fill();
  target.strokeStyle = contrast ? '#fff' : 'rgba(255,255,236,.32)';
  target.lineWidth = Math.max(1, size * .003);
  target.beginPath();
  target.ellipse(cx - rx * .08, cy - ry * .33, rx * .48, ry * .09, -.08, Math.PI * 1.08, Math.PI * 1.83);
  target.stroke();
  target.restore();

  // Fresnel rim: the grazing-angle light grows brighter near the inner wall.
  target.strokeStyle = contrast ? '#fff' : appearance.edge;
  target.lineWidth = contrast ? Math.max(2.5, size * .009) : Math.max(3, size * .012);
  target.beginPath();
  target.ellipse(cx, cy, rx * .985, ry * .985, 0, Math.PI * 1.04, Math.PI * 1.96);
  target.stroke();
  target.strokeStyle = contrast ? '#000' : 'rgba(33,20,14,.28)';
  target.lineWidth = Math.max(1, size * .003);
  target.beginPath();
  target.ellipse(cx, cy, rx * .966, ry * .966, 0, 0, Math.PI * 2);
  target.stroke();
}

function drawSurfaceMotion(now, brothId, heatLevel, size, cx, cy, soupRx, soupRy) {
  if (reduceMotion || heatLevel <= 0) return;
  const t = now / 1000;
  const count = bubbleCountForHeat(heatLevel);
  const disturbance = heatLevel;
  for (let i = 0; i < count; i++) {
    const phase = t * (.32 + i * .018) + i * 1.73;
    const bx = cx + Math.sin(phase) * soupRx * (.14 + (i % 4) * .16);
    const by = cy + Math.cos(phase * .8) * soupRy * (.12 + (i % 5) * .13);
    const radius = size * (.003 + (i % 4) * .0016) * (.72 + disturbance * .36);
    ctx.beginPath();
    ctx.arc(bx, by, radius, 0, Math.PI * 2);
    ctx.fillStyle = brothId === 'mala' ? 'rgba(255,194,122,.3)' : 'rgba(255,249,224,.32)';
    ctx.fill();
    ctx.strokeStyle = brothId === 'mala' ? 'rgba(105,25,17,.48)' : 'rgba(122,79,39,.36)';
    ctx.lineWidth = Math.max(1, size * .002);
    ctx.stroke();
  }

  ctx.strokeStyle = BROTHS[brothId].flowColor;
  ctx.lineWidth = Math.max(1.5, size * (.004 + disturbance * .004));
  ctx.setLineDash([size * (.012 + disturbance * .012), size * .02]);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(cx + Math.sin(t + i) * soupRx * .16 * disturbance,
      cy + Math.cos(t * .8 + i) * soupRy * .12 * disturbance,
      soupRx * (.31 + i * .1), soupRy * (.2 + i * .07), t * .08 * disturbance,
      t * (.25 + .25 * disturbance) + i, t * (.25 + .25 * disturbance) + i + Math.PI * 1.25);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawSteam(now, heatLevel, size, cx, cy, soupRx, soupRy) {
  if (reduceMotion) return;
  const count = steamWispCount(heatLevel);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const a = visualNoise(i * 11 + 7);
    const b = visualNoise(i * 13 + 19);
    const phase = (now * (.00012 + a * .00008) + b) % 1;
    const x = cx + (a - .5) * soupRx * 1.35;
    const y = cy - soupRy * (.56 + b * .26);
    const rise = size * (.085 + b * .11) * phase;
    const drift = Math.sin(now * .00055 + i * 1.9) * size * .018;
    const alpha = (.065 + heatLevel * .09) * (1 - phase) * (1 - phase * .45);
    ctx.strokeStyle = `rgba(255,249,232,${alpha})`;
    ctx.lineWidth = size * (.006 + a * .008) * (1 - phase * .38);
    ctx.shadowColor = `rgba(255,255,255,${alpha * .7})`;
    ctx.shadowBlur = size * .018;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + drift * .4, y - rise * .28,
      x - drift * .7, y - rise * .72, x + drift, y - rise);
    ctx.stroke();
  }
  ctx.restore();
}

function getPotCache(w, h, skinId, contrast, dpr) {
  const key = renderCacheKey({ width: w, height: h }, skinId, '', contrast, dpr);
  if (potCache?.key !== key) {
    const { surface, surfaceContext } = makeOffscreenCanvas(w, h, dpr);
    drawTableAndPot(surfaceContext, w, h, skinId, contrast);
    potCache = { key, surface };
  }
  return potCache.surface;
}

function getBrothCache(w, h, broth, contrast, dpr) {
  const key = renderCacheKey({ width: w, height: h }, '', broth, contrast, dpr);
  if (brothCache?.key !== key) {
    const { surface, surfaceContext } = makeOffscreenCanvas(w, h, dpr);
    drawBrothBase(surfaceContext, w, h, broth, contrast);
    brothCache = { key, surface };
  }
  return brothCache.surface;
}

export function drawSoup(now = 0, simulationTimeMs = now) {
  const w = canvasWidth;
  const h = canvasHeight;
  if (!w || !h) return;
  const size = Math.min(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const dpr = ctx.canvas.width / w;
  const potSurface = getPotCache(w, h, selectedSkin, highContrast, dpr);
  const brothSurface = getBrothCache(w, h, brothId, highContrast, dpr);
  // The metal vessel is one cached image draw; the liquid has a separate static base.
  ctx.drawImage(potSurface, 0, 0, w, h);
  ctx.drawImage(brothSurface, 0, 0, w, h);

  const soupRx = size * POT_GEOMETRY.outerRadiusX * POT_GEOMETRY.soupRadiusX;
  const soupRy = size * POT_GEOMETRY.outerRadiusX * POT_GEOMETRY.outerRadiusY * POT_GEOMETRY.soupRadiusY;
  const heat = heatLevelAt(simulationTimeMs, BROTHS[brothId]);
  drawSurfaceMotion(now, brothId, heat, size, cx, cy, soupRx, soupRy);
  drawSteam(now, heat, size, cx, cy, soupRx, soupRy);
}

export function drawParticles(now = performance.now(), simulationNowMs = now) {
  const dpr = ctx.canvas.width / canvasWidth;
  // Oil sits on the surface, meat and vegetables catch the light above it.
  const drawWithFade = particle => {
    const chilled = particle.type === 'oil' && isOilChilled(now);
    const draw = progress => {
      const bob = particleBobOffset(particle, now, !reduceMotion);
      let offsetX = bob.x;
      let offsetY = bob.y;
      if (Number.isFinite(particle.spawnedAtMs) && !reduceMotion && progress < 1) {
        const dx = particle.x - canvasWidth / 2;
        const dy = particle.y - canvasHeight / 2;
        const distance = Math.hypot(dx, dy) || 1;
        const slide = Math.min(canvasWidth, canvasHeight) * POT_RADIUS_RATIO * .12 * (1 - progress);
        offsetX += dx / distance * slide;
        offsetY += dy / distance * slide;
      }
      ctx.save();
      ctx.translate(offsetX, offsetY);
      drawFoodSprite(ctx, particle, highContrast, dpr, chilled);
      ctx.restore();
    };
    if (!Number.isFinite(particle.spawnedAtMs)) {
      draw(1);
      return;
    }
    // Under reduce-motion the fade (opacity cue for the 0.6 s no-scoop protection) stays; only the slide-in is dropped.
    const progress = Math.max(0, Math.min(1, (simulationNowMs - particle.spawnedAtMs) / WAVE_FADE_IN_MS));
    ctx.save();
    ctx.globalAlpha *= progress;
    draw(progress);
    ctx.restore();
  };
  particleGroups.oil.forEach(drawWithFade);
  particleGroups.meat.forEach(drawWithFade);
  particleGroups.veg.forEach(drawWithFade);
  particleGroups.bone.forEach(drawWithFade);
  particleGroups.debris.forEach(drawWithFade);
  if (DEBUG_HIT_OVERLAY) drawParticleHitOverlay();
}

function drawRipple(effect, progress) {
  const radius = 8 + progress * 34;
  ctx.save();
  ctx.globalAlpha *= 1 - progress;
  ctx.strokeStyle = highContrast ? '#fff36b' : 'rgba(255,249,226,.9)';
  ctx.lineWidth = highContrast ? 2.5 : Math.max(1, 3 * (1 - progress));
  ctx.beginPath();
  ctx.ellipse(effect.x, effect.y, radius * 1.28, radius * .68, -.12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSplash(effect, progress) {
  const spread = 5 + progress * 24;
  const radius = Math.max(1, 3.2 * (1 - progress));
  ctx.save();
  ctx.globalAlpha *= 1 - progress;
  for (let index = 0; index < SPLASH_DIRECTIONS.length; index++) {
    const angle = SPLASH_DIRECTIONS[index];
    const x = effect.x + Math.cos(angle) * spread;
    const y = effect.y + Math.sin(angle) * spread + progress * progress * 9;
    ctx.fillStyle = highContrast ? '#fff36b' : (index % 2 ? '#fff8e2' : '#a8e5e8');
    ctx.beginPath();
    ctx.ellipse(x, y, radius * .72, radius * 1.2, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDrip(effect, progress) {
  ctx.save();
  ctx.globalAlpha *= 1 - progress;
  for (let index = 0; index < DRIP_OFFSETS.length; index++) {
    const offset = DRIP_OFFSETS[index];
    const x = effect.x + offset + Math.sin(progress * 3 + index) * 2;
    const y = effect.y + 5 + progress * 29 + index * 2;
    ctx.fillStyle = highContrast ? '#fff36b' : 'rgba(255,232,190,.88)';
    ctx.strokeStyle = highContrast ? '#000' : 'rgba(91,48,29,.8)';
    ctx.lineWidth = highContrast ? 1.25 : .8;
    ctx.beginPath();
    ctx.ellipse(x, y, 1.7, 3.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawFloatingScore(effect, progress) {
  const moving = !reduceMotion && !effect.static;
  const y = effect.y - 12 - (moving ? progress * 40 : 0);
  const alpha = moving ? 1 - progress : 1;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 17px sans-serif';
  ctx.lineWidth = highContrast ? 4.5 : 3.5;
  ctx.strokeStyle = highContrast ? '#000' : 'rgba(48,28,18,.92)';
  ctx.fillStyle = highContrast ? '#fff36b' : '#fff8e7';
  const amount = `+${effect.amount}`;
  ctx.strokeText(amount, effect.x, y);
  ctx.fillText(amount, effect.x, y);
  if (effect.comboText) {
    ctx.font = '700 11px sans-serif';
    ctx.strokeText(effect.comboText, effect.x, y + 17);
    ctx.fillText(effect.comboText, effect.x, y + 17);
  }
  ctx.restore();
}

export function drawVisualEffects(now = performance.now()) {
  pruneVisualEffects(visualEffects, now);
  for (const effect of visualEffects) {
    if (reduceMotion && effect.kind !== 'score') continue;
    const progress = visualEffectProgress(effect, now);
    if (effect.kind === 'ripple') drawRipple(effect, progress);
    else if (effect.kind === 'splash') drawSplash(effect, progress);
    else if (effect.kind === 'drip') drawDrip(effect, progress);
    else if (effect.kind === 'score') drawFloatingScore(effect, progress);
  }
}

function drawParticleHitOverlay() {
  ctx.save();
  ctx.strokeStyle = '#35ffe1';
  ctx.lineWidth = 1.25;
  ctx.setLineDash([3, 2]);
  for (const group of Object.values(particleGroups)) {
    for (const particle of group) {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, Math.max(0, particle.r), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawTool() {
  const potRadius = Math.min(canvasWidth, canvasHeight) * POT_GEOMETRY.outerRadiusX;
  if (!TOOL_SHAPES[currentTool]) return;
  const shape = scaledToolShape(currentTool, potRadius);
  if (!shape) return;
  ctx.save();
  ctx.translate(mouse.x, mouse.y);
  ctx.strokeStyle = 'rgba(255,248,226,.92)';
  ctx.fillStyle = 'rgba(255,238,201,.16)';
  ctx.lineWidth = shape.lineWidth;
  ctx.shadowColor = 'rgba(32,21,14,.6)';
  ctx.shadowBlur = 5;

  if (currentTool === 'spoon') {
    ctx.beginPath();
    ctx.ellipse(0, 0, shape.radiusX, shape.radiusY, shape.rotation, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, shape.handleStart);
    ctx.lineTo(0, shape.handleEnd);
    ctx.stroke();
  } else if (currentTool === 'holey') {
    ctx.beginPath();
    ctx.ellipse(0, 0, shape.radiusX, shape.radiusY, shape.rotation, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,248,226,.68)';
    for (const [x, y] of shape.holes) {
      ctx.beginPath();
      ctx.arc(x, y, shape.holeRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, shape.handleStart);
    ctx.lineTo(0, shape.handleEnd);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, shape.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,248,226,.7)';
    for (const [x1, y1, x2, y2] of shape.mesh) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, shape.handleStart);
    ctx.lineTo(0, shape.handleEnd);
    ctx.stroke();
  }
  if (DEBUG_HIT_OVERLAY) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#4fffe4';
    ctx.lineWidth = shape.lineWidth;
    ctx.setLineDash([shape.lineWidth * 2, shape.lineWidth * 1.5]);
    ctx.beginPath();
    if (shape.type === 'circle') ctx.arc(0, 0, shape.radius, 0, Math.PI * 2);
    else ctx.ellipse(0, 0, shape.radiusX, shape.radiusY, shape.rotation, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}
