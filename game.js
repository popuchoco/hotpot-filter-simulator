// Modified 2026-10-27: added practice, staged challenges, tool tradeoffs, and chilled-oil method.
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const timeDisplay = document.getElementById('timeDisplay');
const timerFill = document.getElementById('timerFill');
const hintEl = document.getElementById('hint');
const finalScoreEl = document.getElementById('finalScore');
const resultComment = document.getElementById('resultComment');
const resultStats = document.getElementById('resultStats');
const cleanlinessEl = document.getElementById('cleanliness');
const personalBestEl = document.getElementById('personalBest');
const bestScoreMenuEl = document.getElementById('bestScoreMenu');
const meatCountEl = document.getElementById('meatCount');
const vegCountEl = document.getElementById('vegCount');
const oilCountEl = document.getElementById('oilCount');
const pauseBtn = document.getElementById('pauseBtn');
const stageSelect = document.getElementById('stageSelect');
const stageDescription = document.getElementById('stageDescription');
const timerLabel = document.getElementById('timerLabel');
const toolTip = document.getElementById('toolTip');
const chillBtn = document.getElementById('chillBtn');
const methodStatus = document.getElementById('methodStatus');
const resultLabel = document.getElementById('resultLabel');

const BEST_SCORE_KEY = 'hotpot-filter-simulator.best-score.v1';
const STAGES = {
  starter: {
    name: '新手小鍋', durationMs: 50_000, counts: { meat: 24, veg: 7, oil: 16 },
    vegetables: ['芋頭', '南瓜'], description: '份量較少、蔬菜種類較簡單，適合初次練習。'
  },
  home: {
    name: '家常火鍋', durationMs: 40_000, counts: { meat: 44, veg: 12, oil: 32 },
    vegetables: ['芋頭', '南瓜', '番茄', '馬鈴薯'], description: '標準份量，熟悉三種食材與工具搭配。'
  },
  feast: {
    name: '熱鬧滿鍋', durationMs: 35_000, counts: { meat: 62, veg: 18, oil: 46 },
    vegetables: ['南瓜', '番茄', '馬鈴薯'], description: '時間更短、食材更多，考驗切換工具與取捨。'
  }
};
const PRACTICE_STAGE = {
  name: '練習辨認', durationMs: 0, counts: { meat: 14, veg: 5, oil: 14 },
  vegetables: ['芋頭', '南瓜', '番茄', '馬鈴薯']
};
const TOOL_CONFIG = {
  spoon: {
    name: '普通湯匙', radius: 43, types: ['oil'], scoreMultiplier: 1,
    soupLossMl: 7, tip: '撈面積較大、速度快；但容易多帶湯。適合未凝固的大片浮油。'
  },
  holey: {
    name: '有洞湯勺', radius: 36, types: ['veg', 'oil'], scoreMultiplier: .95,
    soupLossMl: 3, tip: '孔洞讓湯流回鍋裡；接觸範圍中等，適合蔬菜和一般浮油。'
  },
  strainer: {
    name: '細網撈沫勺', radius: 30, types: ['meat'], scoreMultiplier: 1.1,
    soupLossMl: 1, tip: '範圍較小、瞄準較精準，帶走湯汁少；適合肉沫和凝固油渣。'
  }
};
const CHILL_COST_MS = 3_000;
const CHILL_EFFECT_MS = 14_000;

let currentTool = 'strainer';
let score = 0;
let remainingMs = 0;
let activeDurationMs = 0;
let deadline = 0;
let animationFrame = 0;
let lastFrameTime = 0;
let running = false;
let gameEnded = false;
let particles = [];
let initialParticleCount = 0;
let removedParticleCount = 0;
let canvasWidth = 0;
let canvasHeight = 0;
let pixelRatio = 1;
let bestScore = loadBestScore();
const mouse = { x: 0, y: 0 };
let gameMode = 'challenge';
let activeStage = STAGES.home;
let currentStageId = 'home';
let soupLossMl = 0;
let chillUsed = false;
let chilledUntil = 0;
let chillRemainingMs = 0;
let scooped = { meat: 0, veg: 0, oil: 0, fail: 0 };

bestScoreMenuEl.textContent = bestScore;

function loadBestScore() {
  try {
    const value = Number(window.localStorage.getItem(BEST_SCORE_KEY));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(value) {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(value));
  } catch {
    // The game remains playable when storage is blocked or unavailable.
  }
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
  canvasWidth = rect.width;
  canvasHeight = rect.height;
  canvas.width = Math.round(canvasWidth * pixelRatio);
  canvas.height = Math.round(canvasHeight * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function randomPosition(margin = 10) {
  const size = Math.min(canvasWidth, canvasHeight);
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const rx = size * 0.365 - margin;
  const ry = size * 0.34 - margin;
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random());
  return {
    x: cx + Math.cos(angle) * rx * distance,
    y: cy + Math.sin(angle) * ry * distance
  };
}

function spawn() {
  particles = [];
  removedParticleCount = 0;
  const counts = activeStage.counts;

  // Fewer, larger pieces give the broth room to read as a single pot of soup.
  for (let i = 0; i < counts.meat; i++) {
    const pos = randomPosition(8);
    particles.push({
      ...pos,
      r: 3.2 + Math.random() * 3.2,
      type: 'meat',
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      shade: Math.random()
    });
  }

  const allVegTypes = [
    { name: '芋頭', color: '#b69b70', r: 18 },
    { name: '南瓜', color: '#e99542', r: 20 },
    { name: '番茄', color: '#ca5541', r: 18 },
    { name: '馬鈴薯', color: '#d0a26c', r: 18 }
  ];
  const vegTypes = allVegTypes.filter(veg => activeStage.vegetables.includes(veg.name));
  for (let i = 0; i < counts.veg; i++) {
    const pos = randomPosition(24);
    const veg = vegTypes[Math.floor(Math.random() * vegTypes.length)];
    particles.push({
      ...pos,
      r: veg.r + Math.random() * 4,
      type: 'veg',
      name: veg.name,
      color: veg.color,
      rotation: Math.random() * Math.PI,
      vx: (Math.random() - 0.5) * 0.13,
      vy: (Math.random() - 0.5) * 0.13
    });
  }

  for (let i = 0; i < counts.oil; i++) {
    const pos = randomPosition(11);
    particles.push({
      ...pos,
      r: 5 + Math.random() * 5.5,
      type: 'oil',
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      shimmer: Math.random()
    });
  }
  initialParticleCount = particles.length;
}

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
  const rx = size * 0.42;
  const ry = rx * 0.93;

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
  potBody.addColorStop(0, '#f0ebdf');
  potBody.addColorStop(0.06, '#777267');
  potBody.addColorStop(0.14, '#292825');
  potBody.addColorStop(0.24, '#c4bdaf');
  potBody.addColorStop(0.29, '#4c4942');
  potBody.addColorStop(0.76, '#1c1b19');
  potBody.addColorStop(0.93, '#6d675c');
  potBody.addColorStop(1, '#252320');
  ctx.fillStyle = potBody;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const rimGradient = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
  rimGradient.addColorStop(0, '#f9f4e8');
  rimGradient.addColorStop(0.12, '#5e5a52');
  rimGradient.addColorStop(0.29, '#ded7c8');
  rimGradient.addColorStop(0.46, '#58544c');
  rimGradient.addColorStop(0.7, '#f1e8d7');
  rimGradient.addColorStop(1, '#504c44');
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

  const basinX = rx * 0.925;
  const basinY = ry * 0.925;
  const inside = ctx.createRadialGradient(cx - rx * 0.24, cy - ry * 0.27, size * 0.04, cx, cy, rx * 1.03);
  inside.addColorStop(0, '#f9f5e8');
  inside.addColorStop(0.12, '#59564f');
  inside.addColorStop(0.28, '#d5cdbb');
  inside.addColorStop(0.42, '#777164');
  inside.addColorStop(0.65, '#282724');
  inside.addColorStop(1, '#131312');
  ctx.fillStyle = inside;
  ctx.beginPath();
  ctx.ellipse(cx, cy, basinX, basinY, 0, 0, Math.PI * 2);
  ctx.fill();

  const soupRx = rx * 0.875;
  const soupRy = ry * 0.855;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, soupRx, soupRy, 0, 0, Math.PI * 2);
  ctx.clip();

  const broth = ctx.createRadialGradient(cx - soupRx * 0.28, cy - soupRy * 0.39, size * 0.04, cx, cy, soupRx * 1.25);
  broth.addColorStop(0, '#f4dfb4');
  broth.addColorStop(0.36, '#e9cb91');
  broth.addColorStop(0.72, '#d4a768');
  broth.addColorStop(1, '#b97843');
  ctx.fillStyle = broth;
  ctx.fillRect(cx - soupRx, cy - soupRy, soupRx * 2, soupRy * 2);

  const warmShadow = ctx.createRadialGradient(cx, cy + soupRy * 0.54, 0, cx, cy + soupRy * 0.54, soupRx * 0.95);
  warmShadow.addColorStop(0, 'rgba(112,61,29,.2)');
  warmShadow.addColorStop(1, 'rgba(112,61,29,0)');
  ctx.fillStyle = warmShadow;
  ctx.fillRect(cx - soupRx, cy - soupRy, soupRx * 2, soupRy * 2);

  // A few slow surface rings and bubbles give the broth a gentle simmer.
  const t = now / 1000;
  for (let i = 0; i < 8; i++) {
    const phase = t * (0.35 + i * 0.015) + i * 1.7;
    const bx = cx + Math.sin(phase) * soupRx * (0.2 + (i % 3) * 0.19);
    const by = cy + Math.cos(phase * 0.83) * soupRy * (0.16 + (i % 4) * 0.14);
    const br = 1.4 + (i % 3) * 1.1;
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
  ctx.restore();

  // Fine double highlight on the rolled rim.
  ctx.strokeStyle = 'rgba(255,251,234,.62)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * .957, ry * .957, 0, Math.PI * 1.08, Math.PI * 1.88);
  ctx.stroke();
}

function isOilChilled(now = performance.now()) {
  return chillUsed && (gameMode === 'practice' || now < chilledUntil);
}

function drawOil(p, now = performance.now()) {
  const r = p.r;
  const chilled = isOilChilled(now);
  ctx.save();
  ctx.shadowColor = chilled ? 'rgba(136,225,245,.48)' : 'rgba(115,69,27,.2)';
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
  ctx.strokeStyle = chilled ? 'rgba(219,255,255,.95)' : 'rgba(255,248,215,.72)';
  ctx.lineWidth = Math.max(1, r * .08);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(p.x - r * .15, p.y - r * .27, r * .48, r * .18, -.22, Math.PI * 1.08, Math.PI * 1.86);
  ctx.strokeStyle = 'rgba(255,255,239,.7)';
  ctx.lineWidth = Math.max(1, r * .1);
  ctx.stroke();
  if (chilled) {
    ctx.strokeStyle = 'rgba(222,255,255,.8)';
    ctx.lineWidth = Math.max(1, r * .12);
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
  ctx.strokeStyle = 'rgba(255,211,169,.34)';
  ctx.lineWidth = .8;
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
    ctx.ellipse(0, 0, r * 1.03, r * .8, 0, 0, Math.PI * 2);
  } else if (p.name === '番茄') {
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      const radius = i % 2 ? r * .78 : r;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius * .85;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else {
    ctx.ellipse(0, 0, r * .94, r * .78, .14, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,241,210,.58)';
  ctx.lineWidth = 1.2;
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

function drawParticles(now = performance.now()) {
  // Oil sits on the surface, meat and vegetables catch the light above it.
  particles.filter(p => p.type === 'oil').forEach(p => drawOil(p, now));
  particles.filter(p => p.type === 'meat').forEach(drawMeat);
  particles.filter(p => p.type === 'veg').forEach(drawVegetable);
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
  ctx.restore();
}

function updatePhysics(frameScale) {
  const size = Math.min(canvasWidth, canvasHeight);
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const rx = size * .365;
  const ry = size * .34;

  particles.forEach(p => {
    p.x += p.vx * frameScale;
    p.y += p.vy * frameScale;
    const nx = (p.x - cx) / Math.max(1, rx - p.r);
    const ny = (p.y - cy) / Math.max(1, ry - p.r);
    const distance = Math.hypot(nx, ny);
    if (distance > 1) {
      const normalX = nx / distance;
      const normalY = ny / distance;
      const projection = p.vx * normalX + p.vy * normalY;
      p.vx -= projection * 1.7 * normalX;
      p.vy -= projection * 1.7 * normalY;
      p.x = cx + normalX * (rx - p.r);
      p.y = cy + normalY * (ry - p.r);
    }
  });

  const oils = particles.filter(p => p.type === 'oil');
  const liveOils = new Set(oils);
  const mergeChance = 1 - Math.pow(1 - .035, frameScale);
  for (let i = 0; i < oils.length; i++) {
    const a = oils[i];
    if (!liveOils.has(a)) continue;
    for (let j = i + 1; j < oils.length; j++) {
      const b = oils[j];
      if (!liveOils.has(b)) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) continue;
      const mergeDist = (a.r + b.r) * .9;
      if (dist < mergeDist) {
        if (a.r + b.r < 43 && Math.random() < mergeChance) {
          const areaA = a.r * a.r;
          const areaB = b.r * b.r;
          const area = areaA + areaB;
          a.x = (a.x * areaA + b.x * areaB) / area;
          a.y = (a.y * areaA + b.y * areaB) / area;
          a.r = Math.min(Math.sqrt(area) * .88, 34);
          a.vx = (a.vx * areaA + b.vx * areaB) / area;
          a.vy = (a.vy * areaA + b.vy * areaB) / area;
          const index = particles.indexOf(b);
          if (index !== -1) {
            particles.splice(index, 1);
            liveOils.delete(b);
          }
          break;
        }
        if (dist < mergeDist * 1.35) {
          const force = .012 * frameScale;
          a.vx -= (dx / dist) * force;
          a.vy -= (dy / dist) * force;
          b.vx += (dx / dist) * force;
          b.vy += (dy / dist) * force;
        }
      }
    }
  }
}

function updateCounts() {
  meatCountEl.textContent = scooped.meat;
  vegCountEl.textContent = scooped.veg;
  oilCountEl.textContent = scooped.oil;
}

function isGoodToolFor(particle, now = performance.now()) {
  if (particle.type === 'oil' && isOilChilled(now)) return currentTool === 'strainer';
  return TOOL_CONFIG[currentTool].types.includes(particle.type);
}

function tryScoop() {
  if (!running) return;
  const tool = TOOL_CONFIG[currentTool];
  const caught = [];
  const indices = [];
  particles.forEach((p, i) => {
    const distance = Math.hypot(p.x - mouse.x, p.y - mouse.y);
    if (distance < tool.radius * .8 + p.r * .4) {
      caught.push(p);
      indices.push(i);
    }
  });

  if (!caught.length) {
    showHint('這裡沒有食材，試試靠近一點。');
    return;
  }

  let gained = 0;
  let lost = 0;
  const remove = [];
  const now = performance.now();
  caught.forEach((p, i) => {
    const good = isGoodToolFor(p, now);
    const isBig = p.r > 20;
    if (good) {
      let points = Math.round(p.r * 1.8 + 3);
      if (p.type === 'oil' && isBig) points = Math.round(points * 1.7);
      if (p.type === 'veg' && isBig) points = Math.round(points * 1.3);
      if (p.type === 'oil' && isOilChilled(now)) points = Math.round(points * 1.25);
      gained += Math.round(points * tool.scoreMultiplier);
      soupLossMl += tool.soupLossMl * (p.type === 'veg' ? 1.5 : 1);
      scooped[p.type]++;
      remove.push(indices[i]);
    } else {
      lost += Math.round(p.r * .8 + 2);
      scooped.fail++;
      if (Math.random() < .45) {
        remove.push(indices[i]);
        soupLossMl += 2;
      }
    }
  });

  remove.sort((a, b) => b - a).forEach(index => particles.splice(index, 1));
  removedParticleCount += remove.length;
  score = Math.max(0, score + gained - lost);
  scoreEl.textContent = score;
  updateCounts();

  if (gained > lost) {
    const bigBonus = caught.some(p => p.r > 20 && isGoodToolFor(p, now));
    const coldBonus = caught.some(p => p.type === 'oil' && isOilChilled(now) && isGoodToolFor(p, now));
    showHint(coldBonus ? `凝固油花撈起！細網很合適 +${gained - lost}` : bigBonus ? `大塊撈起！${tool.name} +${gained - lost}` : `撈取成功 +${gained - lost}`);
  } else {
    showHint(`工具不合適，漏掉了… -${lost - gained}`);
  }
}

function updateToolTip() {
  toolTip.textContent = TOOL_CONFIG[currentTool].tip;
}

function updateMethodDisplay(now = performance.now()) {
  if (chillUsed && isOilChilled(now)) {
    const left = gameMode === 'practice' ? '' : `（${Math.ceil((chilledUntil - now) / 1000)} 秒）`;
    chillBtn.textContent = '❄️ 浮油凝固中';
    chillBtn.disabled = true;
    methodStatus.textContent = gameMode === 'practice' ? '練習中保持凝固；改用細網撈油。' : `凝油效果中，改用細網撈油 ${left}`;
    methodStatus.classList.add('active');
  } else if (chillUsed) {
    chillBtn.textContent = '❄️ 冷藏已使用';
    chillBtn.disabled = true;
    methodStatus.textContent = '凝油效果結束；本局已用過冷藏預備。';
    methodStatus.classList.remove('active');
  } else {
    chillBtn.textContent = '❄️ 冷藏凝油（預備）';
    chillBtn.disabled = !running;
    methodStatus.textContent = gameMode === 'challenge' ? '會消耗 3 秒，凝固效果維持 14 秒。' : '練習模式不限時，可先試用冷藏凝油。';
    methodStatus.classList.remove('active');
  }
}

function selectTool(toolId) {
  if (!TOOL_CONFIG[toolId]) return;
  currentTool = toolId;
  document.querySelectorAll('.tool').forEach(button => {
    const active = button.dataset.tool === currentTool;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  updateToolTip();
}

function activateChillMethod() {
  if (!running || chillUsed) return;
  const now = performance.now();
  if (gameMode === 'challenge') {
    remainingMs = Math.max(0, deadline - now);
    if (remainingMs <= CHILL_COST_MS) {
      showHint('剩餘時間不足 3 秒，來不及做冷藏預備。');
      return;
    }
    deadline -= CHILL_COST_MS;
    remainingMs -= CHILL_COST_MS;
    updateTimerDisplay();
  }
  chillUsed = true;
  chilledUntil = gameMode === 'practice' ? Number.POSITIVE_INFINITY : now + CHILL_EFFECT_MS;
  selectTool('strainer');
  updateMethodDisplay(now);
  showHint(gameMode === 'practice'
    ? '練習冷藏完成：油花已凝固，試著用細網撈取。'
    : '模擬冷藏預備完成：倒數 -3 秒，凝油效果 14 秒；用細網撈取。');
}

function showHint(message) {
  hintEl.textContent = message;
  clearTimeout(showHint.timer);
  showHint.timer = setTimeout(() => {
    if (hintEl.textContent === message) hintEl.textContent = '';
  }, 1500);
}

function updateTimerDisplay() {
  if (gameMode === 'practice') {
    timeDisplay.textContent = '∞';
    timeDisplay.classList.remove('warn');
    timerFill.style.transform = 'scaleX(1)';
    return;
  }
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  timeDisplay.textContent = String(seconds);
  timeDisplay.classList.toggle('warn', seconds <= 8);
  timerFill.style.transform = `scaleX(${Math.max(0, remainingMs / activeDurationMs)})`;
}

function loop(now) {
  if (!running) return;
  if (gameMode === 'challenge') remainingMs = Math.max(0, deadline - now);
  updateTimerDisplay();
  if (gameMode === 'challenge' && remainingMs <= 0) {
    endGame();
    return;
  }

  const frameScale = lastFrameTime ? Math.min(2.4, (now - lastFrameTime) / (1000 / 60)) : 1;
  lastFrameTime = now;
  updatePhysics(frameScale);
  drawSoup(now);
  drawParticles(now);
  drawTool();
  updateMethodDisplay(now);
  animationFrame = requestAnimationFrame(loop);
}

function startGame(mode = 'challenge') {
  gameMode = mode;
  currentStageId = stageSelect.value in STAGES ? stageSelect.value : 'home';
  activeStage = mode === 'practice' ? PRACTICE_STAGE : STAGES[currentStageId];
  activeDurationMs = mode === 'practice' ? 0 : activeStage.durationMs;
  score = 0;
  remainingMs = activeDurationMs;
  deadline = 0;
  gameEnded = false;
  soupLossMl = 0;
  chillUsed = false;
  chilledUntil = 0;
  chillRemainingMs = 0;
  scooped = { meat: 0, veg: 0, oil: 0, fail: 0 };
  scoreEl.textContent = '0';
  timerLabel.textContent = mode === 'practice' ? '練習模式' : `剩餘時間｜${activeStage.name}`;
  updateTimerDisplay();
  updateCounts();
  currentTool = 'strainer';
  document.querySelectorAll('.tool').forEach(button => {
    const active = button.dataset.tool === currentTool;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  showScreen('game');
  resize();
  spawn();
  mouse.x = canvasWidth / 2;
  mouse.y = canvasHeight / 2;
  running = true;
  pauseBtn.textContent = '暫停';
  pauseBtn.setAttribute('aria-pressed', 'false');
  updateToolTip();
  updateMethodDisplay();
  lastFrameTime = 0;
  if (mode === 'challenge') deadline = performance.now() + remainingMs;
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(loop);
  hintEl.textContent = mode === 'practice'
    ? '先辨認食材，再選工具；練習模式可以慢慢嘗試。'
    : `${activeStage.name}開始！肉沫用細網，蔬菜用有洞湯勺，未凝固浮油用湯匙。`;
}

function pauseGame() {
  if (!running || gameEnded) return;
  if (gameMode === 'challenge') remainingMs = Math.max(0, deadline - performance.now());
  if (gameMode === 'challenge' && remainingMs <= 0) {
    endGame();
    return;
  }
  if (gameMode === 'challenge' && chillUsed) {
    chillRemainingMs = Math.max(0, chilledUntil - performance.now());
  }
  running = false;
  cancelAnimationFrame(animationFrame);
  lastFrameTime = 0;
  updateTimerDisplay();
  pauseBtn.textContent = '繼續';
  pauseBtn.setAttribute('aria-pressed', 'true');
  updateMethodDisplay();
  showHint(gameMode === 'practice' ? '練習已暫停。' : '已暫停，倒數和凝油效果都停止了。');
}

function resumeGame() {
  if (running || gameEnded || (gameMode === 'challenge' && remainingMs <= 0)) return;
  running = true;
  if (gameMode === 'challenge') {
    deadline = performance.now() + remainingMs;
    if (chillUsed && chillRemainingMs > 0) {
      chilledUntil = performance.now() + chillRemainingMs;
      chillRemainingMs = 0;
    }
  }
  lastFrameTime = 0;
  pauseBtn.textContent = '暫停';
  pauseBtn.setAttribute('aria-pressed', 'false');
  updateMethodDisplay();
  hintEl.textContent = '繼續撈取！';
  animationFrame = requestAnimationFrame(loop);
}

function endGame() {
  if (gameEnded) return;
  gameEnded = true;
  running = false;
  cancelAnimationFrame(animationFrame);
  remainingMs = 0;
  updateTimerDisplay();
  finalScoreEl.textContent = score;

  const remaining = particles.length;
  // Oil droplets may merge into larger pools during play; merging is not cleanup.
  const cleared = Math.min(initialParticleCount, removedParticleCount);
  const cleanliness = initialParticleCount ? Math.round(cleared / initialParticleCount * 100) : 0;
  const successful = scooped.meat + scooped.veg + scooped.oil;
  const correctRate = successful + scooped.fail ? Math.round(successful / (successful + scooped.fail) * 100) : 0;
  cleanlinessEl.textContent = `${cleanliness}%`;
  const newRecord = gameMode === 'challenge' && score > bestScore;
  if (newRecord) {
    bestScore = score;
    saveBestScore(bestScore);
    bestScoreMenuEl.textContent = bestScore;
  }
  personalBestEl.textContent = gameMode === 'practice'
    ? `練習不列入最高分｜本機最高分 ${bestScore}`
    : newRecord ? `新紀錄！本機最高分 ${bestScore}` : `本機最高分 ${bestScore}`;
  resultLabel.textContent = gameMode === 'practice'
    ? '練習模式｜不限時，可再回去挑戰關卡。'
    : `挑戰關卡｜${activeStage.name} · ${Math.round(activeDurationMs / 1000)} 秒`;
  resultStats.innerHTML = `
    <div>🥩 肉沫撈起：<strong>${scooped.meat}</strong> 份</div>
    <div>🥦 蔬菜撈起：<strong>${scooped.veg}</strong> 塊</div>
    <div>🟡 浮油撈起：<strong>${scooped.oil}</strong> 片</div>
    <div>🫧 鍋中剩餘：<strong>${remaining}</strong> 份食材</div>
    <div>🎯 正確工具選擇：<strong>${correctRate}%</strong></div>
    <div>❌ 工具失誤：<strong>${scooped.fail}</strong> 次</div>
    <div>🥣 帶走湯汁估算：<strong>${Math.round(soupLossMl)} mL</strong></div>
    <div>❄️ 冷藏凝油：<strong>${chillUsed ? '已使用' : '未使用'}</strong></div>
  `;

  if (gameMode === 'practice') resultComment.textContent = '練習完成！可以換不同工具試撈同一類食材，觀察範圍和湯汁損失的差異。';
  else if (cleanliness >= 75) resultComment.textContent = '湯底清得很漂亮！眼力和工具都掌握得很好。';
  else if (score >= 160) resultComment.textContent = '撈得不錯，再留意鍋裡還有哪些食材。';
  else if (score >= 80) resultComment.textContent = '已經上手了，試著更快切換到合適的工具。';
  else resultComment.textContent = '再試一次，先用濾網清理肉沫，再處理蔬菜和浮油。';
  showScreen('result');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(screen => screen.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// Menu and game controls.
document.getElementById('startBtn').addEventListener('click', () => startGame('challenge'));
document.getElementById('practiceBtn').addEventListener('click', () => startGame('practice'));
document.getElementById('howToBtn').addEventListener('click', () => showScreen('howto'));
document.getElementById('backMenu').addEventListener('click', () => showScreen('menu'));
document.querySelectorAll('.tool').forEach(button => {
  button.addEventListener('click', () => selectTool(button.dataset.tool));
});
chillBtn.addEventListener('click', activateChillMethod);
stageSelect.addEventListener('change', () => {
  const stage = STAGES[stageSelect.value] || STAGES.home;
  stageDescription.textContent = `${stage.description} 食材：肉沫 ${stage.counts.meat}、蔬菜 ${stage.counts.veg}、浮油 ${stage.counts.oil}。`;
  document.getElementById('startBtn').textContent = `開始挑戰（${Math.round(stage.durationMs / 1000)} 秒）`;
});

canvas.addEventListener('pointerdown', event => {
  if (!running) return;
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  mouse.x = event.clientX - rect.left;
  mouse.y = event.clientY - rect.top;
  tryScoop();
});
canvas.addEventListener('pointermove', event => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = event.clientX - rect.left;
  mouse.y = event.clientY - rect.top;
});

pauseBtn.addEventListener('click', () => running ? pauseGame() : resumeGame());
document.getElementById('endBtn').addEventListener('click', endGame);
document.getElementById('retryBtn').addEventListener('click', () => startGame(gameMode));
document.getElementById('menuBtn').addEventListener('click', () => {
  running = false;
  gameEnded = true;
  cancelAnimationFrame(animationFrame);
  showScreen('menu');
});

window.addEventListener('resize', () => {
  resize();
  if (!running) return;
  drawSoup(performance.now());
  drawParticles(performance.now());
  drawTool();
});

stageSelect.dispatchEvent(new Event('change'));
showScreen('menu');
