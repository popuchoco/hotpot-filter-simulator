// Game state, input, UI, persistence, and score flow; rendering/physics are separate scripts.
if (typeof drawSoup !== 'function' || typeof drawParticles !== 'function' || typeof updatePhysics !== 'function') {
  throw new Error('Game scripts are missing or out of order: load renderer.js and physics.js before game.js.');
}
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
const PREVIOUS_RESULTS_KEY = 'hotpot-filter-simulator.previous-results.v1';
const ACHIEVEMENTS_KEY = 'hotpot-filter-simulator.achievements.v1';
const SETTINGS_KEY = 'hotpot-filter-simulator.settings.v1';
const CHILL_PRACTICE_COOLDOWN_MS = 25_000;
const CHILL_EFFECT_MS = 14_000;
const BOIL_CYCLE_MS = 14_000;
const BOIL_DURATION_MS = 3_800;
const FRAME_SCALE_MAX = 2;
const SCORE_PER_RADIUS = 1.8;
const SCORE_BASE = 3;
const BONE_SCORE_BONUS = 18;
const BIG_PARTICLE_RADIUS = 20;
const BIG_OIL_SCORE_MULTIPLIER = 1.7;
const BIG_VEG_SCORE_MULTIPLIER = 1.3;
const CHILLED_OIL_SCORE_MULTIPLIER = 1.25;
const VEG_SOUP_LOSS_MULTIPLIER = 1.5;
const SPOON_STREAK_SOUP_LOSS_INCREMENT = .25;
const SPOON_STREAK_WINDOW_MS = 2_000;
const SPOON_STREAK_MAX = 4;
const PARTICLE_RENDER_TYPES = Object.freeze(['oil', 'meat', 'veg', 'bone', 'debris']);
const WRONG_TOOL_REMOVE_CHANCE = .45;
const WRONG_TOOL_PENALTY_PER_RADIUS = .8;
const WRONG_TOOL_BASE_PENALTY = 2;
const WRONG_TOOL_SOUP_LOSS_ML = 2;
const SOUP_LOSS_CAP_ML = 5_000;
const OIL_GRID_CELL_SIZE = 64;
const OIL_MERGE_BASE_RATE = .035;
const OIL_MERGE_RATE_CAP = .12;
const OIL_MERGE_BOIL_MULTIPLIER = 1.8;
const OIL_MERGE_CAP = 43;
const OIL_PARTICLE_RADIUS_CAP = 34;
const OIL_MERGE_DISTANCE_FACTOR = .9;
const OIL_ATTRACTION_FORCE = .012;
const OIL_ATTRACTION_RANGE_FACTOR = 1.35;
const OIL_ATTRACTION_BOIL_MULTIPLIER = 1.6;
const BOIL_FLOW_FORCE = .028;
const BOIL_RADIAL_FORCE_RATIO = .16;
const MAX_PARTICLE_SPEED = 1.5;
const BOUNDARY_REFLECTION_MULTIPLIER = 1.7;
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
    name: '麻辣', description: '沸騰較快、湯流更強；辣椒片會隨湯流漂散，細網較好處理。',
    colors: ['#ffd193', '#ed9560', '#c95637', '#792c22'],
    flow: 1.55, aggregation: 1.45, boilFactor: 1.3, flowColor: 'rgba(255,216,157,.48)'
  },
  miso: {
    name: '味噌', description: '湯流較緩、油花聚集較慢；豆渣顆粒容易混在食材間，適合用細網。',
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
  { id: 'daily', name: '每日鍋友', description: '完成當日固定盤面挑戰；舊日期分享盤不計入。' },
  { id: 'steady', name: '穩手撈料', description: '連續 5 次正確撈取，中途沒有工具失誤。' }
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
    name: '細網撈沫勺', radius: 30, types: ['meat', 'debris'], scoreMultiplier: 1.1,
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
let lastFrameTime = null;
let running = false;
let gameEnded = false;
let particles = [];
let particleGroups = createParticleGroups();
let canvasWidth = 0;
let canvasHeight = 0;
let pixelRatio = 1;
let bestScore = loadBestScore();
let stageRecords = loadStageRecords();
let previousResults = loadPreviousResults();
let unlockedAchievements = loadAchievements();
const mouse = { x: 0, y: 0 };
let gameMode = 'challenge';
let challengeRule = 'score';
let brothId = 'clear';
let isDailyChallenge = false;
let dailyChallengeSeed = null;
let dailyChallengeDate = '';
let sharedDailyChallenge = false;
let isTodayDailyChallenge = false;
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
let scooped = { meat: 0, veg: 0, oil: 0, bone: 0, debris: 0, boneHits: 0, fail: 0 };
let initialMass = { meat: 0, veg: 0, oil: 0, bone: 0, debris: 0 };
let removedMass = { meat: 0, veg: 0, oil: 0, bone: 0, debris: 0 };
let simulationTimeMs = 0;
let correctActionStreak = 0;
let brothDebrisSpawned = 0;
let boilingNow = false;
let reduceMotion = false;
let highContrast = false;
let soundEnabled = false;
let audioContext = null;
let lastCountdownSecond = null;
let spoonStreak = 0;
let lastSpoonUse = null;
let selectedSkin = 'steel';

function createParticleGroups() {
  return Object.fromEntries(PARTICLE_RENDER_TYPES.map(type => [type, []]));
}

function refreshParticleGroups() {
  const groups = createParticleGroups();
  for (const particle of particles) groups[particle.type]?.push(particle);
  particleGroups = groups;
}

bestScoreMenuEl.textContent = bestScore;
initializeSettings();
renderAchievements();
updateStageRecordDisplay();

function loadJSON(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? fallback : JSON.parse(stored) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}

function loadBestScore() {
  const value = Number(loadJSON(BEST_SCORE_KEY, 0));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function saveBestScore(value) {
  saveJSON(BEST_SCORE_KEY, value);
}

function loadStageRecords() {
  const parsed = loadJSON(STAGE_RECORDS_KEY, {});
  const records = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  if (!Object.keys(records).length && bestScore > 0) records.home = bestScore;
  return records;
}

function saveStageRecords() {
  saveJSON(STAGE_RECORDS_KEY, stageRecords);
}

function loadPreviousResults() {
  const parsed = loadJSON(PREVIOUS_RESULTS_KEY, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function savePreviousResults() {
  saveJSON(PREVIOUS_RESULTS_KEY, previousResults);
}

function loadAchievements() {
  const parsed = loadJSON(ACHIEVEMENTS_KEY, []);
  return Array.isArray(parsed) ? parsed.filter(id => ACHIEVEMENTS.some(item => item.id === id)) : [];
}

function saveAchievements() {
  saveJSON(ACHIEVEMENTS_KEY, unlockedAchievements);
}

function initializeSettings() {
  const storedSettings = loadJSON(SETTINGS_KEY, {});
  const settings = storedSettings && typeof storedSettings === 'object' && !Array.isArray(storedSettings) ? storedSettings : {};
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
  saveJSON(SETTINGS_KEY, { highContrast, reduceMotion, soundEnabled, skin: selectedSkin });
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
    daily: isTodayDailyChallenge
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

function unlockAchievement(id, notify = true) {
  const achievement = ACHIEVEMENTS.find(item => item.id === id);
  if (!achievement || unlockedAchievements.includes(id)) return false;
  unlockedAchievements.push(id);
  saveAchievements();
  renderAchievements();
  if (notify) showAchievementToast(`🏅 成就解鎖：${achievement.name}`);
  return true;
}

function showAchievementToast(message) {
  hintEl.textContent = message;
  hintEl.classList.add('achievement-toast');
  clearTimeout(showHint.timer);
  showHint.timer = window.setTimeout(() => {
    hintEl.classList.remove('achievement-toast');
    if (hintEl.textContent === message) hintEl.textContent = '';
  }, 3_500);
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

function formatDailyDate(value) {
  return /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value;
}

function seedSuffix(seed) {
  return formatSeed(seed).slice(-4).toUpperCase();
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
  initialMass = { meat: 0, veg: 0, oil: 0, bone: 0, debris: 0 };
  removedMass = { meat: 0, veg: 0, oil: 0, bone: 0, debris: 0 };
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

  // Broth-specific debris starts sparse and may drift in during later boil events.
  brothDebrisSpawned = 0;
  spawnBrothDebris(currentStageId === 'feast' ? 7 : 4);
  refreshParticleGroups();
}

function spawnBrothDebris(requestedCount = 1) {
  const debrisKind = brothId === 'mala' ? 'chili' : brothId === 'miso' ? 'miso' : null;
  if (!debrisKind) return 0;
  const count = Math.min(requestedCount, 10 - brothDebrisSpawned);
  for (let i = 0; i < count; i++) {
    const pos = randomPosition(12);
    particles.push({
      ...pos,
      r: debrisKind === 'chili' ? 7 + random() * 4 : 6 + random() * 3,
      type: 'debris',
      debrisKind,
      name: debrisKind === 'chili' ? '辣椒片' : '味噌豆渣',
      units: 1,
      mass: 1,
      vx: (random() - .5) * .22,
      vy: (random() - .5) * .22,
      rotation: random() * Math.PI
    });
    initialMass.debris += 1;
    brothDebrisSpawned++;
  }
  return count;
}

function updateCounts() {
  meatCountEl.textContent = scooped.meat;
  vegCountEl.textContent = scooped.veg;
  oilCountEl.textContent = scooped.oil;
  document.getElementById('boneCount').textContent = scooped.bone;
  document.getElementById('debrisCount').textContent = scooped.debris;
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
    spoonStreak = lastSpoonUse !== null && now - lastSpoonUse <= SPOON_STREAK_WINDOW_MS ? Math.min(SPOON_STREAK_MAX, spoonStreak + 1) : 1;
    lastSpoonUse = now;
  } else {
    spoonStreak = 0;
    lastSpoonUse = null;
  }

  let gained = 0;
  let lost = 0;
  const remove = new Set();
  let successfulActions = 0;
  const failuresBeforeScoop = scooped.fail;
  let crackedBone = false;
  caught.forEach((p, i) => {
    const good = isGoodToolFor(p, now);
      const isBig = p.r > BIG_PARTICLE_RADIUS;
    if (good) {
      let points = Math.round(p.r * SCORE_PER_RADIUS + SCORE_BASE);
      if (p.type === 'bone') points += BONE_SCORE_BONUS;
      if (p.type === 'oil' && isBig) points = Math.round(points * BIG_OIL_SCORE_MULTIPLIER);
      if (p.type === 'veg' && isBig) points = Math.round(points * BIG_VEG_SCORE_MULTIPLIER);
      if (p.type === 'oil' && isOilChilled(now)) points = Math.round(points * CHILLED_OIL_SCORE_MULTIPLIER);
      gained += Math.round(points * tool.scoreMultiplier);
      const spoonPenalty = currentTool === 'spoon' ? 1 + spoonStreak * SPOON_STREAK_SOUP_LOSS_INCREMENT : 1;
      soupLossMl = Math.min(SOUP_LOSS_CAP_ML, soupLossMl + tool.soupLossMl * (p.type === 'veg' ? VEG_SOUP_LOSS_MULTIPLIER : 1) * spoonPenalty);
      successfulActions++;
      if (p.type === 'bone') scooped.boneHits++;
      if (p.type === 'bone' && p.integrity > 1) {
        p.integrity--;
        crackedBone = true;
        showHint('骨頭較大，要用有洞湯勺再撈一次！');
      } else {
        scooped[p.type]++;
        remove.add(indices[i]);
        removedMass[p.type] += p.mass || 1;
      }
    } else {
      lost += Math.round(p.r * WRONG_TOOL_PENALTY_PER_RADIUS + WRONG_TOOL_BASE_PENALTY);
      scooped.fail++;
      if (random() < WRONG_TOOL_REMOVE_CHANCE) {
        remove.add(indices[i]);
        removedMass[p.type] += p.mass || 1;
        soupLossMl = Math.min(SOUP_LOSS_CAP_ML, soupLossMl + WRONG_TOOL_SOUP_LOSS_ML);
      }
    }
  });

  [...remove].sort((a, b) => b - a).forEach(index => particles.splice(index, 1));
  if (remove.size) refreshParticleGroups();
  score = Math.max(0, score + gained - lost);
  scoreEl.textContent = score;
  updateCounts();

  playSound(lost > 0 ? 'fail' : crackedBone ? 'boneCrack' : 'scoop');
  if (gained > lost) {
    const bigBonus = caught.some(p => p.r > BIG_PARTICLE_RADIUS && isGoodToolFor(p, now));
    const coldBonus = caught.some(p => p.type === 'oil' && isOilChilled(now) && isGoodToolFor(p, now));
    showHint(coldBonus ? `凝固油花撈起！細網很合適 +${gained - lost}` : bigBonus ? `大塊撈起！${tool.name} +${gained - lost}` : `撈取成功 +${gained - lost}`);
  } else {
    showHint(`工具不合適，漏掉了… -${lost - gained}`);
  }
  if (currentTool === 'spoon' && spoonStreak >= 2) showHint(`湯匙連續使用，帶走湯汁增加 ${Math.round(spoonStreak * 25)}%`);
  if (scooped.fail === failuresBeforeScoop && successfulActions > 0) {
    correctActionStreak++;
    if (correctActionStreak >= 5) unlockAchievement('steady');
    else if (correctActionStreak >= 3) showHint(`連續正確撈取 ${correctActionStreak}/5，再穩穩撈兩次！`);
  } else if (scooped.fail > failuresBeforeScoop) {
    correctActionStreak = 0;
  }
  updateToolTip();
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
  const spoonNote = currentTool === 'spoon' ? ` 普通湯匙連續撈取 ${spoonStreak} 次；繼續使用會增加帶走的湯汁（切換工具會歸零）。` : '';
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
  if (toolId !== 'spoon') {
    spoonStreak = 0;
    lastSpoonUse = null;
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
  hintEl.classList.remove('achievement-toast');
  hintEl.textContent = message;
  clearTimeout(showHint.timer);
  showHint.timer = setTimeout(() => {
    if (hintEl.textContent === message) hintEl.textContent = '';
  }, 1500);
}

function prepareAudioContextFromGesture() {
  if (!soundEnabled) return false;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    audioContext ||= new AudioContextClass();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

function unlockAudioFromGesture() {
  if (!prepareAudioContextFromGesture()) return;
  window.removeEventListener('pointerdown', unlockAudioFromGesture, true);
  window.removeEventListener('keydown', unlockAudioFromGesture, true);
}

function playSound(kind) {
  if (!soundEnabled || !audioContext) return;
  try {
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    const notes = kind === 'scoop' ? [660, 880]
      : kind === 'chill' ? [520, 740, 980]
        : kind === 'tick' ? [420]
          : kind === 'boil' ? [300, 360]
            : kind === 'boneCrack' ? [240, 420]
            : [190, 140];
    notes.forEach((frequency, index) => {
      const start = audioContext.currentTime + index * .075;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = ['fail', 'boneCrack'].includes(kind) ? 'triangle' : 'sine';
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
    ? `🔥 ${broth.name}沸騰湯流！食材移動加快，油花更容易聚集${brothId === 'mala' ? '，辣椒片也會漂散' : brothId === 'miso' ? '，豆渣顆粒隨湯流散開' : ''}`
    : `${broth.name}湯面平穩｜留意下一波沸騰湯流${brothId === 'miso' ? '；豆渣顆粒混在食材間' : ''}`;
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

  const elapsedMs = lastFrameTime === null ? 0 : Math.max(0, now - lastFrameTime);
  const frameScale = lastFrameTime === null ? 1 : Math.min(FRAME_SCALE_MAX, elapsedMs / (1000 / 60));
  lastFrameTime = now;
  // Event cadence follows active wall-clock time; physics still caps large frame steps.
  simulationTimeMs += elapsedMs;
  const wasBoiling = boilingNow;
  boilingNow = currentBoilState();
  if (boilingNow !== wasBoiling) {
    updateEventDisplay();
    if (boilingNow) {
      playSound('boil');
      spawnBrothDebris(1);
    }
  }
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
  sharedDailyChallenge = Boolean(dailyInfo?.shared);
  isTodayDailyChallenge = isDailyChallenge && dailyChallengeDate === dailyDateTaipei();
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
  simulationTimeMs = 0;
  boilingNow = false;
  spoonStreak = 0;
  lastSpoonUse = null;
  lastCountdownSecond = null;
  scooped = { meat: 0, veg: 0, oil: 0, bone: 0, debris: 0, boneHits: 0, fail: 0 };
  correctActionStreak = 0;
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
  if (boilingNow) playSound('boil');
  updateMethodDisplay();
  lastFrameTime = performance.now();
  canvas.focus({ preventScroll: true });
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(loop);
  if (mode === 'practice') hintEl.textContent = '先辨認食材，再選工具；骨頭要用有洞湯勺撈兩次。';
  else if (isDailyChallenge) hintEl.textContent = `${sharedDailyChallenge ? `分享盤面（原始日期 ${formatDailyDate(dailyChallengeDate)}）` : `今日固定盤面｜${formatDailyDate(dailyChallengeDate)}`}｜${BROTHS[brothId].name}｜種子尾碼 #${seedSuffix(dailyChallengeSeed)}。分享連結讓朋友玩同一盤！`;
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
  lastFrameTime = null;
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
  lastFrameTime = now;
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

function formatCategoryCleanliness(type, label) {
  const rate = getCategoryCleanliness(type);
  return rate === null ? `本關無${label}` : `${rate}%`;
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
  const categoryRates = Object.fromEntries(['meat', 'veg', 'oil', 'bone', 'debris'].map(type => [type, getCategoryCleanliness(type)]));
  const activeRates = Object.values(categoryRates).filter(rate => rate !== null);
  // No initial target means nothing was left dirty; do not penalize an absent category.
  const cleanliness = activeRates.length ? Math.round(activeRates.reduce((sum, rate) => sum + rate, 0) / activeRates.length) : 100;
  const successful = scooped.meat + scooped.veg + scooped.oil + scooped.boneHits + scooped.debris;
  const attempts = successful + scooped.fail;
  const correctRate = attempts ? Math.round(successful / attempts * 100) : 0;
  const errorRate = attempts ? Math.round(scooped.fail / attempts * 100) : 0;
  const clearedAll = particles.length === 0;
  const missionWon = challengeRule === 'clear' ? clearedAll : challengeRule === 'perfect' ? reason !== 'mistake' : null;
  cleanlinessEl.textContent = activeRates.length ? `${cleanliness}%` : '100%（無清除目標）';

  let newRecord = false;
  let recordScore = Number(stageRecords[currentStageId]) || 0;
  const previousBestScore = recordScore;
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
      ? `${sharedDailyChallenge ? '分享盤面' : '每日固定盤面'}｜原始日期 ${formatDailyDate(dailyChallengeDate)} · ${BROTHS[brothId].name} · 種子尾碼 #${seedSuffix(dailyChallengeSeed)}`
      : `挑戰關卡｜${activeStage.name} · ${RULES[challengeRule].name} · ${BROTHS[brothId].name} · ${Math.round(activeDurationMs / 1000)} 秒`;
  const resultKey = `${currentStageId}:${challengeRule}:${brothId}`;
  const previousRun = gameMode === 'challenge' && !isDailyChallenge ? previousResults[resultKey] : null;
  const bestCompare = gameMode === 'challenge' && !isDailyChallenge && challengeRule === 'score'
    ? previousBestScore > 0 ? `📈 與本關最高分相比：<strong>${score >= previousBestScore ? '+' : ''}${score - previousBestScore}</strong> 分` : score > 0 ? '📈 本局建立本關第一筆分數紀錄' : '📈 尚未取得分數'
    : '';
  const soupCompare = previousRun
    ? (() => {
      const improvement = Math.round(previousRun.soupLoss - soupLossMl);
      return improvement > 0 ? `🥣 比上次少帶走 <strong>${improvement} mL</strong> 湯汁`
        : improvement < 0 ? `🥣 比上次多帶走 <strong>${Math.abs(improvement)} mL</strong> 湯汁`
          : '🥣 帶走湯汁量與上次相同';
    })()
    : '';
  resultStats.innerHTML = `
    <div>🥩 肉沫撈起：<strong>${scooped.meat}</strong> 份｜清除率 <strong>${formatCategoryCleanliness('meat', '肉沫')}</strong></div>
    <div>🥦 蔬菜撈起：<strong>${scooped.veg}</strong> 塊｜清除率 <strong>${formatCategoryCleanliness('veg', '蔬菜')}</strong></div>
    <div>🟡 浮油撈起：<strong>${scooped.oil}</strong> 團｜清除率 <strong>${formatCategoryCleanliness('oil', '浮油')}</strong></div>
    <div>🦴 骨頭完成：<strong>${scooped.bone}</strong> 塊（成功撈取 ${scooped.boneHits} 次）｜清除率 <strong>${formatCategoryCleanliness('bone', '骨頭')}</strong></div>
    <div>🌶️ 雜料撈起：<strong>${scooped.debris}</strong> 份｜清除率 <strong>${formatCategoryCleanliness('debris', '雜料')}</strong></div>
    <div>🫧 鍋中剩餘：<strong>${remaining}</strong> 份食材</div>
    <div>🎯 工具正確率：<strong>${correctRate}%</strong>｜❌ 失誤率：<strong>${errorRate}%</strong>（${scooped.fail} 次）</div>
    <div>🥣 帶走湯汁估算：<strong>${Math.round(soupLossMl)} mL</strong></div>
    <div>❄️ 冷藏凝油：<strong>${chillUsed ? '已使用' : '未使用'}</strong></div>
    ${bestCompare ? `<div>${bestCompare}</div>` : ''}
    ${soupCompare ? `<div>${soupCompare}</div>` : ''}
  `;

  if (gameMode === 'challenge' && !isDailyChallenge) {
    previousResults[resultKey] = { score, soupLoss: soupLossMl, finishedAt: Date.now() };
    savePreviousResults();
  }

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
  document.getElementById('stageRecommendation').textContent = unlockedAchievements.includes('first')
    ? '推薦：想放慢節奏可先練習；熟悉工具後，再挑戰熱鬧滿鍋或更嚴格規則。'
    : '初次遊玩建議先選「新手小鍋」或「練習辨認」；關卡不鎖定，可自由嘗試。';
  updateStageRecordDisplay();
  const daily = dailyChallengeDescriptor();
  const dailyBroth = BROTHS[['clear', 'mala', 'miso'][daily.seed % 3]];
  document.getElementById('dailyBtn').textContent = daily.shared
    ? `挑戰分享盤面｜${formatDailyDate(daily.date)} · ${dailyBroth.name} · #${seedSuffix(daily.seed)}`
    : `今日固定盤面｜${formatDailyDate(daily.date)} · ${dailyBroth.name} · #${seedSuffix(daily.seed)}`;
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
  if (!window.confirm('確定清除所有關卡最高分與上次比較紀錄？成就與外觀解鎖會保留。')) return;
  stageRecords = {};
  previousResults = {};
  bestScore = 0;
  try {
    window.localStorage.removeItem(STAGE_RECORDS_KEY);
    window.localStorage.removeItem(BEST_SCORE_KEY);
    window.localStorage.removeItem(PREVIOUS_RESULTS_KEY);
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
  if (soundEnabled && prepareAudioContextFromGesture()) playSound('scoop');
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
// AudioContext is created only after a real user gesture, and only when sound is enabled.
window.addEventListener('pointerdown', unlockAudioFromGesture, true);
window.addEventListener('keydown', unlockAudioFromGesture, true);
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
