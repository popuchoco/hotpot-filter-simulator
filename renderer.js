// Canvas rendering functions. Depends on game.js globals: ctx/canvas dimensions,
// particles/particleGroups, mouse, brothId/BROTHS, boilingNow, reduceMotion,
// highContrast, selectedSkin/POT_SKINS, currentTool/TOOL_CONFIG, and isOilChilled().
const POT_GEOMETRY = Object.freeze({
  outerRadiusX: .42,
  outerRadiusY: .93,
  basinInset: .925,
  soupRadiusX: .875,
  soupRadiusY: .855
});
const RENDER_DETAILS = Object.freeze({
  simmerBubbleCount: 8,
  flowRingCount: 3,
  tomatoPetalCount: 10,
  simmer: Object.freeze({
    phaseRateBase: .35, phaseRateStep: .015, phaseOffsetStep: 1.7,
    xBase: .2, xStep: .19, xPattern: 3,
    yBase: .16, yStep: .14, yPattern: 4,
    radiusBase: 1.4, radiusStep: 1.1
  })
});
const VEGETABLE_SHAPES = Object.freeze({
  pumpkin: Object.freeze({ radiusX: 1.03, radiusY: .8 }),
  tomato: Object.freeze({ innerRadius: .78, verticalScale: .85 }),
  default: Object.freeze({ radiusX: .94, radiusY: .78, rotation: .14 })
});
const POT_BODY_GRADIENT_OFFSETS = Object.freeze([0, .06, .14, .24, .29, .76, .93, 1]);
const GRADIENT_STOPS = Object.freeze({
  rim: Object.freeze([[0, '#f9f4e8'], [.12, '#5e5a52'], [.29, '#ded7c8'], [.46, '#58544c'], [.7, '#f1e8d7'], [1, '#504c44']]),
  interior: Object.freeze([[0, '#f9f5e8'], [.12, '#59564f'], [.28, '#d5cdbb'], [.42, '#777164'], [.65, '#282724'], [1, '#131312']]),
  broth: Object.freeze([0, .36, .72, 1])
});

function drawHandle(cx, cy, rx, ry, side) {
  const hx = cx + side * rx * 1.06;
  const hy = cy + ry * 0.04;
  const metal = ctx.createLinearGradient(hx - rx * 0.12, hy - ry * 0.08, hx + rx * 0.12, hy + ry * 0.1);
  metal.addColorStop(0, '#554f45');
  metal.addColorStop(0.25, '#f1e9d8');
  metal.addColorStop(0.52, '#888176');
  metal.addColorStop(0.78, '#ded5c3');
  metal.addColorStop(1, '#36332e');

  ctx.save();
  ctx.strokeStyle = '#171613';
  ctx.lineWidth = Math.max(7, rx * 0.045);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + side * rx * 0.82, hy);
  ctx.lineTo(cx + side * rx * 1.04, hy);
  ctx.stroke();
  ctx.strokeStyle = metal;
  ctx.lineWidth = Math.max(4, rx * 0.024);
  ctx.beginPath();
  ctx.ellipse(hx, hy, rx * 0.13, ry * 0.085, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + side * rx * 0.84, hy - ry * 0.012);
  ctx.lineTo(cx + side * rx * 1.04, hy - ry * 0.012);
  ctx.stroke();
  ctx.restore();
}

function drawSoup(now = 0) {
  const w = canvasWidth;
  const h = canvasHeight;
  if (!w || !h) return;
  const cx = w / 2;
  const cy = h / 2;
  const size = Math.min(w, h);
  const rx = size * POT_GEOMETRY.outerRadiusX;
  const ry = rx * POT_GEOMETRY.outerRadiusY;

  const backdrop = ctx.createRadialGradient(cx, cy, size * 0.1, cx, cy, size * 0.72);
  backdrop.addColorStop(0, '#3e3329');
  backdrop.addColorStop(0.72, '#221c18');
  backdrop.addColorStop(1, '#171411');
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, w, h);

  drawHandle(cx, cy, rx, ry, -1);
  drawHandle(cx, cy, rx, ry, 1);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.72)';
  ctx.shadowBlur = size * 0.055;
  ctx.shadowOffsetY = size * 0.035;
  const potBody = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx * 0.45, cy + ry);
  const potStops = POT_SKINS[selectedSkin].outer;
  POT_BODY_GRADIENT_OFFSETS.forEach((offset, index) => potBody.addColorStop(offset, potStops[index]));
  ctx.fillStyle = potBody;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const rimGradient = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
  GRADIENT_STOPS.rim.forEach(([offset, color]) => rimGradient.addColorStop(offset, color));
  ctx.strokeStyle = 'rgba(10,9,8,.8)';
  ctx.lineWidth = Math.max(8, size * 0.022);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.985, ry * 0.985, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = rimGradient;
  ctx.lineWidth = Math.max(3, size * 0.009);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.97, ry * 0.97, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,249,228,.67)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.932, ry * 0.932, 0, 0, Math.PI * 2);
  ctx.stroke();

  const basinX = rx * POT_GEOMETRY.basinInset;
  const basinY = ry * POT_GEOMETRY.basinInset;
  const inside = ctx.createRadialGradient(cx - rx * 0.24, cy - ry * 0.27, size * 0.04, cx, cy, rx * 1.03);
  GRADIENT_STOPS.interior.forEach(([offset, color]) => inside.addColorStop(offset, color));
  ctx.fillStyle = inside;
  ctx.beginPath();
  ctx.ellipse(cx, cy, basinX, basinY, 0, 0, Math.PI * 2);
  ctx.fill();

  const soupRx = rx * POT_GEOMETRY.soupRadiusX;
  const soupRy = ry * POT_GEOMETRY.soupRadiusY;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, soupRx, soupRy, 0, 0, Math.PI * 2);
  ctx.clip();

  const broth = ctx.createRadialGradient(cx - soupRx * 0.28, cy - soupRy * 0.39, size * 0.04, cx, cy, soupRx * 1.25);
  const brothColors = BROTHS[brothId].colors;
  GRADIENT_STOPS.broth.forEach((offset, index) => broth.addColorStop(offset, brothColors[index]));
  ctx.fillStyle = broth;
  ctx.fillRect(cx - soupRx, cy - soupRy, soupRx * 2, soupRy * 2);

  const warmShadow = ctx.createRadialGradient(cx, cy + soupRy * 0.54, 0, cx, cy + soupRy * 0.54, soupRx * 0.95);
  warmShadow.addColorStop(0, 'rgba(112,61,29,.2)');
  warmShadow.addColorStop(1, 'rgba(112,61,29,0)');
  ctx.fillStyle = warmShadow;
  ctx.fillRect(cx - soupRx, cy - soupRy, soupRx * 2, soupRy * 2);

  // A few slow surface rings and bubbles give the broth a gentle simmer.
  const t = (reduceMotion ? 0 : now) / 1000;
  const simmer = RENDER_DETAILS.simmer;
  for (let i = 0; i < (reduceMotion ? 0 : RENDER_DETAILS.simmerBubbleCount); i++) {
    const phase = t * (simmer.phaseRateBase + i * simmer.phaseRateStep) + i * simmer.phaseOffsetStep;
    const bx = cx + Math.sin(phase) * soupRx * (simmer.xBase + (i % simmer.xPattern) * simmer.xStep);
    const by = cy + Math.cos(phase * 0.83) * soupRy * (simmer.yBase + (i % simmer.yPattern) * simmer.yStep);
    const br = simmer.radiusBase + (i % simmer.xPattern) * simmer.radiusStep;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,246,221,.24)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(143,91,48,.27)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,240,.3)';
  ctx.lineWidth = Math.max(4, size * .016);
  ctx.beginPath();
  ctx.ellipse(cx - soupRx * .16, cy - soupRy * .76, soupRx * .47, soupRy * .1, -.08, Math.PI * 1.02, Math.PI * 1.88);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,244,219,.12)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, soupRx * .91, soupRy * .88, .06, .1, Math.PI * .88);
  ctx.stroke();
  if (boilingNow && !reduceMotion) {
    ctx.save();
    ctx.strokeStyle = BROTHS[brothId].flowColor;
    ctx.lineWidth = Math.max(2, size * .006);
    ctx.setLineDash([size * .025, size * .035]);
    for (let i = 0; i < RENDER_DETAILS.flowRingCount; i++) {
      ctx.beginPath();
      ctx.ellipse(cx + Math.sin(t + i) * soupRx * .18, cy + Math.cos(t * .8 + i) * soupRy * .12,
        soupRx * (.36 + i * .12), soupRy * (.24 + i * .08), t * .08, t * .4 + i, t * .4 + i + Math.PI * 1.25);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();

  // Fine double highlight on the rolled rim.
  ctx.strokeStyle = 'rgba(255,251,234,.62)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * .957, ry * .957, 0, Math.PI * 1.08, Math.PI * 1.88);
  ctx.stroke();
}

function isOilChilled(now = performance.now()) {
  return chillUsed && now < chilledUntil;
}

function drawOil(p, now = performance.now()) {
  const r = p.r;
  const chilled = isOilChilled(now);
  const shimmer = reduceMotion ? 0 : Math.sin(now / 420 + p.shimmer) * .22;
  ctx.save();
  ctx.shadowColor = chilled && highContrast ? 'rgba(0,0,0,.98)' : chilled ? 'rgba(136,225,245,.48)' : 'rgba(115,69,27,.2)';
  ctx.shadowBlur = Math.max(2, r * .28);
  const oil = ctx.createRadialGradient(p.x - r * .3, p.y - r * .34, r * .06, p.x, p.y, r * 1.08);
  oil.addColorStop(0, chilled ? 'rgba(255,255,235,.98)' : 'rgba(255,245,197,.93)');
  oil.addColorStop(.34, chilled ? 'rgba(206,247,249,.92)' : 'rgba(246,210,130,.78)');
  oil.addColorStop(.78, chilled ? 'rgba(133,208,222,.83)' : 'rgba(229,177,91,.62)');
  oil.addColorStop(1, chilled ? 'rgba(81,157,177,.65)' : 'rgba(190,133,57,.46)');
  ctx.fillStyle = oil;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r * 1.13, r * .9, p.shimmer || 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = chilled && highContrast ? '#00ffff' : chilled ? 'rgba(219,255,255,.95)' : 'rgba(255,248,215,.72)';
  ctx.lineWidth = chilled && highContrast ? Math.max(2.4, r * .18) : Math.max(1, r * .08);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(p.x - r * .15 + shimmer * r, p.y - r * (.27 + shimmer * .18), r * (.4 + shimmer * .12), r * .18, -.22, Math.PI * 1.08, Math.PI * 1.86);
  ctx.strokeStyle = highContrast ? '#fff' : `rgba(255,255,239,${.55 + Math.abs(shimmer)})`;
  ctx.lineWidth = Math.max(1, r * .1);
  ctx.stroke();
  if (chilled) {
    ctx.strokeStyle = highContrast ? '#fff36b' : 'rgba(222,255,255,.8)';
    ctx.lineWidth = highContrast ? Math.max(2, r * .16) : Math.max(1, r * .12);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * 1.3, r * 1.08, p.shimmer || 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMeat(p) {
  const r = p.r;
  const meat = ctx.createRadialGradient(p.x - r * .34, p.y - r * .42, .2, p.x, p.y, r * 1.2);
  meat.addColorStop(0, '#b7775b');
  meat.addColorStop(.5, p.shade > .5 ? '#88503d' : '#9b5d43');
  meat.addColorStop(1, '#56352b');
  ctx.fillStyle = meat;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r * 1.15, r * .88, p.shade || 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = highContrast ? '#fff' : 'rgba(255,211,169,.34)';
  ctx.lineWidth = highContrast ? 1.8 : .8;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,226,190,.37)';
  ctx.beginPath();
  ctx.arc(p.x - r * .28, p.y - r * .24, Math.max(.7, r * .16), 0, Math.PI * 2);
  ctx.fill();
}

function drawVegetable(p) {
  const r = p.r;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation || 0);
  ctx.shadowColor = 'rgba(80,43,20,.35)';
  ctx.shadowBlur = 4;
  const veg = ctx.createRadialGradient(-r * .32, -r * .4, r * .04, 0, 0, r * 1.25);
  veg.addColorStop(0, '#fff0c9');
  veg.addColorStop(.2, p.color);
  veg.addColorStop(.8, p.color);
  veg.addColorStop(1, 'rgba(86,50,28,.8)');
  ctx.fillStyle = veg;
  ctx.beginPath();
  if (p.name === '南瓜') {
    ctx.ellipse(0, 0, r * VEGETABLE_SHAPES.pumpkin.radiusX, r * VEGETABLE_SHAPES.pumpkin.radiusY, 0, 0, Math.PI * 2);
  } else if (p.name === '番茄') {
    for (let i = 0; i < RENDER_DETAILS.tomatoPetalCount; i++) {
      const a = i / RENDER_DETAILS.tomatoPetalCount * Math.PI * 2;
      const radius = i % 2 ? r * VEGETABLE_SHAPES.tomato.innerRadius : r;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius * VEGETABLE_SHAPES.tomato.verticalScale;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else {
    const shape = VEGETABLE_SHAPES.default;
    ctx.ellipse(0, 0, r * shape.radiusX, r * shape.radiusY, shape.rotation, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = highContrast ? '#fff' : 'rgba(255,241,210,.58)';
  ctx.lineWidth = highContrast ? 2 : 1.2;
  ctx.stroke();
  if (p.name === '南瓜') {
    ctx.strokeStyle = 'rgba(117,61,28,.32)';
    ctx.lineWidth = 1.1;
    for (const offset of [-.35, 0, .35]) {
      ctx.beginPath();
      ctx.ellipse(offset * r, 0, r * .19, r * .72, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBone(p) {
  const r = p.r;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation || 0);
  ctx.shadowColor = 'rgba(55,35,20,.5)';
  ctx.shadowBlur = 5;
  ctx.fillStyle = p.integrity > 1 ? '#e8dfc8' : highContrast ? '#fff0a6' : '#cfc3a6';
  ctx.strokeStyle = highContrast ? '#16110d' : 'rgba(82,59,39,.7)';
  ctx.lineWidth = highContrast ? 2.5 : 1.2;
  ctx.beginPath();
  ctx.roundRect(-r * .58, -r * .2, r * 1.16, r * .4, r * .18);
  ctx.fill();
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * r * .55, -r * .16, r * .27, 0, Math.PI * 2);
    ctx.arc(side * r * .55, r * .16, r * .27, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (p.integrity === 1) {
    ctx.strokeStyle = highContrast ? '#c90000' : '#744232';
    ctx.lineWidth = highContrast ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(-r * .12, -r * .2);
    ctx.lineTo(r * .04, 0);
    ctx.lineTo(-r * .08, r * .16);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = p.integrity === 1 ? (highContrast ? '#c90000' : '#744232') : '#4b3928';
  ctx.beginPath();
  ctx.arc(r * .62, -r * .62, r * .25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fffaf0';
  ctx.font = `bold ${Math.max(10, r * .3)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(p.integrity), r * .62, -r * .62);
  ctx.restore();
}

function drawDebris(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation || 0);
  if (p.debrisKind === 'chili') {
    ctx.fillStyle = highContrast ? '#ff4a22' : '#b9442e';
    ctx.strokeStyle = highContrast ? '#fff36b' : 'rgba(94,31,22,.85)';
    ctx.lineWidth = highContrast ? 1.8 : 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r * 1.05, p.r * .38, -.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f7d88c';
    ctx.beginPath();
    ctx.arc(-p.r * .25, 0, Math.max(1.2, p.r * .12), 0, Math.PI * 2);
    ctx.arc(p.r * .25, 0, Math.max(1.2, p.r * .12), 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = highContrast ? '#fff36b' : '#d3c39a';
    ctx.strokeStyle = highContrast ? '#111' : 'rgba(86,66,43,.8)';
    ctx.lineWidth = highContrast ? 1.8 : 1;
    for (const [x, y, scale] of [[-.32, -.12, .55], [.18, -.28, .45], [.3, .2, .58], [-.2, .25, .42]]) {
      ctx.beginPath();
      ctx.arc(x * p.r, y * p.r, Math.max(2, p.r * scale), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawParticles(now = performance.now()) {
  // Oil sits on the surface, meat and vegetables catch the light above it.
  particleGroups.oil.forEach(p => drawOil(p, now));
  particleGroups.meat.forEach(drawMeat);
  particleGroups.veg.forEach(drawVegetable);
  particleGroups.bone.forEach(drawBone);
  particleGroups.debris.forEach(drawDebris);
}

function drawTool() {
  const scoopRadius = TOOL_CONFIG[currentTool].radius;
  ctx.save();
  ctx.translate(mouse.x, mouse.y);
  ctx.strokeStyle = 'rgba(255,248,226,.92)';
  ctx.fillStyle = 'rgba(255,238,201,.16)';
  ctx.lineWidth = 2.2;
  ctx.shadowColor = 'rgba(32,21,14,.6)';
  ctx.shadowBlur = 5;

  if (currentTool === 'spoon') {
    ctx.beginPath();
    ctx.ellipse(0, 0, scoopRadius * .62, scoopRadius * .4, -.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, scoopRadius * .28);
    ctx.lineTo(0, scoopRadius * 1.25);
    ctx.stroke();
  } else if (currentTool === 'holey') {
    ctx.beginPath();
    ctx.ellipse(0, 0, scoopRadius * .61, scoopRadius * .39, -.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,248,226,.68)';
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        ctx.beginPath();
        ctx.arc(i * 13, j * 9, 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.moveTo(0, scoopRadius * .3);
    ctx.lineTo(0, scoopRadius * 1.23);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, scoopRadius * .55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,248,226,.7)';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 9, -scoopRadius * .5);
      ctx.lineTo(i * 9, scoopRadius * .5);
      ctx.moveTo(-scoopRadius * .5, i * 9);
      ctx.lineTo(scoopRadius * .5, i * 9);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, scoopRadius * .5);
    ctx.lineTo(0, scoopRadius * 1.25);
    ctx.stroke();
  }
  updateToolTip();
  ctx.restore();
}
