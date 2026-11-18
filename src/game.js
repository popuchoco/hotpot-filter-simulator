// Game state, input, UI, persistence, and score flow.
import * as CONFIG from './config.js';
import { drawParticles, drawSoup, drawTool, drawVisualEffects } from './renderer.js';
import { updatePhysics } from './physics.js';
import { rescaleParticles } from './geometry.js';
import {
  achievementConditions, allFoodCorrectlyRemoved, applySoupLoss, boilStateAt, categoryCleanliness, getHitParticles,
  clearRuleDurationMs, comboMultiplier, getScoopTargets, isEligibleDailyChallenge, isGoodToolFor,
  loseLife, missionSuccess, nextCombo, noLivesRemaining, overallCleanliness,
  parseFriendScore, perfectClearOutcome, resultComment as gradeResultComment, scoopDecision, scoreParticle, soupLossForParticle,
  waveClearBonus, wrongToolPenalty
} from './rules.js';
import { dailyChallengeDescriptor as parseDailyChallengeDescriptor, dailyDateTaipei, formatSeed, hashSeed, mulberry32 } from './rng.js';
import {
  MAX_DEBRIS_PER_WAVE, PRACTICE_WAVES_ENABLED, WAVE_SPAWN_INWARD_SPEED,
} from './balance.js';
import { createWaveRng, createWaveState, isFadingIn, nextWaveDecision, waveComposition, waveSpawnPositions } from './waves.js';
import { addVisualEffect } from './visual-effects.js';
import { fireLevelAudioSettings, quantizeFireLevel, shouldRetargetAmbience } from './audio.js';
import { heatLevelAt } from './rendering.js';

document.documentElement.style.setProperty(
  '--canvas-max-display-size', `${CONFIG.CANVAS_MAX_DISPLAY_SIZE}px`
);

const {
  ACHIEVEMENTS, ACHIEVEMENTS_KEY, BEST_SCORE_KEY, BIG_PARTICLE_RADIUS,
  BROTHS, CHILL_COST_MS, CHILL_EFFECT_MS, CHILL_PRACTICE_COOLDOWN_MS, FRAME_SCALE_MAX,
  PARTICLE_RENDER_TYPES, POT_SKINS, PRACTICE_STAGE, PREVIOUS_RESULTS_KEY, RULES,
  SETTINGS_KEY, SPOON_STREAK_MAX, SPOON_STREAK_WINDOW_MS, STAGE_RECORDS_KEY,
  STAGES, TOOL_CONFIG, WRONG_TOOL_SOUP_LOSS_ML
} = CONFIG;
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
const friendScoreMenuEl = document.getElementById('friendScoreMenu');
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
const practiceWavesToggle = document.getElementById('practiceWavesToggle');

const renderedText = new WeakMap();
const renderedAttributes = new WeakMap();

function setText(element, value) {
  const text = String(value);
  if (!renderedText.has(element)) renderedText.set(element, element.textContent);
  const previous = renderedText.get(element);
  if (previous === text) return false;
  element.textContent = text;
  renderedText.set(element, text);
  return true;
}

function setAttr(element, name, value) {
  const rendered = renderedAttributes.get(element) ?? new Map();
  renderedAttributes.set(element, rendered);
  const next = String(value);
  const previous = rendered.has(name) ? rendered.get(name) : element.getAttribute(name);
  if (previous === next) return false;
  element.setAttribute(name, next);
  rendered.set(name, next);
  renderedAttributes.set(element, rendered);
  return true;
}

function setDisabled(element, disabled) {
  if (element.disabled === disabled) return false;
  element.disabled = disabled;
  return true;
}

function setClass(element, name, enabled) {
  if (element.classList.contains(name) === enabled) return false;
  element.classList.toggle(name, enabled);
  return true;
}

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
const visualEffects = [];
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
let seededRandom = null;
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
let waveEnabled = false;
let waveState = null;
let waveRandom = null;
let wavesSpawned = 0;
let waveInitialUnits = 0;
let maxCombo = 0;
let combo = 0;
let lastComboSuccessMs = null;
let waveClears = 0;
let potEmptyMs = 0;
let potHadNoScoopableUnits = false;
let correctActionStreak = 0;
let boilingNow = false;
let reduceMotion = false;
let highContrast = false;
let soundEnabled = false;
let practiceWavesEnabled = PRACTICE_WAVES_ENABLED;
let audioContext = null;
let simmerSource = null;
let simmerGain = null;
let simmerTargets = null;
let lastCountdownSecond = null;
let spoonStreak = 0;
let lastSpoonUse = null;
let lives = CONFIG.PERFECT_LIVES;
let perfectClearBonusScore = 0;
let successfulScoops = 0;
let scoopAttempts = 0;
let playedMs = 0;
let lastPlayTime = null;
let selectedSkin = 'steel';
let endReason = null;
let lastResult = null;
let lastMethodDisplay = null;
let lastTimerFillScale = null;

function createParticleGroups() {
  return Object.fromEntries(PARTICLE_RENDER_TYPES.map(type => [type, []]));
}

function refreshParticleGroups() {
  const groups = createParticleGroups();
  for (const particle of particles) groups[particle.type]?.push(particle);
  particleGroups = groups;
}

function currentPotRadius() {
  return Math.min(canvasWidth, canvasHeight) * CONFIG.POT_RADIUS_RATIO;
}

setText(bestScoreMenuEl, bestScore);
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
  practiceWavesEnabled = Object.prototype.hasOwnProperty.call(settings, 'practiceWavesEnabled')
    ? Boolean(settings.practiceWavesEnabled)
    : PRACTICE_WAVES_ENABLED;
  selectedSkin = settings.skin && POT_SKINS[settings.skin] ? settings.skin : 'steel';
  contrastToggle.checked = highContrast;
  motionToggle.checked = reduceMotion;
  practiceWavesToggle.checked = practiceWavesEnabled;
  document.getElementById('soundToggle').checked = soundEnabled;
  document.documentElement.classList.toggle('high-contrast', highContrast);
  document.documentElement.classList.toggle('reduce-motion', reduceMotion);
  updateSkinOptions();
}

function saveSettings() {
  saveJSON(SETTINGS_KEY, { highContrast, reduceMotion, soundEnabled, practiceWavesEnabled, skin: selectedSkin });
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

function unlockAchievementsForRun({ cleanliness, correctRate, attempts, successful, successfulScoops: runSuccessfulScoops, playedMs: runPlayedMs, totalSoupLoss }) {
  const newlyUnlocked = [];
  const conditions = achievementConditions({
    cleanliness, correctRate, attempts, successful, successfulScoops: runSuccessfulScoops,
    playedMs: runPlayedMs, totalSoupLoss, isTodayDailyChallenge
  });
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
  setText(hintEl, message);
  hintEl.classList.add('achievement-toast');
  clearTimeout(showHint.timer);
  showHint.timer = window.setTimeout(() => {
    hintEl.classList.remove('achievement-toast');
    if (hintEl.textContent === message) setText(hintEl, '');
  }, 3_500);
}

function updateStageRecordDisplay() {
  const stageId = stageSelect.value in STAGES ? stageSelect.value : 'home';
  const record = Number(stageRecords[stageId]) || 0;
  setText(bestScoreMenuEl, record);
}

function updateFriendScoreDisplay() {
  const friendScore = parseFriendScore(new URLSearchParams(window.location.search).get('score'));
  setClass(friendScoreMenuEl, 'hidden', friendScore === null);
  if (friendScore !== null) setText(friendScoreMenuEl, `朋友分數 ${friendScore}`);
}

function formatDailyDate(value) {
  return /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value;
}

function seedSuffix(seed) {
  return formatSeed(seed).slice(-4).toUpperCase();
}

function dailyChallengeDescriptor() {
  return parseDailyChallengeDescriptor(window.location.search);
}

function random() {
  return seededRandom ? seededRandom() : Math.random();
}

function recordPlayedTime(now = performance.now()) {
  if (running && lastPlayTime !== null) playedMs += Math.max(0, now - lastPlayTime);
  lastPlayTime = now;
}

function resize() {
  const oldGeom = canvasWidth && canvasHeight ? {
    width: canvasWidth, height: canvasHeight, potRadius: currentPotRadius()
  } : null;
  const stageRect = canvas.parentElement.getBoundingClientRect();
  const displaySize = Math.floor(Math.min(stageRect.width, stageRect.height, CONFIG.CANVAS_MAX_DISPLAY_SIZE));
  if (!displaySize) return;
  canvas.style.width = `${displaySize}px`;
  canvas.style.height = `${displaySize}px`;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
  canvasWidth = rect.width;
  canvasHeight = rect.height;
  canvas.width = Math.round(canvasWidth * pixelRatio);
  canvas.height = Math.round(canvasHeight * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  if (oldGeom && particles.length) {
    particles = rescaleParticles(particles, oldGeom, {
      width: canvasWidth, height: canvasHeight, potRadius: currentPotRadius()
    });
    refreshParticleGroups();
  }
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

  // Wave zero preserves the existing opening debris; later pieces join boil-pulled waves.
  spawnBrothDebris(currentStageId === 'feast' ? 7 : 4, { maxCount: currentStageId === 'feast' ? 7 : 4 });
  refreshParticleGroups();
}

function spawnBrothDebris(requestedCount = 1, {
  randomValue = random, nextPosition = null, spawnedAtMs = null, waveIndex = null,
  maxCount = MAX_DEBRIS_PER_WAVE
} = {}) {
  const debrisKind = brothId === 'mala' ? 'chili' : brothId === 'miso' ? 'miso' : null;
  if (!debrisKind) return 0;
  const count = Math.min(requestedCount, maxCount);
  for (let i = 0; i < count; i++) {
    const pos = nextPosition ? nextPosition() : randomPosition(12);
    particles.push({
      ...pos,
      r: debrisKind === 'chili' ? 7 + randomValue() * 4 : 6 + randomValue() * 3,
      type: 'debris',
      debrisKind,
      name: debrisKind === 'chili' ? '辣椒片' : '味噌豆渣',
      units: 1,
      mass: 1,
      vx: spawnedAtMs === null ? (randomValue() - .5) * .22 : pos.vx * WAVE_SPAWN_INWARD_SPEED,
      vy: spawnedAtMs === null ? (randomValue() - .5) * .22 : pos.vy * WAVE_SPAWN_INWARD_SPEED,
      rotation: randomValue() * Math.PI,
      ...(spawnedAtMs === null ? {} : { spawnedAtMs, waveIndex, waveIncoming: true })
    });
    initialMass.debris += 1;
  }
  return count;
}

function spawnRefillWave(waveIndex, reason) {
  const composition = waveComposition(activeStage.counts, waveIndex);
  const debrisCount = reason === 'boil' && ['mala', 'miso'].includes(brothId)
    ? MAX_DEBRIS_PER_WAVE
    : 0;
  const totalCount = Object.values(composition).reduce((sum, count) => sum + count, 0) + debrisCount;
  const rng = waveRandom || random;
  const shape = CONFIG.scaledToolShape(currentTool, currentPotRadius());
  const avoidRadius = shape?.type === 'circle' ? shape.radius : Math.max(shape?.radiusX || 0, shape?.radiusY || 0);
  const positions = waveSpawnPositions(rng, totalCount, {
    cx: canvasWidth / 2,
    cy: canvasHeight / 2,
    potRadius: currentPotRadius(),
    avoid: { x: mouse.x, y: mouse.y, r: avoidRadius }
  });
  let positionIndex = 0;
  const nextPosition = () => positions[positionIndex++];
  const spawnRandom = () => rng();
  const waveParticle = pos => ({
    ...pos,
    spawnedAtMs: simulationTimeMs,
    waveIndex,
    waveIncoming: true
  });
  const inwardSpeed = pos => ({
    vx: pos.vx * WAVE_SPAWN_INWARD_SPEED,
    vy: pos.vy * WAVE_SPAWN_INWARD_SPEED
  });

  for (let i = 0; i < composition.meat; i++) {
    const pos = nextPosition();
    particles.push({
      ...waveParticle(pos), ...inwardSpeed(pos),
      r: 3.2 + spawnRandom() * 3.2, type: 'meat', units: 1, mass: 1,
      shade: spawnRandom()
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
  for (let i = 0; i < composition.veg; i++) {
    const pos = nextPosition();
    const veg = vegTypes[Math.floor(spawnRandom() * vegTypes.length)];
    particles.push({
      ...waveParticle(pos), ...inwardSpeed(pos),
      r: veg.r + spawnRandom() * 4, type: 'veg', units: 1, mass: 1,
      name: veg.name, color: veg.color, rotation: spawnRandom() * Math.PI
    });
    initialMass.veg += 1;
  }

  for (let i = 0; i < composition.oil; i++) {
    const pos = nextPosition();
    const radius = 5 + spawnRandom() * 5.5;
    particles.push({
      ...waveParticle(pos), ...inwardSpeed(pos),
      r: radius, type: 'oil', units: 1, mass: radius * radius,
      shimmer: spawnRandom() * Math.PI * 2
    });
    initialMass.oil += radius * radius;
  }
  for (let i = 0; i < composition.bone; i++) {
    const pos = nextPosition();
    particles.push({
      ...waveParticle(pos), ...inwardSpeed(pos),
      r: 19 + spawnRandom() * 4, type: 'bone', name: '骨頭', units: 1, mass: 2,
      integrity: 2, rotation: spawnRandom() * .3
    });
    initialMass.bone += 2;
  }
  if (debrisCount) {
    spawnBrothDebris(debrisCount, { randomValue: spawnRandom, nextPosition, spawnedAtMs: simulationTimeMs, waveIndex });
  }
  wavesSpawned++;
  refreshParticleGroups();
}

function scheduleWave(boilEvent = false) {
  if (!waveEnabled || !waveState) return false;
  const decision = nextWaveDecision(waveState, {
    nowMs: simulationTimeMs,
    unitsInPot: getRemainingIngredientUnits(),
    initialUnits: waveInitialUnits,
    boilEvent,
    debrisUnits: ['mala', 'miso'].includes(brothId) ? MAX_DEBRIS_PER_WAVE : 0
  });
  waveState = decision.state;
  if (!decision.spawn) return false;
  spawnRefillWave(waveState.waveIndex - 1, decision.reason);
  return true;
}

function updateCounts() {
  setText(meatCountEl, scooped.meat);
  setText(vegCountEl, scooped.veg);
  setText(oilCountEl, scooped.oil);
  setText(document.getElementById('boneCount'), scooped.bone);
  setText(document.getElementById('debrisCount'), scooped.debris);
}

function tryScoop() {
  if (!running) return;
  scoopAttempts++;
  const tool = TOOL_CONFIG[currentTool];
  const oldSpoonStreak = spoonStreak;
  const now = performance.now();
  const chilled = isOilChilled(now);
  const scoopableParticles = getScoopableParticles();
  const { hits: caught, primary, suitable, failure: primaryFailed } = getScoopTargets(
    scoopableParticles, mouse.x, mouse.y, currentTool, currentPotRadius(), chilled
  );
  const indices = caught.map(particle => particles.indexOf(particle));

  if (!caught.length) {
    addVisualEffect(visualEffects, { kind: 'drip', x: mouse.x, y: mouse.y, createdAt: now }, { reduceMotion });
    showHint('這裡沒有食材，試試靠近一點。');
    return;
  }

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
  const hintFragments = [];
  const addScoopHint = (message, priority) => hintFragments.push({ message, priority, order: hintFragments.length });
  const showScoopHints = () => {
    if (!hintFragments.length) return;
    const message = hintFragments
      .sort((a, b) => a.priority - b.priority || a.order - b.order)
      .map(fragment => fragment.message)
      .join('；');
    showHint(message);
  };
  const suitableParticles = new Set(suitable);
  let crackedBone = false;
  if (primaryFailed) {
    lost += wrongToolPenalty(primary);
    scooped.fail++;
    if (challengeRule === 'perfect') lives = loseLife(lives);
    soupLossMl = applySoupLoss(soupLossMl, WRONG_TOOL_SOUP_LOSS_ML);
    if (challengeRule === 'perfect') updateTimerLabel();
  }
  caught.forEach((p, i) => {
    if (!suitableParticles.has(p)) {
      if (p !== primary) soupLossMl = applySoupLoss(soupLossMl, CONFIG.UNSUITED_COLLATERAL_SOUP_LOSS_ML);
      return;
    }
    const decision = scoopDecision(p, currentTool, chilled);
    if (decision.correct) {
      gained += scoreParticle(p, currentTool, { oilChilled: chilled });
      soupLossMl = applySoupLoss(soupLossMl, soupLossForParticle(p, currentTool, spoonStreak));
      successfulActions++;
      if (p.type === 'bone') scooped.boneHits++;
      if (!decision.remove) {
        p.integrity--;
        crackedBone = true;
        addScoopHint('骨頭較大，要用有洞湯勺再撈一次！', 4);
      } else {
        scooped[p.type]++;
        remove.add(indices[i]);
        removedMass[p.type] += decision.removedMass;
      }
    }
  });

  [...remove].sort((a, b) => b - a).forEach(index => particles.splice(index, 1));
  if (remove.size) refreshParticleGroups();
  let comboBonus = 1;
  if (challengeRule === 'score') {
    if (primaryFailed) {
      combo = nextCombo(combo, lastComboSuccessMs, simulationTimeMs, false);
      lastComboSuccessMs = null;
    } else if (successfulActions > 0) {
      combo = nextCombo(combo, lastComboSuccessMs, simulationTimeMs, true);
      lastComboSuccessMs = simulationTimeMs;
      maxCombo = Math.max(maxCombo, combo);
      comboBonus = comboMultiplier(combo);
    }
  }
  score = Math.max(0, score + Math.round(gained * comboBonus) - lost);
  setText(scoreEl, score);
  updateCounts();

  if (primaryFailed || successfulActions === 0) {
    addVisualEffect(visualEffects, { kind: 'drip', x: mouse.x, y: mouse.y, createdAt: now }, { reduceMotion });
  }
  if (successfulActions > 0) {
    addVisualEffect(visualEffects, { kind: 'splash', x: mouse.x, y: mouse.y, createdAt: now }, { reduceMotion });
    addVisualEffect(visualEffects, { kind: 'ripple', x: mouse.x, y: mouse.y, createdAt: now }, { reduceMotion });
    const actionPoints = Math.round(gained * comboBonus) - lost;
    if (actionPoints > 0) {
      const comboText = challengeRule === 'score' && combo > 0 ? `連擊 ×${comboBonus.toFixed(2)}` : '';
      addVisualEffect(visualEffects, {
        kind: 'score', x: mouse.x, y: mouse.y, amount: actionPoints, comboText, createdAt: now
      }, { reduceMotion });
    }
  }

  playSound(primaryFailed ? 'fail' : crackedBone ? 'boneCrack' : 'scoop');
  if (primaryFailed) {
    addScoopHint(`主要目標不適合這個工具，失去一命（剩 ${lives} 命）。`, 0);
  } else if (gained > lost) {
    const bigBonus = caught.some(p => p.r > BIG_PARTICLE_RADIUS && isGoodToolFor(p, currentTool, isOilChilled(now)));
    const coldBonus = caught.some(p => p.type === 'oil' && isOilChilled(now) && isGoodToolFor(p, currentTool, isOilChilled(now)));
    const actionPoints = Math.round(gained * comboBonus) - lost;
    const comboText = challengeRule === 'score' && combo > 0 ? `｜連擊 ${combo} ×${comboBonus.toFixed(2)}` : '';
    addScoopHint(coldBonus ? `凝固油花撈起！細網很合適 +${actionPoints}${comboText}` : bigBonus ? `大塊撈起！${tool.name} +${actionPoints}${comboText}` : `撈取成功 +${actionPoints}${comboText}`, combo > 0 ? 2 : 3);
  } else {
    addScoopHint(`工具不合適，漏掉了… -${lost - gained}`, 3);
  }
  if (currentTool === 'spoon' && spoonStreak >= 2) addScoopHint(`湯匙連續使用，帶走湯汁增加 ${Math.round(spoonStreak * 25)}%`, 5);
  if (scooped.fail === failuresBeforeScoop && successfulActions > 0) {
    correctActionStreak++;
    if (correctActionStreak >= 5) unlockAchievement('steady');
    else if (correctActionStreak >= 3) addScoopHint(`連續正確撈取 ${correctActionStreak}/5，再穩穩撈兩次！`, 6);
  } else if (scooped.fail > failuresBeforeScoop) {
    correctActionStreak = 0;
  }
  if (spoonStreak !== oldSpoonStreak) updateToolTip();
  if (scooped.fail === failuresBeforeScoop && successfulActions > 0) successfulScoops++;
  if (waveEnabled && particles.length === 0) {
    const bonus = waveClearBonus(waveState.nextWaveAtMs - simulationTimeMs);
    waveClears++;
    score += bonus;
    setText(scoreEl, score);
    if (bonus > 0) addScoopHint(`清波獎勵 +${bonus} 分！`, 1);
    scheduleWave();
  }
  potHadNoScoopableUnits = getScoopableIngredientUnits() === 0;
  if (challengeRule === 'perfect' && noLivesRemaining(lives)) {
    showScoopHints();
    endGame('lives');
    return;
  }
  const perfectClear = perfectClearOutcome({
    challengeRule, particles, lives, remainingMs: Math.max(0, deadline - now)
  });
  if (perfectClear) {
    perfectClearBonusScore = perfectClear.bonus;
    score += perfectClearBonusScore;
    setText(scoreEl, score);
    if (perfectClearBonusScore > 0) addScoopHint(`鍋空提早完成 +${perfectClearBonusScore} 分！`, 1);
    showScoopHints();
    endGame(perfectClear.reason);
    return;
  }
  if (challengeRule === 'clear' && allFoodCorrectlyRemoved(particles, initialMass, removedMass)) {
    showScoopHints();
    endGame('cleared');
    return;
  }
  if (successfulActions === 0 && lost === 0 && !caught.length) addScoopHint('這次沒有撈中，靠近食材再試試。', 7);
  showScoopHints();
}

function updateToolTip() {
  const spoonNote = currentTool === 'spoon' ? ` 普通湯匙連續撈取 ${spoonStreak} 次；繼續使用會增加帶走的湯汁（切換工具會歸零）。` : '';
  const boneNote = currentTool === 'holey' ? ' 骨頭需要成功撈取兩次才會清除。' : '';
  setText(toolTip, `${TOOL_CONFIG[currentTool].tip}${spoonNote}${boneNote}`);
}

function isOilChilled(now = performance.now()) {
  return chillUsed && now < chilledUntil;
}

function updateMethodDisplay(now = performance.now()) {
  const chilled = isOilChilled(now);
  let display;
  if (chilled) {
    const left = `（${Math.ceil((chilledUntil - now) / 1000)} 秒）`;
    display = {
      state: 'chilled', left, buttonText: '❄️ 浮油凝固中', buttonDisabled: true,
      statusText: `凝油效果中，僅能用細網撈油 ${left}`, active: true
    };
  } else if (gameMode === 'practice' && now < chillCooldownUntil) {
    const left = Math.ceil((chillCooldownUntil - now) / 1000);
    display = {
      state: 'practice-cooldown', left, buttonText: '❄️ 冷藏冷卻中', buttonDisabled: true,
      statusText: `練習冷卻 ${left} 秒；效果本身維持 14 秒。`, active: false
    };
  } else if (gameMode === 'challenge' && chillUsed) {
    display = {
      state: 'challenge-used', left: 0, buttonText: '❄️ 冷藏已使用', buttonDisabled: true,
      statusText: '凝油效果結束；限時挑戰每局只能預備一次。', active: false
    };
  } else {
    display = {
      state: 'ready', left: 0, buttonText: '❄️ 冷藏凝油（預備）', buttonDisabled: !running,
      statusText: gameMode === 'challenge' ? '會消耗 3 秒，凝固效果維持 14 秒。' : '練習模式每 25 秒可預備一次，凝固維持 14 秒。',
      active: false
    };
  }
  const signature = JSON.stringify([gameMode, running, chilled, display]);
  if (signature === lastMethodDisplay) return;
  lastMethodDisplay = signature;

  document.querySelectorAll('.tool').forEach(button => {
    const locked = chilled && button.dataset.tool !== 'strainer';
    setDisabled(button, locked);
    setAttr(button, 'title', locked ? '浮油已凝固；請先用細網撈取，凝固效果結束後再切換工具。' : '');
  });
  setText(chillBtn, display.buttonText);
  setDisabled(chillBtn, display.buttonDisabled);
  setText(methodStatus, display.statusText);
  setClass(methodStatus, 'active', display.active);
}

function selectTool(toolId) {
  if (!TOOL_CONFIG[toolId]) return;
  if (isOilChilled() && toolId !== 'strainer') {
    showHint('浮油已凝固，只能用細網撈取；等效果結束即可切換。');
    playSound('fail');
    return;
  }
  const previousTool = currentTool;
  const previousSpoonStreak = spoonStreak;
  if (toolId !== 'spoon') {
    spoonStreak = 0;
    lastSpoonUse = null;
  }
  currentTool = toolId;
  document.querySelectorAll('.tool').forEach(button => {
    const active = button.dataset.tool === currentTool;
    setClass(button, 'active', active);
    setAttr(button, 'aria-pressed', String(active));
  });
  if (currentTool !== previousTool || spoonStreak !== previousSpoonStreak) updateToolTip();
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
  setClass(hintEl, 'achievement-toast', false);
  setText(hintEl, message);
  clearTimeout(showHint.timer);
  showHint.timer = setTimeout(() => {
    if (hintEl.textContent === message) setText(hintEl, '');
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

function createSimmerAmbience() {
  if (!audioContext || simmerGain) return Boolean(simmerGain);
  try {
    const sampleRate = audioContext.sampleRate;
    const buffer = audioContext.createBuffer(1, sampleRate * 2, sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;

    simmerSource = audioContext.createBufferSource();
    simmerSource.buffer = buffer;
    simmerSource.loop = true;
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 720;
    filter.Q.value = .7;
    simmerGain = audioContext.createGain();
    simmerGain.gain.value = 0;
    simmerSource.connect(filter);
    filter.connect(simmerGain);
    simmerGain.connect(audioContext.destination);
    simmerSource.start();
    return true;
  } catch {
    simmerSource = null;
    simmerGain = null;
    return false;
  }
}

function updateSimmerAmbience(fireLevel) {
  if (!audioContext) return;
  const settings = fireLevelAudioSettings(quantizeFireLevel(fireLevel), !soundEnabled || !running);
  if (!simmerGain && settings.gain > 0 && !createSimmerAmbience()) return;
  if (!simmerGain) return;
  if (!shouldRetargetAmbience(simmerTargets, settings)) return;

  const now = audioContext.currentTime;
  if (settings.gain === 0) {
    simmerGain.gain.cancelScheduledValues(now);
    simmerGain.gain.setValueAtTime(0, now);
  } else {
    // A 0.1 s time constant reaches its new level in about 0.3 s.
    simmerGain.gain.setTargetAtTime(settings.gain, now, .1);
  }
  if (simmerSource) simmerSource.playbackRate.setTargetAtTime(settings.playbackRate, now, .1);
  simmerTargets = settings;
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

function getScoopableParticles() {
  return particles.filter(particle => !isFadingIn(particle, simulationTimeMs));
}

function getScoopableIngredientUnits() {
  return getScoopableParticles().reduce((total, particle) => total + (particle.units || 1), 0);
}

function currentBoilState() {
  return boilStateAt(simulationTimeMs, BROTHS[brothId]);
}

function updateEventDisplay() {
  const broth = BROTHS[brothId];
  setClass(eventBanner, 'active', boilingNow);
  setText(eventBanner, boilingNow
    ? `🔥 ${broth.name}沸騰湯流！食材移動加快，油花更容易聚集${brothId === 'mala' ? '，辣椒片也會漂散' : brothId === 'miso' ? '，豆渣顆粒隨湯流散開' : ''}`
    : `${broth.name}湯面平穩｜留意下一波沸騰湯流${brothId === 'miso' ? '；豆渣顆粒混在食材間' : ''}`);
}

function updateTimerDisplay() {
  let fillScale;
  if (gameMode === 'practice') {
    setText(timeDisplay, '∞');
    setClass(timeDisplay, 'warn', false);
    fillScale = 1;
  } else {
    const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
    setText(timeDisplay, seconds);
    setClass(timeDisplay, 'warn', seconds <= 8);
    fillScale = Math.max(0, remainingMs / activeDurationMs);
  }
  if (lastTimerFillScale === null || Math.abs(fillScale - lastTimerFillScale) >= 0.005
    || fillScale === 0 || fillScale === 1) {
    const transform = `scaleX(${fillScale})`;
    if (timerFill.style.transform !== transform) timerFill.style.transform = transform;
    lastTimerFillScale = fillScale;
  }
}

function updateTimerLabel() {
  const label = gameMode === 'practice'
    ? `${BROTHS[brothId].name}｜練習模式`
    : `剩餘時間｜${isDailyChallenge ? `${dailyChallengeDate} 每日挑戰` : `${activeStage.name} · ${RULES[challengeRule].name}`}｜${BROTHS[brothId].name}`;
  setText(timerLabel, challengeRule === 'perfect' ? `${label}｜剩餘命數 ${lives}` : label);
  setAttr(timerLabel, 'aria-live', challengeRule === 'perfect' ? 'polite' : 'off');
}

function loop(now) {
  if (!running) return;
  recordPlayedTime(now);
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
  // Scheduler and boil cadence use this active simulation clock; physics caps large frame steps.
  simulationTimeMs += elapsedMs;
  if (potHadNoScoopableUnits) potEmptyMs += elapsedMs;
  const wasBoiling = boilingNow;
  let boilEvent = false;
  boilingNow = currentBoilState();
  if (boilingNow !== wasBoiling) {
    updateEventDisplay();
    if (boilingNow) {
      boilEvent = true;
      playSound('boil');
    }
  }
  updateSimmerAmbience(heatLevelAt(simulationTimeMs, BROTHS[brothId]));
  for (const particle of particles) {
    if (particle.waveIncoming && !isFadingIn(particle, simulationTimeMs)) particle.waveIncoming = false;
  }
  updatePhysics(frameScale, {
    particles, particleGroups, canvasWidth, canvasHeight, brothId, BROTHS,
    boilingNow, reduceMotion, random, refreshParticleGroups
  });
  scheduleWave(boilEvent);
  potHadNoScoopableUnits = getScoopableIngredientUnits() === 0;
  drawSoup(now, simulationTimeMs);
  drawParticles(now, simulationTimeMs);
  drawVisualEffects(now);
  drawTool();
  updateMethodDisplay(now);
  animationFrame = requestAnimationFrame(loop);
}

function startGame(mode = 'challenge', daily = false) {
  const toolTipStateChanged = currentTool !== 'strainer' || spoonStreak !== 0;
  gameMode = mode;
  isDailyChallenge = mode === 'challenge' && daily;
  const dailyInfo = isDailyChallenge ? dailyChallengeDescriptor() : null;
  dailyChallengeSeed = dailyInfo?.seed ?? null;
  dailyChallengeDate = dailyInfo?.date ?? '';
  sharedDailyChallenge = Boolean(dailyInfo?.shared);
  isTodayDailyChallenge = isDailyChallenge && isEligibleDailyChallenge({
    date: dailyChallengeDate, seed: dailyChallengeSeed, todayDate: dailyDateTaipei()
  });
  currentStageId = isDailyChallenge ? 'home' : (stageSelect.value in STAGES ? stageSelect.value : 'home');
  challengeRule = isDailyChallenge ? 'score' : (mode === 'practice' ? 'score' : (ruleSelect.value in RULES ? ruleSelect.value : 'score'));
  brothId = isDailyChallenge ? ['clear', 'mala', 'miso'][dailyChallengeSeed % 3] : (brothSelect.value in BROTHS ? brothSelect.value : 'clear');
  seededRandom = isDailyChallenge ? mulberry32(dailyChallengeSeed || 0) : null;
  waveRandom = isDailyChallenge ? createWaveRng(dailyChallengeSeed || 0) : null;
  waveEnabled = challengeRule === 'score' && (mode === 'challenge' || practiceWavesEnabled);
  endReason = null;
  lastResult = null;
  visualEffects.length = 0;
  activeStage = mode === 'practice' ? PRACTICE_STAGE : STAGES[currentStageId];
  activeDurationMs = mode === 'practice' ? 0 : challengeRule === 'clear' ? clearRuleDurationMs(currentStageId) : activeStage.durationMs;
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
  waveState = null;
  wavesSpawned = 0;
  waveInitialUnits = 0;
  maxCombo = 0;
  combo = 0;
  lastComboSuccessMs = null;
  waveClears = 0;
  potEmptyMs = 0;
  potHadNoScoopableUnits = false;
  boilingNow = false;
  spoonStreak = 0;
  lastSpoonUse = null;
  successfulScoops = 0;
  scoopAttempts = 0;
  perfectClearBonusScore = 0;
  playedMs = 0;
  lives = CONFIG.PERFECT_LIVES;
  lastPlayTime = null;
  lastCountdownSecond = null;
  scooped = { meat: 0, veg: 0, oil: 0, bone: 0, debris: 0, boneHits: 0, fail: 0 };
  correctActionStreak = 0;
  setText(scoreEl, '0');
  updateTimerLabel();
  updateTimerDisplay();
  updateCounts();
  currentTool = 'strainer';
  document.querySelectorAll('.tool').forEach(button => {
    const active = button.dataset.tool === currentTool;
    setClass(button, 'active', active);
    setAttr(button, 'aria-pressed', String(active));
    setDisabled(button, false);
  });
  shareBtn.classList.toggle('hidden', !isDailyChallenge);
  showScreen('game');
  resize();
  spawn();
  wavesSpawned = 1;
  waveInitialUnits = getRemainingIngredientUnits();
  if (waveEnabled) {
    waveState = createWaveState({
      stage: { id: currentStageId, counts: activeStage.counts },
      startMs: simulationTimeMs
    });
  }
  potHadNoScoopableUnits = getScoopableIngredientUnits() === 0;
  mouse.x = canvasWidth / 2;
  mouse.y = canvasHeight / 2;
  running = true;
  lastPlayTime = performance.now();
  setText(pauseBtn, '暫停');
  setAttr(pauseBtn, 'aria-pressed', 'false');
  if (toolTipStateChanged) updateToolTip();
  if (mode === 'challenge') deadline = performance.now() + remainingMs;
  boilingNow = currentBoilState();
  updateEventDisplay();
  updateSimmerAmbience(heatLevelAt(simulationTimeMs, BROTHS[brothId]));
  if (boilingNow) playSound('boil');
  updateMethodDisplay();
  lastFrameTime = performance.now();
  canvas.focus({ preventScroll: true });
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(loop);
  if (mode === 'practice') setText(hintEl, '先辨認食材，再選工具；骨頭要用有洞湯勺撈兩次。');
  else if (isDailyChallenge) setText(hintEl, `${sharedDailyChallenge ? `分享盤面（原始日期 ${formatDailyDate(dailyChallengeDate)}）` : `今日固定盤面｜${formatDailyDate(dailyChallengeDate)}`}｜${BROTHS[brothId].name}｜種子尾碼 #${seedSuffix(dailyChallengeSeed)}。分享連結讓朋友玩同一盤！`);
  else setText(hintEl, `${activeStage.name}｜${RULES[challengeRule].name}開始！肉沫用細網、骨頭用有洞湯勺撈兩次。`);
}

function pauseGame() {
  if (!running || gameEnded) return;
  const now = performance.now();
  recordPlayedTime(now);
  if (gameMode === 'challenge') remainingMs = Math.max(0, deadline - now);
  if (gameMode === 'challenge' && remainingMs <= 0) {
    endGame();
    return;
  }
  if (chillUsed) chillRemainingMs = Math.max(0, chilledUntil - now);
  if (gameMode === 'practice' && chillCooldownUntil > now) chillCooldownRemainingMs = chillCooldownUntil - now;
  running = false;
  updateSimmerAmbience(heatLevelAt(simulationTimeMs, BROTHS[brothId]));
  cancelAnimationFrame(animationFrame);
  lastFrameTime = null;
  updateTimerDisplay();
  setText(pauseBtn, '繼續');
  setAttr(pauseBtn, 'aria-pressed', 'true');
  updateMethodDisplay(now);
  showHint(gameMode === 'practice' ? '練習已暫停，冷藏效果與冷卻時間也會凍結。' : '已暫停，倒數、事件和凝油效果都停止了。');
}

function resumeGame() {
  if (running || gameEnded || (gameMode === 'challenge' && remainingMs <= 0)) return;
  const now = performance.now();
  running = true;
  updateSimmerAmbience(heatLevelAt(simulationTimeMs, BROTHS[brothId]));
  lastPlayTime = now;
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
  setText(pauseBtn, '暫停');
  setAttr(pauseBtn, 'aria-pressed', 'false');
  updateMethodDisplay(now);
  setText(hintEl, '繼續撈取！');
  animationFrame = requestAnimationFrame(loop);
}

function getCategoryCleanliness(type) {
  return categoryCleanliness(initialMass, removedMass, type);
}

function formatCategoryCleanliness(type, label) {
  const rate = getCategoryCleanliness(type);
  return rate === null ? `本關無${label}` : `${rate}%`;
}

function endGame(reason = 'timeout') {
  if (gameEnded) return;
  recordPlayedTime();
  gameEnded = true;
  endReason = reason;
  running = false;
  updateSimmerAmbience(heatLevelAt(simulationTimeMs, BROTHS[brothId]));
  lastPlayTime = null;
  cancelAnimationFrame(animationFrame);
  remainingMs = 0;
  updateTimerDisplay();
  setText(finalScoreEl, score);

  const remaining = getRemainingIngredientUnits();
  const { categoryRates, cleanliness, hasTargets } = overallCleanliness(initialMass, removedMass);
  // No initial target means nothing was left dirty; do not penalize an absent category.
  const successful = scooped.meat + scooped.veg + scooped.oil + scooped.boneHits + scooped.debris;
  const attempts = successful + scooped.fail;
  const correctRate = attempts ? Math.round(successful / attempts * 100) : 0;
  const errorRate = attempts ? Math.round(scooped.fail / attempts * 100) : 0;
  const missionWon = missionSuccess(challengeRule, reason, {
    particles, initialMass, removedMass, failures: scooped.fail, lives
  });
  lastResult = { reason, missionWon, cleanliness, categoryRates, remaining, successful, attempts, correctRate, failures: scooped.fail, lives };
  setText(cleanlinessEl, hasTargets ? `${cleanliness}%` : '100%（無清除目標）');

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
  setText(personalBestEl, gameMode === 'practice'
    ? '練習模式不列入關卡最高分。'
    : isDailyChallenge
      ? `每日挑戰種子 ${formatSeed(dailyChallengeSeed)}｜不覆蓋一般關卡紀錄。`
      : challengeRule === 'score'
        ? `${newRecord ? '本關新紀錄！' : '本關最高分'} ${recordScore}`
        : '此挑戰規則不計入限時衝分紀錄。');
  setText(resultLabel, gameMode === 'practice'
    ? `練習模式｜${BROTHS[brothId].name}｜不限時`
    : isDailyChallenge
      ? `${sharedDailyChallenge ? '分享盤面' : '每日固定盤面'}｜原始日期 ${formatDailyDate(dailyChallengeDate)} · ${BROTHS[brothId].name} · 種子尾碼 #${seedSuffix(dailyChallengeSeed)}`
      : `挑戰關卡｜${activeStage.name} · ${RULES[challengeRule].name} · ${BROTHS[brothId].name} · ${Math.round(activeDurationMs / 1000)} 秒`);
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
    ${challengeRule === 'score' ? `<div>🌊 波次數：<strong>${wavesSpawned}</strong>｜最高連擊：<strong>${maxCombo}</strong>｜清波次數：<strong>${waveClears}</strong></div>` : ''}
    ${challengeRule === 'perfect' ? `<div>❤️ 剩餘命數：<strong>${lives}</strong>／${CONFIG.PERFECT_LIVES}</div>` : ''}
    ${challengeRule === 'perfect' && reason === 'cleared' ? `<div>⏱️ 鍋空提前完成獎勵：<strong>+${perfectClearBonusScore}</strong> 分</div>` : ''}
    <div>🥣 帶走湯汁估算：<strong>${Math.round(soupLossMl)} mL</strong></div>
    <div>❄️ 冷藏凝油：<strong>${chillUsed ? '已使用' : '未使用'}</strong></div>
    ${bestCompare ? `<div>${bestCompare}</div>` : ''}
    ${soupCompare ? `<div>${soupCompare}</div>` : ''}
  `;

  if (gameMode === 'challenge' && !isDailyChallenge) {
    previousResults[resultKey] = { score, soupLoss: soupLossMl, finishedAt: Date.now() };
    savePreviousResults();
  }

  const newlyUnlocked = unlockAchievementsForRun({
    cleanliness, correctRate, attempts, successful, successfulScoops, playedMs, totalSoupLoss: soupLossMl
  });
  const comment = gradeResultComment({
    gameMode, challengeRule, missionWon, cleanliness, score, correctRate, remaining,
    reason, failures: scooped.fail, lives
  });
  setText(resultComment, newlyUnlocked.length ? `${comment} 新解鎖：${newlyUnlocked.join('、')}！` : comment);
  shareBtn.classList.toggle('hidden', !isDailyChallenge);
  showScreen('result');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(screen => screen.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  if (id === 'game') window.scrollTo(0, 0);
}

function updateMenuDescriptions() {
  const stage = STAGES[stageSelect.value] || STAGES.home;
  const rule = RULES[ruleSelect.value] || RULES.score;
  const broth = BROTHS[brothSelect.value] || BROTHS.clear;
  const perfectOption = ruleSelect.querySelector('option[value="perfect"]');
  setText(perfectOption, `無失誤挑戰｜${CONFIG.PERFECT_LIVES} 條命，時間到或鍋空且仍有命即完成`);
  setText(stageDescription, `${stage.description} 食材：肉沫 ${stage.counts.meat}、蔬菜 ${stage.counts.veg}、浮油 ${stage.counts.oil}、骨頭 ${stage.counts.bone}。`);
  setText(ruleDescription, ruleSelect.value === 'clear'
    ? `${rule.description} 時限：新手 75 秒、家常 60 秒、熱鬧 55 秒。`
    : ruleSelect.value === 'score'
      ? '時間內盡量撈取；會定時或低量分波補料，成功連擊與清波獎勵可提高得分。'
      : rule.description);
  setText(brothDescription, broth.description);
  const durationMs = ruleSelect.value === 'clear' ? clearRuleDurationMs(stageSelect.value) : stage.durationMs;
  setText(document.getElementById('startBtn'), `開始${rule.name}（${Math.round(durationMs / 1000)} 秒）`);
  setText(document.getElementById('stageRecommendation'), unlockedAchievements.includes('first')
    ? '推薦：想放慢節奏可先練習；熟悉工具後，再挑戰熱鬧滿鍋或更嚴格規則。'
    : '初次遊玩建議先選「新手小鍋」或「練習辨認」；關卡不鎖定，可自由嘗試。');
  updateStageRecordDisplay();
  updateFriendScoreDisplay();
  const daily = dailyChallengeDescriptor();
  const dailyBroth = BROTHS[['clear', 'mala', 'miso'][daily.seed % 3]];
  setText(document.getElementById('dailyBtn'), daily.shared
    ? `挑戰分享盤面｜${formatDailyDate(daily.date)} · ${dailyBroth.name} · #${seedSuffix(daily.seed)}`
    : `今日固定盤面｜${formatDailyDate(daily.date)} · ${dailyBroth.name} · #${seedSuffix(daily.seed)}`);
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
  setText(bestScoreMenuEl, '0');
  const button = document.getElementById('resetRecordsBtn');
  button.textContent = '已清除本機最高分';
  window.setTimeout(() => { button.textContent = '清除本機紀錄'; }, 2200);
}

function scoopAt(x, y) {
  mouse.x = x;
  mouse.y = y;
  tryScoop();
}

function startFromTest(options = {}) {
  const stage = options.stage in STAGES ? options.stage : 'home';
  const rule = options.rule in RULES ? options.rule : 'score';
  const broth = options.broth in BROTHS ? options.broth : 'clear';
  stageSelect.value = stage;
  ruleSelect.value = rule;
  brothSelect.value = broth;
  if (options.mode === 'daily') startGame('challenge', true);
  else startGame(options.mode === 'practice' ? 'practice' : 'challenge');
}

function installTestHook() {
  if (new URLSearchParams(window.location.search).get('test') !== '1') return;
  const state = {};
  const getters = {
    particles: () => particles,
    score: () => score,
    scooped: () => scooped,
    soupLossMl: () => soupLossMl,
    simulationTimeMs: () => simulationTimeMs,
    running: () => running,
    gameEnded: () => gameEnded,
    currentTool: () => currentTool,
    cleanliness: () => lastResult?.cleanliness ?? overallCleanliness(initialMass, removedMass).cleanliness,
    resultComment: () => resultComment.textContent,
    missionResult: () => lastResult?.missionWon ?? null,
    endReason: () => endReason,
    unlockedAchievements: () => unlockedAchievements,
    brothId: () => brothId,
    challengeRule: () => challengeRule,
    gameMode: () => gameMode,
    successfulScoops: () => successfulScoops,
    scoopAttempts: () => scoopAttempts,
    playedMs: () => playedMs,
    remainingMs: () => remainingMs,
    canvasWidth: () => canvasWidth,
    canvasHeight: () => canvasHeight,
    potRadius: () => currentPotRadius(),
    lives: () => lives,
    waves: () => wavesSpawned,
    maxCombo: () => maxCombo,
    waveClears: () => waveClears,
    potEmptyMs: () => potEmptyMs,
    unitsInPot: () => getRemainingIngredientUnits()
  };
  Object.entries(getters).forEach(([key, get]) => Object.defineProperty(state, key, { enumerable: true, get }));
  window.__hotpot = {
    state,
    TOOL_CONFIG,
    selectTool,
    scoopAt,
    hitTest: (x, y, toolId) => getHitParticles(getScoopableParticles(), x, y, toolId, currentPotRadius()),
    start: startFromTest,
    pause: pauseGame,
    resume: resumeGame,
    activateChill: activateChillMethod,
    end: endGame,
    isOilChilled,
    hashSeed
  };
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
practiceWavesToggle.addEventListener('change', () => {
  practiceWavesEnabled = practiceWavesToggle.checked;
  saveSettings();
});
document.getElementById('soundToggle').addEventListener('change', event => {
  soundEnabled = event.target.checked;
  saveSettings();
  if (soundEnabled && prepareAudioContextFromGesture()) playSound('scoop');
  updateSimmerAmbience(heatLevelAt(simulationTimeMs, BROTHS[brothId]));
});
skinSelect.addEventListener('change', () => {
  selectedSkin = skinSelect.value in POT_SKINS ? skinSelect.value : 'steel';
  saveSettings();
  if (running) {
    drawSoup(performance.now(), simulationTimeMs);
    drawParticles(performance.now(), simulationTimeMs);
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
  const canvasKey = document.activeElement === canvas;
  if ((key === ' ' || key === 'enter' || key.startsWith('arrow')) && !canvasKey) return;
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
  drawSoup(performance.now(), simulationTimeMs);
  drawParticles(performance.now(), simulationTimeMs);
  drawVisualEffects(performance.now());
  drawTool();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') pauseGame();
});
window.addEventListener('pagehide', pauseGame);

updateMenuDescriptions();
showScreen('menu');
installTestHook();

export {
  boilingNow, brothId, canvasHeight, canvasWidth, ctx, currentTool, highContrast,
  isOilChilled, mouse, particleGroups, reduceMotion, selectedSkin, visualEffects
};
