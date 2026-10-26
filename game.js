// Modified 2026-10-27: modes, broths, accessibility, achievements, and seeded daily challenges.
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
const ruleSelect = document.getElementById('ruleSelect');
const ruleDescription = document.getElementById('ruleDescription');
const brothSelect = document.getElementById('brothSelect');
const brothDescription = document.getElementById('brothDescription');
const eventBanner = document.getElementById('eventBanner');
const shareBtn = document.getElementById('shareBtn');
const skinSelect = document.getElementById('skinSelect');
const achievementList = document.getElementById('achievementList');
const contrastToggle = document.getElementById('contrastToggle');
const motionToggle = document.getElementById('motionToggle');

const BEST_SCORE_KEY = 'hotpot-filter-simulator.best-score.v1';
const STAGE_RECORDS_KEY = 'hotpot-filter-simulator.stage-records.v1';
const ACHIEVEMENTS_KEY = 'hotpot-filter-simulator.achievements.v1';
const SETTINGS_KEY = 'hotpot-filter-simulator.settings.v1';
const CHILL_PRACTICE_COOLDOWN_MS = 25_000;
const CHILL_EFFECT_MS = 14_000;
const BOIL_CYCLE_MS = 14_000;
const BOIL_DURATION_MS = 3_800;
const RULES = {
  score: { name: '限時衝分', description: '時間內盡量撈取，挑戰更高分數。' },
  clear: { name: '全清挑戰', description: '限時清空整鍋；時間到仍有食材就算未完成。' },
  perfect: { name: '無失誤挑戰', description: '限時撈取，只要選錯工具就會立即結束。' }
};
const BROTHS = {
  clear: {
    name: '清湯', description: '清湯顏色較淡，方便辨認浮油。',
    colors: ['#fff2d2', '#e8d3a0', '#cfad70', '#ac7948'],
    flow: 1, aggregation: 1, boilFactor: 1, flowColor: 'rgba(255,255,232,.34)'
  },
  mala: {
    name: '麻辣', description: '沸騰較快，湯流更強，油花容易聚集。',
    colors: ['#ffd193', '#ed9560', '#c95637', '#792c22'],
    flow: 1.55, aggregation: 1.45, boilFactor: 1.3, flowColor: 'rgba(255,216,157,.48)'
  },
  miso: {
    name: '味噌', description: '湯流較緩，油花聚集較慢，撈取節奏較穩。',
    colors: ['#fff0b4', '#e4bf6c', '#bc8c3e', '#805329'],
    flow: .72, aggregation: .72, boilFactor: .72, flowColor: 'rgba(255,247,202,.3)'
  }
};
const POT_SKINS = {
  steel: { name: '經典不鏽鋼鍋', outer: ['#f0ebdf', '#777267', '#292825', '#c4bdaf', '#4c4942', '#1c1b19', '#6d675c', '#252320'] },
  jade: { name: '翡翠鍋', outer: ['#e6f0df', '#769079', '#263a32', '#b5c8a8', '#465c4b', '#18251f', '#64806a', '#213329'] },
  copper: { name: '暖銅鍋', outer: ['#ffe0ba', '#ad6844', '#48291f', '#d79563', '#74452e', '#2d1d18', '#a76b49', '#3b241c'] }
};
const ACHIEVEMENTS = [
  { id: 'first', name: '第一次開鍋', description: '完成一局遊戲。', skin: 'jade' },
  { id: 'clean', name: '清鍋達人', description: '單局清潔度達 100%。', skin: 'copper' },
  { id: 'accurate', name: '工具達人', description: '至少撈取 8 次，工具正確率達 90%。' },
  { id: 'gentle', name: '惜湯高手', description: '成功撈取 8 份以上，湯汁損失不超過 20 mL。' },
  { id: 'daily', name: '每日鍋友', description: '完成一次每日固定盤面挑戰。' }
];
const STAGES = {
  starter: {
    name: '新手小鍋', durationMs: 50_000, counts: { meat: 24, veg: 7, oil: 16, bone: 1 },
    vegetables: ['芋頭', '南瓜'], description: '份量較少、蔬菜種類較簡單，適合初次練習。'
  },
  home: {
    name: '家常火鍋', durationMs: 40_000, counts: { meat: 44, veg: 12, oil: 32, bone: 2 },
    vegetables: ['芋頭', '南瓜', '番茄', '馬鈴薯'], description: '標準份量，熟悉三種食材與工具搭配。'
  },
  feast: {
    name: '熱鬧滿鍋', durationMs: 35_000, counts: { meat: 62, veg: 18, oil: 46, bone: 3 },
    vegetables: ['南瓜', '番茄', '馬鈴薯'], description: '時間更短、食材更多，考驗切換工具與取捨。'
  }
};
const PRACTICE_STAGE = {
  name: '練習辨認', durationMs: 0, counts: { meat: 14, veg: 5, oil: 14, bone: 1 },
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
let canvasWidth = 0;
let canvasHeight = 0;
let pixelRatio = 1;
let bestScore = loadBestScore();
let stageRecords = loadStageRecords();
let unlockedAchievements = loadAchievements();
const mouse = { x: 0, y: 0 };
let gameMode = 'challenge';
let challengeRule = 'score';
let brothId = 'clear';
let isDailyChallenge = false;
let dailyChallengeSeed = null;
let dailyChallengeDate = '';
let randomState = 0;
let randomSeedActive = false;
let activeStage = STAGES.home;
let currentStageId = 'home';
let soupLossMl = 0;
let chillUsed = false;
let chilledUntil = 0;
let chillRemainingMs = 0;
let chillCooldownUntil = 0;
let chillCooldownRemainingMs = 0;
let scooped = { meat: 0, veg: 0, oil: 0, bone: 0, boneHits: 0, fail: 0 };
let initialMass = { meat: 0, veg: 0, oil: 0, bone: 0 };
let removedMass = { meat: 0, veg: 0, oil: 0, bone: 0 };
let simulationTimeMs = 0;
let boilingNow = false;
let reduceMotion = false;
let highContrast = false;
let soundEnabled = false;
let audioContext = null;
let lastCountdownSecond = null;
let spoonStreak = 0;
let lastSpoonUse = 0;
let selectedSkin = 'steel';

bestScoreMenuEl.textContent = bestScore;
initializeSettings();
renderAchievements();
updateStageRecordDisplay();

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

function loadStageRecords() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STAGE_RECORDS_KEY) || '{}');
    const records = parsed && typeof parsed === 'object' ? parsed : {};
    if (!Object.keys(records).length && bestScore > 0) records.home = bestScore;
    return records;
  } catch {
    return bestScore > 0 ? { home: bestScore } : {};
  }
}

function saveStageRecords() {
  try { window.localStorage.setItem(STAGE_RECORDS_KEY, JSON.stringify(stageRecords)); } catch { /* Local storage is optional. */ }
}

function loadAchievements() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACHIEVEMENTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(id => ACHIEVEMENTS.some(item => item.id === id)) : [];
  } catch { return []; }
}

function saveAchievements() {
  try { window.localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(unlockedAchievements)); } catch { /* Local storage is optional. */ }
}

function initializeSettings() {
  let settings = {};
  try { settings = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch { /* Use defaults. */ }
  highContrast = Boolean(settings.highContrast);
  reduceMotion = Object.prototype.hasOwnProperty.call(settings, 'reduceMotion')
    ? Boolean(settings.reduceMotion)
    : window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  soundEnabled = Boolean(settings.soundEnabled);
  selectedSkin = settings.skin && POT_SKINS[settings.skin] ? settings.skin : 'steel';
  contrastToggle.checked = highContrast;
  motionToggle.checked = reduceMotion;
  document.getElementById('soundToggle').checked = soundEnabled;
  document.documentElement.classList.toggle('high-contrast', highContrast);
  document.documentElement.classList.toggle('reduce-motion', reduceMotion);
  updateSkinOptions();
}

function saveSettings() {
  try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ highContrast, reduceMotion, soundEnabled, skin: selectedSkin })); } catch { /* The settings are still active for this page. */ }
}

function updateSkinOptions() {
  const unlockedSkins = new Set(['steel']);
  ACHIEVEMENTS.forEach(item => { if (item.skin && unlockedAchievements.includes(item.id)) unlockedSkins.add(item.skin); });
  skinSelect.innerHTML = Object.entries(POT_SKINS).map(([id, skin]) => {
    const unlocked = unlockedSkins.has(id);
    return `<option value="${id}" ${unlocked ? '' : 'disabled'}>${unlocked ? '🔓' : '🔒'} ${skin.name}</option>`;
  }).join('');
  if (!unlockedSkins.has(selectedSkin)) selectedSkin = 'steel';
  skinSelect.value = selectedSkin;
}

function renderAchievements() {
  achievementList.innerHTML = ACHIEVEMENTS.map(item => {
    const unlocked = unlockedAchievements.includes(item.id);
    return `<div class="achievement-item ${unlocked ? 'unlocked' : ''}" title="${item.description}">${unlocked ? '🏅' : '🔒'} ${item.name}</div>`;
  }).join('');
  updateSkinOptions();
}

function unlockAchievementsForRun({ cleanliness, correctRate, attempts, successful, totalSoupLoss }) {
  const newlyUnlocked = [];
  const conditions = {
    first: true,
    clean: cleanliness >= 100,
    accurate: attempts >= 8 && correctRate >= 90,
    gentle: successful >= 8 && totalSoupLoss <= 20,
    daily: isDailyChallenge
  };
  ACHIEVEMENTS.forEach(item => {
    if (conditions[item.id] && !unlockedAchievements.includes(item.id)) {
      unlockedAchievements.push(item.id);
      newlyUnlocked.push(item.name);
    }
  });
  if (newlyUnlocked.length) {
    saveAchievements();
    renderAchievements();
  }
  return newlyUnlocked;
}

function updateStageRecordDisplay() {
  const stageId = stageSelect.value in STAGES ? stageSelect.value : 'home';
  const record = Number(stageRecords[stageId]) || 0;
  bestScoreMenuEl.textContent = String(record);
}

function dailyDateTaipei() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}${value.month}${value.day}`;
}

function hashSeed(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return hash >>> 0 || 1;
}

function dailyChallengeDescriptor() {
  const params = new URLSearchParams(window.location.search);
  const sharedDate = params.get('daily');
  const sharedSeed = Number(params.get('seed'));
  if (/^\d{8}$/.test(sharedDate || '') && Number.isInteger(sharedSeed) && sharedSeed > 0 && sharedSeed <= 0xFFFFFFFF) {
    return { date: sharedDate, seed: sharedSeed >>> 0, shared: true };
  }
  const date = dailyDateTaipei();
  return { date, seed: hashSeed(`hotpot-filter-daily-${date}`), shared: false };
}

function random() {
  if (!randomSeedActive) return Math.random();
  randomState = (randomState + 0x6D2B79F5) | 0;
  let t = randomState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function formatSeed(seed) {
  return (seed >>> 0).toString(36).toUpperCase();
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
  const angle = random() * Math.PI * 2;
  const distance = Math.sqrt(random());
  return {
    x: cx + Math.cos(angle) * rx * distance,
    y: cy + Math.sin(angle) * ry * distance
  };
}

function spawn() {
  particles = [];
  initialMass = { meat: 0, veg: 0, oil: 0, bone: 0 };
  removedMass = { meat: 0, veg: 0, oil: 0, bone: 0 };
  const counts = activeStage.counts;

  // Fewer, larger pieces give the broth room to read as a single pot of soup.
  for (let i = 0; i < counts.meat; i++) {
    const pos = randomPosition(8);
    particles.push({
      ...pos,
      r: 3.2 + random() * 3.2,
      type: 'meat',
      units: 1,
      mass: 1,
      vx: (random() - 0.5) * 0.2,
      vy: (random() - 0.5) * 0.2,
      shade: random()
    });
    initialMass.meat += 1;
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
    const veg = vegTypes[Math.floor(random() * vegTypes.length)];
    particles.push({
      ...pos,
      r: veg.r + random() * 4,
      type: 'veg',
      units: 1,
      mass: 1,
      name: veg.name,
      color: veg.color,
      rotation: random() * Math.PI,
      vx: (random() - 0.5) * 0.13,
      vy: (random() - 0.5) * 0.13
    });
    initialMass.veg += 1;
  }

  for (let i = 0; i < counts.oil; i++) {
    const pos = randomPosition(11);
    const radius = 5 + random() * 5.5;
    particles.push({
      ...pos,
      r: radius,
      type: 'oil',
      units: 1,
      mass: radius * radius,
      vx: (random() - 0.5) * 0.28,
      vy: (random() - 0.5) * 0.28,
      shimmer: random() * Math.PI * 2
    });
    initialMass.oil += particles[particles.length - 1].mass;
  }
  for (let i = 0; i < (counts.bone || 0); i++) {
    const pos = randomPosition(25);
    particles.push({
      ...pos, r: 19 + random() * 4, type: 'bone', name: '骨頭', units: 1, mass: 2,
      integrity: 2, vx: (random() - .5) * .1, vy: (random() - .5) * .1,
      rotation: random() * .3
    });
    initialMass.bone += 2;
  }
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
  const potStops = POT_SKINS[selectedSkin].outer;
  [0, .06, .14, .24, .29, .76, .93, 1].forEach((offset, index) => potBody.addColorStop(offset, potStops[index]));
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
  const brothColors = BROTHS[brothId].colors;
  broth.addColorStop(0, brothColors[0]);
  broth.addColorStop(0.36, brothColors[1]);
  broth.addColorStop(0.72, brothColors[2]);
  broth.addColorStop(1, brothColors[3]);
  ctx.fillStyle = broth;
  ctx.fillRect(cx - soupRx, cy - soupRy, soupRx * 2, soupRy * 2);

  const warmShadow = ctx.createRadialGradient(cx, cy + soupRy * 0.54, 0, cx, cy + soupRy * 0.54, soupRx * 0.95);
  warmShadow.addColorStop(0, 'rgba(112,61,29,.2)');
  warmShadow.addColorStop(1, 'rgba(112,61,29,0)');
  ctx.fillStyle = warmShadow;
  ctx.fillRect(cx - soupRx, cy - soupRy, soupRx * 2, soupRy * 2);

  // A few slow surface rings and bubbles give the broth a gentle simmer.
  const t = (reduceMotion ? 0 : now) / 1000;
  for (let i = 0; i < (reduceMotion ? 0 : 8); i++) {
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
  if (boilingNow && !reduceMotion) {
    ctx.save();
    ctx.strokeStyle = BROTHS[brothId].flowColor;
    ctx.lineWidth = Math.max(2, size * .006);
    ctx.setLineDash([size * .025, size * .035]);
    for (let i = 0; i < 3; i++) {
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
  ctx.ellipse(p.x - r * .15 + shimmer * r, p.y - r * (.27 + shimmer * .18), r * (.4 + shimmer * .12), r * .18, -.22, Math.PI * 1.08, Math.PI * 1.86);
  ctx.strokeStyle = highContrast ? '#fff' : `rgba(255,255,239,${.55 + Math.abs(shimmer)})`;
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
  ctx.fillStyle = p.integrity > 1 ? '#e8dfc8' : '#cfc3a6';
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
    ctx.strokeStyle = '#744232';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * .12, -r * .2);
    ctx.lineTo(r * .04, 0);
    ctx.lineTo(-r * .08, r * .16);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(now = performance.now()) {
  // Oil sits on the surface, meat and vegetables catch the light above it.
  particles.filter(p => p.type === 'oil').forEach(p => drawOil(p, now));
  particles.filter(p => p.type === 'meat').forEach(drawMeat);
  particles.filter(p => p.type === 'veg').forEach(drawVegetable);
  particles.filter(p => p.type === 'bone').forEach(drawBone);
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

function updatePhysics(frameScale) {
  const size = Math.min(canvasWidth, canvasHeight);
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const rx = size * .365;
  const ry = size * .34;

  const broth = BROTHS[brothId];
  const motionScale = reduceMotion ? .18 : 1;
  particles.forEach(p => {
    if (boilingNow && !reduceMotion) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const distance = Math.max(30, Math.hypot(dx, dy));
      const force = .028 * broth.flow * frameScale;
      p.vx += (-dy / distance) * force;
      p.vy += (dx / distance) * force;
      p.vx += (dx / distance) * force * .16;
      p.vy += (dy / distance) * force * .16;
      p.vx = Math.max(-1.5, Math.min(1.5, p.vx));
      p.vy = Math.max(-1.5, Math.min(1.5, p.vy));
    }
    p.x += p.vx * frameScale * motionScale;
    p.y += p.vy * frameScale * motionScale;
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
  const oilOrder = new Map(oils.map((oil, index) => [oil, index]));
  const cellSize = 64;
  const cells = new Map();
  const cellKey = (x, y) => `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
  for (const oil of oils) {
    const key = cellKey(oil.x, oil.y);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(oil);
  }
  const baseMergeRate = Math.min(.12, .035 * broth.aggregation * (boilingNow ? 1.8 : 1));
  const mergeChance = 1 - Math.pow(1 - baseMergeRate, frameScale);
  const removeFromCell = (oil, key) => {
    const bucket = cells.get(key);
    if (!bucket) return;
    const index = bucket.indexOf(oil);
    if (index !== -1) bucket.splice(index, 1);
    if (!bucket.length) cells.delete(key);
  };
  const addToCell = oil => {
    const key = cellKey(oil.x, oil.y);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(oil);
  };
  for (let i = 0; i < oils.length; i++) {
    const a = oils[i];
    if (!liveOils.has(a)) continue;
    const [cellX, cellY] = cellKey(a.x, a.y).split(',').map(Number);
    const candidates = new Set();
    // Oil only merges within a small radius; nearby grid cells avoid all-pairs checks.
    for (let gx = cellX - 1; gx <= cellX + 1; gx++) {
      for (let gy = cellY - 1; gy <= cellY + 1; gy++) {
        for (const oil of cells.get(`${gx},${gy}`) || []) candidates.add(oil);
      }
    }
    for (const b of candidates) {
      if (oilOrder.get(b) <= i) continue;
      if (!liveOils.has(b)) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) continue;
      const mergeDist = (a.r + b.r) * .9;
      if (dist < mergeDist) {
        if (a.r + b.r < 43 && random() < mergeChance) {
          const oldAKey = cellKey(a.x, a.y);
          const oldBKey = cellKey(b.x, b.y);
          const areaA = a.r * a.r;
          const areaB = b.r * b.r;
          const area = areaA + areaB;
          a.x = (a.x * areaA + b.x * areaB) / area;
          a.y = (a.y * areaA + b.y * areaB) / area;
          a.r = Math.min(Math.sqrt(area), 34);
          a.mass = (a.mass || areaA) + (b.mass || areaB);
          a.units = (a.units || 1) + (b.units || 1);
          a.vx = (a.vx * areaA + b.vx * areaB) / area;
          a.vy = (a.vy * areaA + b.vy * areaB) / area;
          const newAKey = cellKey(a.x, a.y);
          if (newAKey !== oldAKey) {
            removeFromCell(a, oldAKey);
            addToCell(a);
          }
          removeFromCell(b, oldBKey);
          const index = particles.indexOf(b);
          if (index !== -1) {
            particles.splice(index, 1);
            liveOils.delete(b);
          }
          break;
        }
        if (dist < mergeDist * 1.35) {
          const force = .012 * broth.aggregation * (boilingNow ? 1.6 : 1) * frameScale;
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
  document.getElementById('boneCount').textContent = scooped.bone;
}

function isGoodToolFor(particle, now = performance.now()) {
  if (particle.type === 'oil' && isOilChilled(now)) return currentTool === 'strainer';
  if (particle.type === 'bone') return currentTool === 'holey';
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

  const now = performance.now();
  if (currentTool === 'spoon') {
    spoonStreak = now - lastSpoonUse <= 2_000 ? Math.min(4, spoonStreak + 1) : 0;
    lastSpoonUse = now;
  } else {
    spoonStreak = 0;
    lastSpoonUse = 0;
  }

  let gained = 0;
  let lost = 0;
  const remove = new Set();
  let successfulActions = 0;
  caught.forEach((p, i) => {
    const good = isGoodToolFor(p, now);
    const isBig = p.r > 20;
    if (good) {
      let points = Math.round(p.r * 1.8 + 3);
      if (p.type === 'bone') points += 18;
      if (p.type === 'oil' && isBig) points = Math.round(points * 1.7);
      if (p.type === 'veg' && isBig) points = Math.round(points * 1.3);
      if (p.type === 'oil' && isOilChilled(now)) points = Math.round(points * 1.25);
      gained += Math.round(points * tool.scoreMultiplier);
      const spoonPenalty = currentTool === 'spoon' ? 1 + spoonStreak * .25 : 1;
      soupLossMl = Math.min(5000, soupLossMl + tool.soupLossMl * (p.type === 'veg' ? 1.5 : 1) * spoonPenalty);
      successfulActions++;
      if (p.type === 'bone') scooped.boneHits++;
      if (p.type === 'bone' && p.integrity > 1) {
        p.integrity--;
        showHint('骨頭較大，要用有洞湯勺再撈一次！');
      } else {
        scooped[p.type]++;
        remove.add(indices[i]);
        removedMass[p.type] += p.mass || 1;
      }
    } else {
      lost += Math.round(p.r * .8 + 2);
      scooped.fail++;
      if (random() < .45) {
        remove.add(indices[i]);
        removedMass[p.type] += p.mass || 1;
        soupLossMl = Math.min(5000, soupLossMl + 2);
      }
    }
  });

  [...remove].sort((a, b) => b - a).forEach(index => particles.splice(index, 1));
  score = Math.max(0, score + gained - lost);
  scoreEl.textContent = score;
  updateCounts();

  playSound(lost > 0 ? 'fail' : 'scoop');
  if (gained > lost) {
    const bigBonus = caught.some(p => p.r > 20 && isGoodToolFor(p, now));
    const coldBonus = caught.some(p => p.type === 'oil' && isOilChilled(now) && isGoodToolFor(p, now));
    showHint(coldBonus ? `凝固油花撈起！細網很合適 +${gained - lost}` : bigBonus ? `大塊撈起！${tool.name} +${gained - lost}` : `撈取成功 +${gained - lost}`);
  } else {
    showHint(`工具不合適，漏掉了… -${lost - gained}`);
  }
  if (currentTool === 'spoon' && spoonStreak >= 2) showHint(`湯匙連續使用，帶走湯汁增加 ${Math.round(spoonStreak * 25)}%`);
  if (challengeRule === 'perfect' && scooped.fail > 0) {
    endGame('mistake');
    return;
  }
  if (challengeRule === 'clear' && particles.length === 0) {
    endGame('cleared');
    return;
  }
  if (successfulActions === 0 && lost === 0) showHint('這次沒有撈中，靠近食材再試試。');
}

function updateToolTip() {
  const spoonNote = currentTool === 'spoon' ? ` 連續使用會逐次增加湯汁損失（目前連續 ${spoonStreak} 次）。` : '';
  const boneNote = currentTool === 'holey' ? ' 骨頭需要成功撈取兩次才會清除。' : '';
  toolTip.textContent = `${TOOL_CONFIG[currentTool].tip}${spoonNote}${boneNote}`;
}

function updateMethodDisplay(now = performance.now()) {
  const chilled = chillUsed && now < chilledUntil;
  document.querySelectorAll('.tool').forEach(button => {
    const locked = chilled && button.dataset.tool !== 'strainer';
    button.disabled = locked;
    button.title = locked ? '浮油已凝固；請先用細網撈取，凝固效果結束後再切換工具。' : '';
  });
  if (chilled) {
    const left = `（${Math.ceil((chilledUntil - now) / 1000)} 秒）`;
    chillBtn.textContent = '❄️ 浮油凝固中';
    chillBtn.disabled = true;
    methodStatus.textContent = `凝油效果中，僅能用細網撈油 ${left}`;
    methodStatus.classList.add('active');
  } else if (gameMode === 'practice' && now < chillCooldownUntil) {
    const left = Math.ceil((chillCooldownUntil - now) / 1000);
    chillBtn.textContent = '❄️ 冷藏冷卻中';
    chillBtn.disabled = true;
    methodStatus.textContent = `練習冷卻 ${left} 秒；效果本身維持 14 秒。`;
    methodStatus.classList.remove('active');
  } else if (gameMode === 'challenge' && chillUsed) {
    chillBtn.textContent = '❄️ 冷藏已使用';
    chillBtn.disabled = true;
    methodStatus.textContent = '凝油效果結束；限時挑戰每局只能預備一次。';
    methodStatus.classList.remove('active');
  } else {
    chillBtn.textContent = '❄️ 冷藏凝油（預備）';
    chillBtn.disabled = !running || !isOilChilled(now) && gameMode === 'practice' && now < chillCooldownUntil;
    methodStatus.textContent = gameMode === 'challenge' ? '會消耗 3 秒，凝固效果維持 14 秒。' : '練習模式每 25 秒可預備一次，凝固維持 14 秒。';
    methodStatus.classList.remove('active');
  }
}

function selectTool(toolId) {
  if (!TOOL_CONFIG[toolId]) return;
  if (isOilChilled() && toolId !== 'strainer') {
    showHint('浮油已凝固，只能用細網撈取；等效果結束即可切換。');
    playSound('fail');
    return;
  }
  currentTool = toolId;
  document.querySelectorAll('.tool').forEach(button => {
    const active = button.dataset.tool === currentTool;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  updateToolTip();
}

function activateChillMethod() {
  if (!running || (gameMode === 'challenge' && chillUsed) || isOilChilled()) return;
  const now = performance.now();
  if (gameMode === 'practice' && now < chillCooldownUntil) {
    showHint(`冷藏還要 ${Math.ceil((chillCooldownUntil - now) / 1000)} 秒才能再次使用。`);
    return;
  }
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
  chilledUntil = now + CHILL_EFFECT_MS;
  chillRemainingMs = CHILL_EFFECT_MS;
  if (gameMode === 'practice') chillCooldownUntil = now + CHILL_PRACTICE_COOLDOWN_MS;
  selectTool('strainer');
  updateMethodDisplay(now);
  playSound('chill');
  showHint(gameMode === 'practice'
    ? '練習冷藏完成：凝固 14 秒，25 秒後可再次預備；用細網撈取。'
    : '模擬冷藏預備完成：倒數 -3 秒，凝油效果 14 秒；用細網撈取。');
}

function showHint(message) {
  hintEl.textContent = message;
  clearTimeout(showHint.timer);
  showHint.timer = setTimeout(() => {
    if (hintEl.textContent === message) hintEl.textContent = '';
  }, 1500);
}

function playSound(kind) {
  if (!soundEnabled) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext ||= new AudioContextClass();
    if (audioContext.state === 'suspended') audioContext.resume();
    const notes = kind === 'scoop' ? [660, 880] : kind === 'chill' ? [520, 740, 980] : kind === 'tick' ? [420] : [190, 140];
    notes.forEach((frequency, index) => {
      const start = audioContext.currentTime + index * .075;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = kind === 'fail' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.075, start + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .12);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + .13);
    });
  } catch { /* Audio is optional; the game remains fully usable without it. */ }
}

function getRemainingIngredientUnits() {
  return particles.reduce((total, particle) => total + (particle.units || 1), 0);
}

function currentBoilState() {
  const broth = BROTHS[brothId];
  const cycle = BOIL_CYCLE_MS / broth.boilFactor;
  const activeDuration = Math.min(cycle * .55, BOIL_DURATION_MS * broth.boilFactor);
  return (simulationTimeMs % cycle) < activeDuration;
}

function updateEventDisplay() {
  const broth = BROTHS[brothId];
  eventBanner.classList.toggle('active', boilingNow);
  eventBanner.textContent = boilingNow
    ? `🔥 ${broth.name}沸騰湯流！食材移動加快，油花更容易聚集`
    : `${broth.name}湯面平穩｜留意下一波沸騰湯流`;
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
  if (gameMode === 'challenge') {
    const seconds = Math.ceil(remainingMs / 1000);
    if (seconds <= 5 && seconds > 0 && seconds !== lastCountdownSecond) playSound('tick');
    lastCountdownSecond = seconds;
  }
  if (gameMode === 'challenge' && remainingMs <= 0) {
    endGame();
    return;
  }

  const frameScale = lastFrameTime ? Math.min(2.4, (now - lastFrameTime) / (1000 / 60)) : 1;
  lastFrameTime = now;
  simulationTimeMs += frameScale * (1000 / 60);
  const wasBoiling = boilingNow;
  boilingNow = currentBoilState();
  if (boilingNow !== wasBoiling) updateEventDisplay();
  updatePhysics(frameScale);
  drawSoup(now);
  drawParticles(now);
  drawTool();
  updateMethodDisplay(now);
  animationFrame = requestAnimationFrame(loop);
}

function startGame(mode = 'challenge', daily = false) {
  gameMode = mode;
  isDailyChallenge = mode === 'challenge' && daily;
  const dailyInfo = isDailyChallenge ? dailyChallengeDescriptor() : null;
  dailyChallengeSeed = dailyInfo?.seed ?? null;
  dailyChallengeDate = dailyInfo?.date ?? '';
  currentStageId = isDailyChallenge ? 'home' : (stageSelect.value in STAGES ? stageSelect.value : 'home');
  challengeRule = isDailyChallenge ? 'score' : (mode === 'practice' ? 'score' : (ruleSelect.value in RULES ? ruleSelect.value : 'score'));
  brothId = isDailyChallenge ? ['clear', 'mala', 'miso'][dailyChallengeSeed % 3] : (brothSelect.value in BROTHS ? brothSelect.value : 'clear');
  randomSeedActive = isDailyChallenge;
  randomState = dailyChallengeSeed || 0;
  activeStage = mode === 'practice' ? PRACTICE_STAGE : STAGES[currentStageId];
  activeDurationMs = mode === 'practice' ? 0 : activeStage.durationMs * (challengeRule === 'clear' ? 3 : 1);
  score = 0;
  remainingMs = activeDurationMs;
  deadline = 0;
  gameEnded = false;
  soupLossMl = 0;
  chillUsed = false;
  chilledUntil = 0;
  chillRemainingMs = 0;
  chillCooldownUntil = 0;
  chillCooldownRemainingMs = 0;
  chillCooldownRemainingMs = 0;
  simulationTimeMs = 0;
  boilingNow = false;
  spoonStreak = 0;
  lastSpoonUse = 0;
  lastCountdownSecond = null;
  scooped = { meat: 0, veg: 0, oil: 0, bone: 0, boneHits: 0, fail: 0 };
  scoreEl.textContent = '0';
  timerLabel.textContent = mode === 'practice'
    ? `${BROTHS[brothId].name}｜練習模式`
    : `剩餘時間｜${isDailyChallenge ? `${dailyChallengeDate} 每日挑戰` : `${activeStage.name} · ${RULES[challengeRule].name}`}｜${BROTHS[brothId].name}`;
  updateTimerDisplay();
  updateCounts();
  currentTool = 'strainer';
  document.querySelectorAll('.tool').forEach(button => {
    const active = button.dataset.tool === currentTool;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    button.disabled = false;
  });
  shareBtn.classList.toggle('hidden', !isDailyChallenge);
  showScreen('game');
  resize();
  spawn();
  mouse.x = canvasWidth / 2;
  mouse.y = canvasHeight / 2;
  running = true;
  pauseBtn.textContent = '暫停';
  pauseBtn.setAttribute('aria-pressed', 'false');
  updateToolTip();
  if (mode === 'challenge') deadline = performance.now() + remainingMs;
  boilingNow = currentBoilState();
  updateEventDisplay();
  updateMethodDisplay();
  lastFrameTime = 0;
  canvas.focus({ preventScroll: true });
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(loop);
  if (mode === 'practice') hintEl.textContent = '先辨認食材，再選工具；骨頭要用有洞湯勺撈兩次。';
  else if (isDailyChallenge) hintEl.textContent = `每日固定盤面｜${dailyChallengeDate}｜種子 ${formatSeed(dailyChallengeSeed)}。分享連結讓朋友玩同一盤！`;
  else hintEl.textContent = `${activeStage.name}｜${RULES[challengeRule].name}開始！肉沫用細網、骨頭用有洞湯勺撈兩次。`;
}

function pauseGame() {
  if (!running || gameEnded) return;
  const now = performance.now();
  if (gameMode === 'challenge') remainingMs = Math.max(0, deadline - now);
  if (gameMode === 'challenge' && remainingMs <= 0) {
    endGame();
    return;
  }
  if (chillUsed) chillRemainingMs = Math.max(0, chilledUntil - now);
  if (gameMode === 'practice' && chillCooldownUntil > now) chillCooldownRemainingMs = chillCooldownUntil - now;
  running = false;
  cancelAnimationFrame(animationFrame);
  lastFrameTime = 0;
  updateTimerDisplay();
  pauseBtn.textContent = '繼續';
  pauseBtn.setAttribute('aria-pressed', 'true');
  updateMethodDisplay(now);
  showHint(gameMode === 'practice' ? '練習已暫停，冷藏效果與冷卻時間也會凍結。' : '已暫停，倒數、事件和凝油效果都停止了。');
}

function resumeGame() {
  if (running || gameEnded || (gameMode === 'challenge' && remainingMs <= 0)) return;
  const now = performance.now();
  running = true;
  if (gameMode === 'challenge') deadline = now + remainingMs;
  if (chillUsed && chillRemainingMs > 0) {
    chilledUntil = now + chillRemainingMs;
    chillRemainingMs = 0;
  }
  if (gameMode === 'practice' && chillCooldownRemainingMs > 0) {
    chillCooldownUntil = now + chillCooldownRemainingMs;
    chillCooldownRemainingMs = 0;
  }
  lastFrameTime = 0;
  pauseBtn.textContent = '暫停';
  pauseBtn.setAttribute('aria-pressed', 'false');
  updateMethodDisplay(now);
  hintEl.textContent = '繼續撈取！';
  animationFrame = requestAnimationFrame(loop);
}

function getCategoryCleanliness(type) {
  if (!initialMass[type]) return null;
  return Math.max(0, Math.min(100, Math.round(removedMass[type] / initialMass[type] * 100)));
}

function endGame(reason = 'timeout') {
  if (gameEnded) return;
  gameEnded = true;
  running = false;
  cancelAnimationFrame(animationFrame);
  remainingMs = 0;
  updateTimerDisplay();
  finalScoreEl.textContent = score;

  const remaining = getRemainingIngredientUnits();
  const categoryRates = Object.fromEntries(['meat', 'veg', 'oil', 'bone'].map(type => [type, getCategoryCleanliness(type)]));
  const activeRates = Object.values(categoryRates).filter(rate => rate !== null);
  const cleanliness = activeRates.length ? Math.round(activeRates.reduce((sum, rate) => sum + rate, 0) / activeRates.length) : 0;
  const successful = scooped.meat + scooped.veg + scooped.oil + scooped.boneHits;
  const attempts = successful + scooped.fail;
  const correctRate = attempts ? Math.round(successful / attempts * 100) : 0;
  const errorRate = attempts ? Math.round(scooped.fail / attempts * 100) : 0;
  const clearedAll = particles.length === 0;
  const missionWon = challengeRule === 'clear' ? clearedAll : challengeRule === 'perfect' ? reason !== 'mistake' : null;
  cleanlinessEl.textContent = `${cleanliness}%`;

  let newRecord = false;
  let recordScore = Number(stageRecords[currentStageId]) || 0;
  if (gameMode === 'challenge' && !isDailyChallenge && challengeRule === 'score' && score > recordScore) {
    recordScore = score;
    stageRecords[currentStageId] = score;
    bestScore = Math.max(bestScore, score);
    saveStageRecords();
    saveBestScore(bestScore);
    newRecord = true;
  }
  updateStageRecordDisplay();
  personalBestEl.textContent = gameMode === 'practice'
    ? '練習模式不列入關卡最高分。'
    : isDailyChallenge
      ? `每日挑戰種子 ${formatSeed(dailyChallengeSeed)}｜不覆蓋一般關卡紀錄。`
      : challengeRule === 'score'
        ? `${newRecord ? '本關新紀錄！' : '本關最高分'} ${recordScore}`
        : '此挑戰規則不計入限時衝分紀錄。';
  resultLabel.textContent = gameMode === 'practice'
    ? `練習模式｜${BROTHS[brothId].name}｜不限時`
    : isDailyChallenge
      ? `每日固定盤面｜${dailyChallengeDate} · ${BROTHS[brothId].name} · 種子 ${formatSeed(dailyChallengeSeed)}`
      : `挑戰關卡｜${activeStage.name} · ${RULES[challengeRule].name} · ${BROTHS[brothId].name} · ${Math.round(activeDurationMs / 1000)} 秒`;
  resultStats.innerHTML = `
    <div>🥩 肉沫撈起：<strong>${scooped.meat}</strong> 份｜清除率 <strong>${categoryRates.meat ?? 0}%</strong></div>
    <div>🥦 蔬菜撈起：<strong>${scooped.veg}</strong> 塊｜清除率 <strong>${categoryRates.veg ?? 0}%</strong></div>
    <div>🟡 浮油撈起：<strong>${scooped.oil}</strong> 團｜清除率 <strong>${categoryRates.oil ?? 0}%</strong></div>
    <div>🦴 骨頭完成：<strong>${scooped.bone}</strong> 塊（成功撈取 ${scooped.boneHits} 次）｜清除率 <strong>${categoryRates.bone ?? 0}%</strong></div>
    <div>🫧 鍋中剩餘：<strong>${remaining}</strong> 份食材</div>
    <div>🎯 工具正確率：<strong>${correctRate}%</strong>｜❌ 失誤率：<strong>${errorRate}%</strong>（${scooped.fail} 次）</div>
    <div>🥣 帶走湯汁估算：<strong>${Math.round(soupLossMl)} mL</strong></div>
    <div>❄️ 冷藏凝油：<strong>${chillUsed ? '已使用' : '未使用'}</strong></div>
  `;

  const newlyUnlocked = unlockAchievementsForRun({ cleanliness, correctRate, attempts, successful, totalSoupLoss: soupLossMl });
  if (gameMode === 'practice') resultComment.textContent = '練習完成！可以換湯底、規則與工具再試；冷藏效果和冷卻時間都會依時間計算。';
  else if (challengeRule === 'clear') resultComment.textContent = missionWon ? '全清成功！整鍋食材都已清乾淨。' : `全清挑戰未完成，還有 ${remaining} 份食材留在鍋中。`;
  else if (challengeRule === 'perfect') resultComment.textContent = missionWon ? '無失誤完成！全程都選對工具。' : '挑戰結束：出現工具失誤，試著看清食材後再下手。';
  else if (cleanliness >= 75) resultComment.textContent = '湯底清得很漂亮！眼力和工具都掌握得很好。';
  else if (score >= 160) resultComment.textContent = '撈得不錯，再留意鍋裡還有哪些食材。';
  else if (score >= 80) resultComment.textContent = '已經上手了，試著更快切換到合適的工具。';
  else resultComment.textContent = '再試一次，先用濾網清理肉沫，再處理蔬菜和浮油。';
  if (newlyUnlocked.length) resultComment.textContent += ` 新解鎖：${newlyUnlocked.join('、')}！`;
  shareBtn.classList.toggle('hidden', !isDailyChallenge);
  showScreen('result');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(screen => screen.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function updateMenuDescriptions() {
  const stage = STAGES[stageSelect.value] || STAGES.home;
  const rule = RULES[ruleSelect.value] || RULES.score;
  const broth = BROTHS[brothSelect.value] || BROTHS.clear;
  stageDescription.textContent = `${stage.description} 食材：肉沫 ${stage.counts.meat}、蔬菜 ${stage.counts.veg}、浮油 ${stage.counts.oil}、骨頭 ${stage.counts.bone}。`;
  ruleDescription.textContent = ruleSelect.value === 'clear'
    ? `${rule.description} 時間加長為此關卡的 3 倍。`
    : rule.description;
  brothDescription.textContent = broth.description;
  document.getElementById('startBtn').textContent = `開始${rule.name}（${Math.round(stage.durationMs * (ruleSelect.value === 'clear' ? 3 : 1) / 1000)} 秒）`;
  updateStageRecordDisplay();
  const daily = dailyChallengeDescriptor();
  document.getElementById('dailyBtn').textContent = daily.shared
    ? `挑戰分享盤面｜${daily.date}｜${formatSeed(daily.seed)}`
    : `今日固定盤面挑戰｜${daily.date}`;
}

async function shareDailyChallenge() {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('daily', dailyChallengeDate);
  url.searchParams.set('seed', String(dailyChallengeSeed));
  url.searchParams.set('score', String(score));
  const text = `我在火鍋湯底過濾挑戰拿到 ${score} 分（${dailyChallengeDate}，${BROTHS[brothId].name}）。來挑戰同一盤：${url.toString()}`;
  try {
    await navigator.clipboard.writeText(text);
    shareBtn.textContent = '已複製每日挑戰連結！';
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    shareBtn.textContent = copied ? '已複製每日挑戰連結！' : '複製失敗，請從網址列分享此盤面。';
  }
  window.setTimeout(() => { shareBtn.textContent = '複製每日挑戰分享連結'; }, 2400);
}

function resetLocalRecords() {
  if (!window.confirm('確定清除所有關卡本機最高分？成就與外觀解鎖會保留。')) return;
  stageRecords = {};
  bestScore = 0;
  try {
    window.localStorage.removeItem(STAGE_RECORDS_KEY);
    window.localStorage.removeItem(BEST_SCORE_KEY);
  } catch { /* Clearing unavailable storage does not affect the current session. */ }
  bestScoreMenuEl.textContent = '0';
  const button = document.getElementById('resetRecordsBtn');
  button.textContent = '已清除本機最高分';
  window.setTimeout(() => { button.textContent = '清除本機紀錄'; }, 2200);
}

// Menu and game controls.
document.getElementById('startBtn').addEventListener('click', () => startGame('challenge'));
document.getElementById('dailyBtn').addEventListener('click', () => startGame('challenge', true));
document.getElementById('practiceBtn').addEventListener('click', () => startGame('practice'));
document.getElementById('howToBtn').addEventListener('click', () => showScreen('howto'));
document.getElementById('backMenu').addEventListener('click', () => showScreen('menu'));
document.getElementById('resetRecordsBtn').addEventListener('click', resetLocalRecords);
shareBtn.addEventListener('click', shareDailyChallenge);
document.querySelectorAll('.tool').forEach(button => {
  button.addEventListener('click', () => selectTool(button.dataset.tool));
});
chillBtn.addEventListener('click', activateChillMethod);
[stageSelect, ruleSelect, brothSelect].forEach(select => select.addEventListener('change', updateMenuDescriptions));
contrastToggle.addEventListener('change', () => {
  highContrast = contrastToggle.checked;
  document.documentElement.classList.toggle('high-contrast', highContrast);
  saveSettings();
});
motionToggle.addEventListener('change', () => {
  reduceMotion = motionToggle.checked;
  document.documentElement.classList.toggle('reduce-motion', reduceMotion);
  saveSettings();
});
document.getElementById('soundToggle').addEventListener('change', event => {
  soundEnabled = event.target.checked;
  saveSettings();
  if (soundEnabled) playSound('scoop');
});
skinSelect.addEventListener('change', () => {
  selectedSkin = skinSelect.value in POT_SKINS ? skinSelect.value : 'steel';
  saveSettings();
  if (running) {
    drawSoup(performance.now());
    drawParticles(performance.now());
    drawTool();
  }
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

window.addEventListener('keydown', event => {
  if (document.getElementById('game').classList.contains('hidden')) return;
  const key = event.key.toLowerCase();
  if (key === 'p') {
    event.preventDefault();
    running ? pauseGame() : resumeGame();
    return;
  }
  if (!running) return;
  const tools = ['spoon', 'holey', 'strainer'];
  if (/^[1-3]$/.test(key)) {
    event.preventDefault();
    selectTool(tools[Number(key) - 1]);
    return;
  }
  const delta = Math.min(42, Math.max(24, Math.min(canvasWidth, canvasHeight) * .08));
  const directions = {
    arrowleft: [-delta, 0], a: [-delta, 0], arrowright: [delta, 0], d: [delta, 0],
    arrowup: [0, -delta], w: [0, -delta], arrowdown: [0, delta], s: [0, delta]
  };
  if (directions[key]) {
    event.preventDefault();
    mouse.x = Math.max(0, Math.min(canvasWidth, mouse.x + directions[key][0]));
    mouse.y = Math.max(0, Math.min(canvasHeight, mouse.y + directions[key][1]));
    return;
  }
  if (key === ' ' || key === 'enter') {
    event.preventDefault();
    tryScoop();
  }
});

pauseBtn.addEventListener('click', () => running ? pauseGame() : resumeGame());
document.getElementById('endBtn').addEventListener('click', () => endGame('manual'));
document.getElementById('retryBtn').addEventListener('click', () => startGame(gameMode, isDailyChallenge));
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

updateMenuDescriptions();
showScreen('menu');
