export const BEST_SCORE_KEY = 'hotpot-filter-simulator.best-score.v1';
export const STAGE_RECORDS_KEY = 'hotpot-filter-simulator.stage-records.v1';
export const PREVIOUS_RESULTS_KEY = 'hotpot-filter-simulator.previous-results.v1';
export const ACHIEVEMENTS_KEY = 'hotpot-filter-simulator.achievements.v1';
export const SETTINGS_KEY = 'hotpot-filter-simulator.settings.v1';

export const CHILL_PRACTICE_COOLDOWN_MS = 25_000;
export const CHILL_EFFECT_MS = 14_000;
export const BOIL_CYCLE_MS = 14_000;
export const BOIL_DURATION_MS = 3_800;
export const FRAME_SCALE_MAX = 2;
export const SCORE_PER_RADIUS = 1.8;
export const SCORE_BASE = 3;
export const BONE_SCORE_BONUS = 18;
export const BIG_PARTICLE_RADIUS = 20;
export const BIG_OIL_SCORE_MULTIPLIER = 1.7;
export const BIG_VEG_SCORE_MULTIPLIER = 1.3;
export const CHILLED_OIL_SCORE_MULTIPLIER = 1.25;
export const VEG_SOUP_LOSS_MULTIPLIER = 1.5;
export const SPOON_STREAK_SOUP_LOSS_INCREMENT = .25;
export const SPOON_STREAK_WINDOW_MS = 2_000;
export const SPOON_STREAK_MAX = 4;
export const PARTICLE_RENDER_TYPES = Object.freeze(['oil', 'meat', 'veg', 'bone', 'debris']);
export const WRONG_TOOL_PENALTY_PER_RADIUS = .8;
export const WRONG_TOOL_BASE_PENALTY = 2;
export const WRONG_TOOL_SOUP_LOSS_ML = 2;
export const UNSUITED_COLLATERAL_SOUP_LOSS_ML = .15;
export const PERFECT_LIVES = 3;
export const FIRST_ACHIEVEMENT_MIN_SUCCESSFUL_SCOOPS = 5;
export const FIRST_ACHIEVEMENT_MIN_PLAY_MS = 15_000;
export const DAILY_ACHIEVEMENT_MIN_SUCCESSFUL_SCOOPS = 8;
export const RESULT_COMMENT_MIN_ACCURACY_PERCENT = 70;
export const RESULT_COMMENT_HIGH_SCORE_THRESHOLD = 160;
export const RESULT_COMMENT_MID_SCORE_THRESHOLD = 80;
export const RESULT_COMMENT_CLEAN_PERCENT = 75;
export const SOUP_LOSS_CAP_ML = 5_000;
export const OIL_GRID_CELL_SIZE = 64;
export const OIL_MERGE_BASE_RATE = .035;
export const OIL_MERGE_RATE_CAP = .12;
export const OIL_MERGE_BOIL_MULTIPLIER = 1.8;
export const OIL_MERGE_CAP = 43;
export const OIL_PARTICLE_RADIUS_CAP = 34;
export const OIL_MERGE_DISTANCE_FACTOR = .9;
export const OIL_ATTRACTION_FORCE = .012;
export const OIL_ATTRACTION_RANGE_FACTOR = 1.35;
export const OIL_ATTRACTION_BOIL_MULTIPLIER = 1.6;
export const BOIL_FLOW_FORCE = .028;
export const BOIL_RADIAL_FORCE_RATIO = .16;
export const MAX_PARTICLE_SPEED = 1.5;
export const BOUNDARY_REFLECTION_MULTIPLIER = 1.7;

export const RULES = {
  score: { name: '限時衝分', description: '時間內盡量撈取，挑戰更高分數。' },
  clear: { name: '全清挑戰', description: '限時清空整鍋；時間到仍有食材就算未完成。' },
  perfect: { name: '無失誤挑戰', description: '限時撈取，共有 3 條命；時間到或鍋空時仍有命數就算完成。' }
};

export const BROTHS = {
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

export const POT_SKINS = {
  steel: { name: '經典不鏽鋼鍋', outer: ['#f0ebdf', '#777267', '#292825', '#c4bdaf', '#4c4942', '#1c1b19', '#6d675c', '#252320'] },
  jade: { name: '翡翠鍋', outer: ['#e6f0df', '#769079', '#263a32', '#b5c8a8', '#465c4b', '#18251f', '#64806a', '#213329'] },
  copper: { name: '暖銅鍋', outer: ['#ffe0ba', '#ad6844', '#48291f', '#d79563', '#74452e', '#2d1d18', '#a76b49', '#3b241c'] }
};

export const ACHIEVEMENTS = [
  { id: 'first', name: '第一次開鍋', description: '成功撈取 5 次或遊玩滿 15 秒。', skin: 'jade' },
  { id: 'clean', name: '清鍋達人', description: '單局清潔度達 100%。', skin: 'copper' },
  { id: 'accurate', name: '工具達人', description: '至少撈取 8 次，工具正確率達 90%。' },
  { id: 'gentle', name: '惜湯高手', description: '成功撈取 8 份以上，湯汁損失不超過 20 mL。' },
  { id: 'daily', name: '每日鍋友', description: '使用當日固定種子成功撈取至少 8 次。' },
  { id: 'steady', name: '穩手撈料', description: '連續 5 次正確撈取，中途沒有工具失誤。' }
];

export const STAGES = {
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

export const PRACTICE_STAGE = {
  name: '練習辨認', durationMs: 0, counts: { meat: 14, veg: 5, oil: 14, bone: 1 },
  vegetables: ['芋頭', '南瓜', '番茄', '馬鈴薯']
};

export const TOOL_CONFIG = {
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

// At 1920×1080, the pot diameter is ≈ 0.84×canvas ≈ 60–65% of viewport height when the stage allows it; smaller screens are stage-limited, so 1366×768 and 390×844 are unchanged.
export const CANVAS_MAX_DISPLAY_SIZE = 800;
// Tool shape dimensions preserve the existing desktop head sizes at the 510 px reference radius.
export const POT_RADIUS_RATIO = .42;
export const POT_REFERENCE_CANVAS_SIZE = 510;
export const TOOL_SHAPE_REFERENCE_POT_RADIUS = POT_REFERENCE_CANVAS_SIZE * POT_RADIUS_RATIO;
export const TOOL_SHAPES = Object.freeze({
  spoon: Object.freeze({
    type: 'ellipse', radiusX: 26.66, radiusY: 17.2, rotation: -.15,
    lineWidth: 2.2, handleStart: 12.04, handleEnd: 53.75
  }),
  holey: Object.freeze({
    type: 'ellipse', radiusX: 21.96, radiusY: 14.04, rotation: -.12,
    lineWidth: 2.2, handleStart: 10.8, handleEnd: 44.28,
    holeRadius: 2.5,
    holes: Object.freeze([
      Object.freeze([-13, -9]), Object.freeze([0, -9]), Object.freeze([13, -9]),
      Object.freeze([-13, 0]), Object.freeze([0, 0]), Object.freeze([13, 0]),
      Object.freeze([-13, 9]), Object.freeze([0, 9]), Object.freeze([13, 9])
    ])
  }),
  strainer: Object.freeze({
    type: 'circle', radius: 16.5, lineWidth: 2.2, handleStart: 15, handleEnd: 37.5,
    mesh: Object.freeze([
      Object.freeze([-18, -15, -18, 15]), Object.freeze([-9, -15, -9, 15]),
      Object.freeze([0, -15, 0, 15]), Object.freeze([9, -15, 9, 15]),
      Object.freeze([18, -15, 18, 15]), Object.freeze([-15, -18, 15, -18]),
      Object.freeze([-15, -9, 15, -9]), Object.freeze([-15, 0, 15, 0]),
      Object.freeze([-15, 9, 15, 9]), Object.freeze([-15, 18, 15, 18])
    ])
  })
});

export function scaledToolShape(toolId, potRadius = TOOL_SHAPE_REFERENCE_POT_RADIUS) {
  const shape = TOOL_SHAPES[toolId];
  if (!shape) return null;
  const scale = potRadius / TOOL_SHAPE_REFERENCE_POT_RADIUS;
  const scaled = { ...shape, scale };
  for (const key of ['radius', 'radiusX', 'radiusY', 'lineWidth', 'handleStart', 'handleEnd', 'holeRadius']) {
    if (shape[key] !== undefined) scaled[key] = shape[key] * scale;
  }
  if (shape.holes) scaled.holes = shape.holes.map(([x, y]) => [x * scale, y * scale]);
  if (shape.mesh) scaled.mesh = shape.mesh.map(line => line.map(value => value * scale));
  return scaled;
}

export const CHILL_COST_MS = 3_000;
