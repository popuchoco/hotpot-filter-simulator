import { visualNoise } from './rendering.js';

export const FOOD_SPRITE_TYPES = Object.freeze(['meat', 'veg', 'bone', 'oil', 'chili', 'miso']);
export const FOOD_SPRITE_RADIUS_QUANTUM = .5;
const MAX_CACHED_FOOD_SPRITES = 384;
const TAU = Math.PI * 2;
const spriteCache = new Map();

const VEGETABLE_PALETTES = Object.freeze({
  芋頭: Object.freeze({ skin: '#6f5a4a', edge: '#b79a83', face: '#d9c8b8', light: '#f2e6dc', shadow: '#978072' }),
  南瓜: Object.freeze({ skin: '#436b32', edge: '#b9511d', face: '#ef8a24', light: '#ffd16a', shadow: '#a13c19' }),
  番茄: Object.freeze({ skin: '#75221e', edge: '#bf332b', face: '#e85849', light: '#ff9a76', shadow: '#9e2625' }),
  馬鈴薯: Object.freeze({ skin: '#70502d', edge: '#c18a48', face: '#e8c47b', light: '#fff0b8', shadow: '#a56b37' })
});

const PALETTE = Object.freeze({
  meat: Object.freeze({ edge: '#47251f', base: '#8f4638', light: '#c77b62', dark: '#5d302a', fat: '#f0c6a0' }),
  meatContrast: Object.freeze({ edge: '#fff', base: '#bd2531', light: '#ff8068', dark: '#681522', fat: '#ffe4a8' }),
  oil: Object.freeze({ edge: '#8b6a35', base: '#dfb65d', light: '#fff4c6', dark: '#7ca5a2', rim: '#caf5ea' }),
  oilContrast: Object.freeze({ edge: '#00364a', base: '#8ef4e8', light: '#fff', dark: '#1686a3', rim: '#00ffff' }),
  oilChilled: Object.freeze({ edge: '#326f82', base: '#9de7ed', light: '#fff', dark: '#3c9bb0', rim: '#d8ffff' }),
  oilChilledContrast: Object.freeze({ edge: '#001d32', base: '#00d5ff', light: '#fff', dark: '#006aab', rim: '#fff36b' }),
  bone: Object.freeze({ edge: '#69503c', base: '#d9ccb1', light: '#fff6df', dark: '#b1a184', marrow: '#523727' }),
  boneContrast: Object.freeze({ edge: '#111', base: '#fff0a6', light: '#fff', dark: '#bf9e43', marrow: '#8c170c' }),
  chili: Object.freeze({ edge: '#561d17', base: '#a92d22', light: '#ed5b37', dark: '#671c1b', seed: '#f6d48c' }),
  chiliContrast: Object.freeze({ edge: '#fff36b', base: '#ff4a22', light: '#ff9d62', dark: '#931711', seed: '#fff3aa' }),
  miso: Object.freeze({ edge: '#554224', base: '#c4a968', light: '#f0dda4', dark: '#8d7041', grain: '#f5e8bd' }),
  misoContrast: Object.freeze({ edge: '#111', base: '#fff36b', light: '#fffbd2', dark: '#806300', grain: '#fff' })
});

export function quantizedFoodRadius(radius) {
  const safeRadius = Math.max(FOOD_SPRITE_RADIUS_QUANTUM, Number(radius) || 0);
  return Math.max(FOOD_SPRITE_RADIUS_QUANTUM,
    Math.round(safeRadius / FOOD_SPRITE_RADIUS_QUANTUM) * FOOD_SPRITE_RADIUS_QUANTUM);
}

export function foodSpriteBodyRadius(radius, quantizedRadius = quantizedFoodRadius(radius)) {
  const targetRadius = Math.max(0, Number(radius) || 0);
  const sourceRadius = Math.max(FOOD_SPRITE_RADIUS_QUANTUM, Number(quantizedRadius) || FOOD_SPRITE_RADIUS_QUANTUM);
  return sourceRadius * (targetRadius / sourceRadius);
}

export function foodSpriteVariant(particle) {
  if (particle.type === 'meat') return particle.shade > .5 ? 'marbled-dark' : 'marbled-light';
  if (particle.type === 'veg') return particle.name || '芋頭';
  if (particle.type === 'bone') return `integrity-${particle.integrity || 1}`;
  if (particle.type === 'oil') return 'lens';
  if (particle.type === 'debris') return particle.debrisKind === 'chili' ? 'chili-flake' : 'miso-dregs';
  return particle.type;
}

export function foodSpriteCacheKey(particle, highContrast, devicePixelRatio, chilled = false) {
  const type = particle.type === 'debris' ? particle.debrisKind : particle.type;
  return JSON.stringify([
    type,
    foodSpriteVariant(particle),
    quantizedFoodRadius(particle.r),
    Boolean(highContrast),
    devicePixelRatio,
    type === 'oil' && Boolean(chilled)
  ]);
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function noise(seed, index) {
  return visualNoise((seed + Math.imul(index + 1, 0x9e3779b9)) | 0);
}

function colorMix(ctx, x, y, radius, inner, outer) {
  const gradient = ctx.createRadialGradient(x, y, radius * .04, 0, 0, radius * 1.15);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(.66, inner);
  gradient.addColorStop(1, outer);
  return gradient;
}

function circle(ctx, radius) {
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
}

function drawBody(ctx, radius, edge, fill, contrast) {
  ctx.save();
  ctx.shadowColor = contrast ? 'rgba(0,0,0,.65)' : 'rgba(28,14,8,.48)';
  ctx.shadowBlur = Math.max(1.5, radius * .22);
  ctx.fillStyle = edge;
  circle(ctx, radius);
  ctx.fill();
  ctx.restore();

  ctx.save();
  circle(ctx, radius);
  ctx.clip();
  ctx.fillStyle = edge;
  circle(ctx, radius);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = fill;
  circle(ctx, radius * .94);
  ctx.fill();
  ctx.restore();
}

function drawOuterRing(ctx, radius, color, contrast = false) {
  const lineWidth = Math.max(.7, radius * (contrast ? .095 : .065));
  ctx.beginPath();
  ctx.arc(0, 0, radius - lineWidth / 2, 0, TAU);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawMeat(ctx, radius, contrast, variant, seed) {
  const palette = contrast ? PALETTE.meatContrast : PALETTE.meat;
  const fill = colorMix(ctx, -radius * .32, -radius * .38, radius, palette.light, palette.base);
  drawBody(ctx, radius, palette.edge, fill, contrast);
  ctx.save();
  circle(ctx, radius * .91);
  ctx.clip();
  const pieces = 4;
  for (let i = 0; i < pieces; i++) {
    const angle = noise(seed, i) * TAU;
    const distance = radius * (.1 + noise(seed, i + 11) * .37);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    const rx = radius * (.2 + noise(seed, i + 21) * .17);
    const ry = radius * (.08 + noise(seed, i + 31) * .1);
    ctx.fillStyle = i % 2 ? palette.dark : palette.base;
    ctx.beginPath();
    for (let point = 0; point < 8; point++) {
      const pointAngle = point / 8 * TAU;
      const irregularity = .72 + noise(seed, i * 13 + point + 81) * .54;
      const px = x + Math.cos(pointAngle + angle) * rx * irregularity;
      const py = y + Math.sin(pointAngle + angle) * ry * irregularity;
      if (point === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = palette.fat;
    ctx.lineWidth = Math.max(.45, radius * .025);
    ctx.beginPath();
    ctx.ellipse(x - rx * .08, y - ry * .1, rx * .66, ry * .24, angle + .45, Math.PI * .08, Math.PI * .86);
    ctx.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const angle = noise(seed, i + 41) * TAU;
    const distance = radius * Math.sqrt(noise(seed, i + 51)) * .78;
    ctx.fillStyle = i % 3 === 0 ? palette.fat : palette.dark;
    ctx.globalAlpha = i % 3 === 0 ? .62 : .38;
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * distance, Math.sin(angle) * distance,
      Math.max(.35, radius * (.018 + noise(seed, i + 61) * .035)),
      Math.max(.3, radius * .018), angle, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  drawOuterRing(ctx, radius, palette.edge, contrast);
  ctx.strokeStyle = contrast ? '#fff' : 'rgba(255,225,195,.55)';
  ctx.lineWidth = Math.max(.6, radius * .045);
  ctx.beginPath();
  ctx.arc(-radius * .04, -radius * .04, radius * .78, Math.PI * 1.18, Math.PI * 1.76);
  ctx.stroke();
  if (variant === 'marbled-dark') {
    ctx.fillStyle = contrast ? '#ffb071' : 'rgba(255,218,182,.7)';
    ctx.beginPath();
    ctx.ellipse(radius * .37, -radius * .2, radius * .13, radius * .055, -.4, 0, TAU);
    ctx.fill();
  }
}

function drawVegetable(ctx, radius, contrast, name, seed) {
  const palette = VEGETABLE_PALETTES[name] || VEGETABLE_PALETTES.芋頭;
  const edge = contrast ? '#14100c' : palette.skin;
  const fill = colorMix(ctx, -radius * .3, -radius * .36, radius, palette.light, palette.edge);
  drawBody(ctx, radius, edge, fill, contrast);
  ctx.save();
  circle(ctx, radius * .86);
  ctx.clip();
  const cut = colorMix(ctx, -radius * .27, -radius * .34, radius, palette.light, palette.face);
  ctx.fillStyle = cut;
  ctx.beginPath();
  ctx.arc(0, 0, radius * .83, 0, TAU);
  ctx.fill();

  if (name === '南瓜') {
    ctx.strokeStyle = contrast ? '#18100b' : 'rgba(109,43,17,.54)';
    ctx.lineWidth = Math.max(.6, radius * .045);
    for (const offset of [-.38, -.18, .18, .38]) {
      ctx.beginPath();
      ctx.ellipse(offset * radius, 0, radius * .1, radius * .68, offset * .23, -1.16, 1.16);
      ctx.stroke();
    }
    ctx.fillStyle = contrast ? '#367a25' : '#527537';
    ctx.beginPath();
    ctx.ellipse(0, -radius * .69, radius * .12, radius * .1, 0, 0, TAU);
    ctx.fill();
  } else if (name === '番茄') {
    ctx.fillStyle = contrast ? '#fff0a8' : 'rgba(255,238,188,.9)';
    for (let i = 0; i < 5; i++) {
      const angle = i * TAU / 5 - Math.PI / 2;
      const x = Math.cos(angle) * radius * .34;
      const y = Math.sin(angle) * radius * .34;
      ctx.beginPath();
      ctx.ellipse(x, y, radius * .085, radius * .15, angle, 0, TAU);
      ctx.fill();
      ctx.fillStyle = contrast ? '#5d1c17' : '#7c2b22';
      for (let seedIndex = 0; seedIndex < 3; seedIndex++) {
        ctx.beginPath();
        ctx.ellipse(x + (seedIndex - 1) * radius * .035, y, radius * .018, radius * .035, 0, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = contrast ? '#fff0a8' : 'rgba(255,238,188,.9)';
    }
  } else {
    const fleckColor = contrast ? '#5b351c' : palette.shadow;
    for (let i = 0; i < 12; i++) {
      const angle = noise(seed, i) * TAU;
      const distance = radius * (.2 + noise(seed, i + 14) * .5);
      ctx.fillStyle = fleckColor;
      ctx.globalAlpha = .28 + noise(seed, i + 28) * .35;
      ctx.beginPath();
      ctx.ellipse(Math.cos(angle) * distance, Math.sin(angle) * distance,
        radius * (.025 + noise(seed, i + 35) * .035), radius * .018, angle, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  drawOuterRing(ctx, radius, contrast ? '#111' : palette.skin, contrast);
  ctx.strokeStyle = contrast ? '#fff8dc' : 'rgba(255,250,223,.8)';
  ctx.lineWidth = Math.max(.65, radius * .04);
  ctx.beginPath();
  ctx.arc(-radius * .05, -radius * .04, radius * .69, Math.PI * 1.1, Math.PI * 1.72);
  ctx.stroke();
}

function drawBone(ctx, radius, contrast, integrity) {
  const palette = contrast ? PALETTE.boneContrast : PALETTE.bone;
  const fill = colorMix(ctx, -radius * .25, -radius * .3, radius, palette.light, palette.base);
  drawBody(ctx, radius, palette.edge, fill, contrast);
  ctx.save();
  circle(ctx, radius * .91);
  ctx.clip();
  ctx.fillStyle = palette.dark;
  ctx.beginPath();
  ctx.ellipse(0, radius * .12, radius * .48, radius * .25, -.16, 0, TAU);
  ctx.fill();
  ctx.fillStyle = palette.light;
  ctx.beginPath();
  ctx.ellipse(-radius * .035, radius * .08, radius * .39, radius * .18, -.16, 0, TAU);
  ctx.fill();
  ctx.fillStyle = palette.marrow;
  ctx.beginPath();
  ctx.ellipse(radius * .05, radius * .06, radius * .13, radius * .085, -.16, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = contrast ? '#46130c' : '#896b4b';
  ctx.lineWidth = Math.max(.7, radius * .04);
  ctx.beginPath();
  ctx.arc(0, radius * .12, radius * .48, Math.PI * 1.08, Math.PI * 1.9);
  ctx.stroke();
  if (integrity <= 1) {
    ctx.strokeStyle = contrast ? '#c90000' : '#744232';
    ctx.lineWidth = Math.max(1.2, radius * .09);
    ctx.beginPath();
    ctx.moveTo(-radius * .48, -radius * .42);
    ctx.lineTo(-radius * .19, -radius * .17);
    ctx.lineTo(-radius * .31, radius * .08);
    ctx.lineTo(-radius * .04, radius * .25);
    ctx.stroke();
  }
  ctx.restore();
  drawOuterRing(ctx, radius, palette.edge, contrast);
  ctx.fillStyle = palette.light;
  ctx.beginPath();
  ctx.ellipse(-radius * .28, -radius * .32, radius * .12, radius * .055, -.5, 0, TAU);
  ctx.fill();
}

function drawChili(ctx, radius, contrast, seed) {
  const palette = contrast ? PALETTE.chiliContrast : PALETTE.chili;
  const fill = colorMix(ctx, -radius * .22, -radius * .28, radius, palette.light, palette.base);
  drawBody(ctx, radius, palette.edge, fill, contrast);
  ctx.save();
  circle(ctx, radius * .9);
  ctx.clip();
  for (let i = 0; i < 3; i++) {
    const angle = noise(seed, i) * .45 - .22;
    const offset = (i - 1) * radius * .15;
    ctx.fillStyle = i === 1 ? palette.base : palette.dark;
    ctx.beginPath();
    ctx.ellipse(offset, 0, radius * (.64 - Math.abs(i - 1) * .13), radius * .23, angle, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = palette.light;
    ctx.lineWidth = Math.max(.55, radius * .05);
    ctx.beginPath();
    ctx.ellipse(offset, -radius * .025, radius * .48, radius * .075, angle, Math.PI * 1.08, Math.PI * 1.85);
    ctx.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const angle = noise(seed, i + 17) * TAU;
    const distance = radius * (.12 + noise(seed, i + 27) * .35);
    ctx.fillStyle = palette.seed;
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * distance, Math.sin(angle) * distance,
      radius * .07, radius * .035, angle, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  drawOuterRing(ctx, radius, palette.edge, contrast);
}

function drawMiso(ctx, radius, contrast, seed) {
  const palette = contrast ? PALETTE.misoContrast : PALETTE.miso;
  const fill = colorMix(ctx, -radius * .27, -radius * .33, radius, palette.light, palette.base);
  drawBody(ctx, radius, palette.edge, fill, contrast);
  ctx.save();
  circle(ctx, radius * .9);
  ctx.clip();
  const clusters = [[-.32, -.18], [.18, -.33], [.36, .12], [-.18, .34], [-.42, .25], [.04, .08]];
  clusters.forEach(([x, y], i) => {
    const cx = radius * (x + (noise(seed, i) - .5) * .15);
    const cy = radius * (y + (noise(seed, i + 9) - .5) * .15);
    const clusterR = radius * (.18 + noise(seed, i + 19) * .08);
    ctx.fillStyle = i % 2 ? palette.base : palette.light;
    ctx.beginPath();
    ctx.arc(cx, cy, clusterR, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = contrast ? '#241b0e' : 'rgba(86,66,43,.78)';
    ctx.lineWidth = Math.max(.55, radius * .045);
    ctx.stroke();
  });
  for (let i = 0; i < 24; i++) {
    const angle = noise(seed, i + 32) * TAU;
    const distance = radius * Math.sqrt(noise(seed, i + 48)) * .76;
    const size = radius * (.025 + noise(seed, i + 64) * .035);
    ctx.fillStyle = i % 3 ? palette.dark : palette.grain;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance, size, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  drawOuterRing(ctx, radius, contrast ? '#111' : palette.edge, contrast);
}

function drawOil(ctx, radius, contrast, chilled) {
  const palette = chilled
    ? (contrast ? PALETTE.oilChilledContrast : PALETTE.oilChilled)
    : (contrast ? PALETTE.oilContrast : PALETTE.oil);
  const fill = colorMix(ctx, -radius * .34, -radius * .4, radius,
    chilled ? 'rgba(255,255,255,.97)' : 'rgba(255,248,206,.91)',
    chilled ? 'rgba(38,142,165,.82)' : 'rgba(111,146,130,.66)');
  drawBody(ctx, radius, palette.edge, fill, contrast);
  ctx.save();
  circle(ctx, radius * .91);
  ctx.clip();
  ctx.strokeStyle = palette.rim;
  ctx.lineWidth = Math.max(.65, radius * .075);
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * .77, radius * .7, -.15, Math.PI * 1.04, Math.PI * 1.91);
  ctx.stroke();
  ctx.fillStyle = chilled ? 'rgba(215,255,255,.54)' : 'rgba(255,255,255,.3)';
  ctx.beginPath();
  ctx.ellipse(radius * .17, radius * .19, radius * .43, radius * .3, .2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = palette.light;
  ctx.lineWidth = Math.max(.8, radius * .09);
  ctx.beginPath();
  ctx.ellipse(-radius * .1, -radius * .2, radius * .49, radius * .22, -.3, Math.PI * 1.05, Math.PI * 1.88);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(-radius * .28, -radius * .29, radius * .13, radius * .065, -.35, 0, TAU);
  ctx.fill();
  if (chilled) {
    ctx.strokeStyle = palette.rim;
    ctx.lineWidth = Math.max(.7, radius * .055);
    for (const angle of [-.8, .55, 2.6]) {
      const x = Math.cos(angle) * radius * .76;
      const y = Math.sin(angle) * radius * .76;
      ctx.beginPath();
      ctx.moveTo(x - radius * .07, y - radius * .05);
      ctx.lineTo(x + radius * .07, y + radius * .05);
      ctx.stroke();
    }
  }
  ctx.restore();
  drawOuterRing(ctx, radius, palette.edge, contrast);
}

function createFoodSprite(particle, quantizedRadius, highContrast, dpr, chilled) {
  const bodyRadius = quantizedRadius;
  const padding = Math.max(3, bodyRadius * .38);
  const extent = bodyRadius + padding;
  const surface = document.createElement('canvas');
  surface.width = Math.max(1, Math.ceil(extent * 2 * dpr));
  surface.height = Math.max(1, Math.ceil(extent * 2 * dpr));
  const context = surface.getContext('2d');
  context.setTransform(dpr, 0, 0, dpr, extent * dpr, extent * dpr);
  const seed = hashString(`${particle.type}:${foodSpriteVariant(particle)}:${quantizedRadius}`);

  switch (particle.type === 'debris' ? particle.debrisKind : particle.type) {
    case 'meat': drawMeat(context, bodyRadius, highContrast, foodSpriteVariant(particle), seed); break;
    case 'veg': drawVegetable(context, bodyRadius, highContrast, particle.name, seed); break;
    case 'bone': drawBone(context, bodyRadius, highContrast, particle.integrity || 1); break;
    case 'oil': drawOil(context, bodyRadius, highContrast, chilled); break;
    case 'chili': drawChili(context, bodyRadius, highContrast, seed); break;
    case 'miso': drawMiso(context, bodyRadius, highContrast, seed); break;
    default: drawMeat(context, bodyRadius, highContrast, 'marbled-light', seed);
  }
  return { surface, bodyRadius, extent };
}

function getFoodSprite(particle, highContrast, dpr, chilled) {
  const key = foodSpriteCacheKey(particle, highContrast, dpr, chilled);
  if (spriteCache.has(key)) {
    const sprite = spriteCache.get(key);
    spriteCache.delete(key);
    spriteCache.set(key, sprite);
    return sprite;
  }
  const sprite = createFoodSprite(particle, quantizedFoodRadius(particle.r), highContrast, dpr, chilled);
  spriteCache.set(key, sprite);
  if (spriteCache.size > MAX_CACHED_FOOD_SPRITES) spriteCache.delete(spriteCache.keys().next().value);
  return sprite;
}

export function drawFoodSprite(target, particle, highContrast, dpr, chilled = false) {
  const radius = Math.max(0, Number(particle.r) || 0);
  if (!radius) return;
  const sprite = getFoodSprite(particle, highContrast, dpr, chilled);
  const scale = radius / sprite.bodyRadius;
  const extent = sprite.extent * scale;
  target.save();
  target.translate(particle.x, particle.y);
  target.rotate(particle.rotation || 0);
  target.drawImage(sprite.surface, -extent, -extent, extent * 2, extent * 2);
  target.restore();
  if (particle.type === 'bone') drawBoneIntegrityBadge(target, particle, highContrast);
}

// Remaining-scoops badge (kept from the pre-S7 renderer): drawn upright so the number stays readable.
function drawBoneIntegrityBadge(target, particle, highContrast) {
  const r = particle.r;
  const integrity = particle.integrity || 1;
  const x = particle.x + r * .62;
  const y = particle.y - r * .62;
  target.save();
  target.fillStyle = integrity === 1 ? (highContrast ? '#c90000' : '#744232') : '#4b3928';
  target.beginPath();
  target.arc(x, y, r * .25, 0, TAU);
  target.fill();
  target.fillStyle = '#fffaf0';
  target.font = `bold ${Math.max(10, r * .3)}px sans-serif`;
  target.textAlign = 'center';
  target.textBaseline = 'middle';
  target.fillText(String(integrity), x, y);
  target.restore();
}
