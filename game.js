const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const timeDisplay = document.getElementById('timeDisplay');
const hintEl = document.getElementById('hint');
const finalScoreEl = document.getElementById('finalScore');
const resultComment = document.getElementById('resultComment');
const resultStats = document.getElementById('resultStats');
const meatCountEl = document.getElementById('meatCount');
const vegCountEl = document.getElementById('vegCount');
const oilCountEl = document.getElementById('oilCount');

let currentTool = 'strainer';
let score = 0;
let timeLeft = 40;
let timer = null;
let running = false;
let particles = [];
let mouse = { x: 200, y: 200, down: false };
let scoopRadius = 48;

// Track scooped amounts
let scooped = { meat: 0, veg: 0, oil: 0, fail: 0 };

const TOOL_NAMES = { spoon: '普通湯匙', holey: '有洞湯勺', strainer: '濾網' };

// Which tools work well for each type
const GOOD_TOOLS = {
  meat: ['strainer'],
  veg: ['holey', 'strainer'],
  oil: ['spoon', 'holey']
};

function resize() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function spawn() {
  particles = [];
  const w = canvas.width / devicePixelRatio;
  const h = canvas.height / devicePixelRatio;

  // Meat crumbs (many small)
  for (let i = 0; i < 110; i++) {
    particles.push({
      x: 30 + Math.random() * (w - 60),
      y: 50 + Math.random() * (h - 100),
      r: 2.5 + Math.random() * 3.5,
      type: 'meat',
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      color: `hsl(${12 + Math.random() * 12}, 65%, ${38 + Math.random() * 12}%)`
    });
  }

  // Vegetables
  const vegTypes = [
    { name: '芋頭', color: '#c9a66b', r: 16 },
    { name: '南瓜', color: '#e67e22', r: 18 },
    { name: '番茄', color: '#e74c3c', r: 15 },
    { name: '馬鈴薯', color: '#d4a574', r: 16 }
  ];
  for (let i = 0; i < 16; i++) {
    const t = vegTypes[Math.floor(Math.random() * vegTypes.length)];
    particles.push({
      x: 40 + Math.random() * (w - 80),
      y: 60 + Math.random() * (h - 120),
      r: t.r + Math.random() * 5,
      type: 'veg',
      name: t.name,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      color: t.color
    });
  }

  // Bone soup oil (pale yellow, semi-transparent, harder to see)
  for (let i = 0; i < 90; i++) {
    particles.push({
      x: 35 + Math.random() * (w - 70),
      y: 40 + Math.random() * (h - 80),
      r: 4 + Math.random() * 6,
      type: 'oil',
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      color: `hsla(${42 + Math.random() * 12}, 70%, ${72 + Math.random() * 12}%, 0.55)`
    });
  }
}

function drawSoup() {
  const w = canvas.width / devicePixelRatio;
  const h = canvas.height / devicePixelRatio;
  // Bone broth: brownish, not red
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#7a4a2e');
  g.addColorStop(0.45, '#8f5c38');
  g.addColorStop(1, '#5c3a22');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Subtle surface sheen
  ctx.fillStyle = 'rgba(255, 230, 180, 0.06)';
  ctx.fillRect(0, 0, w, 40);

  // Bubbles
  ctx.fillStyle = 'rgba(255, 220, 180, 0.18)';
  for (let i = 0; i < 7; i++) {
    const bx = (Date.now() / 50 + i * 90) % w;
    const by = 30 + Math.sin(Date.now() / 700 + i) * 15;
    ctx.beginPath();
    ctx.arc(bx, by, 3 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  // Draw oil first (under), then others
  const oils = particles.filter(p => p.type === 'oil');
  const others = particles.filter(p => p.type !== 'oil');

  oils.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 240, 200, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  others.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    if (p.type === 'veg' && p.name) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = '9px Noto Sans TC';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, p.x, p.y + 3);
    }
  });
}

function drawTool() {
  ctx.save();
  ctx.translate(mouse.x, mouse.y);
  ctx.strokeStyle = '#ffe8c8';
  ctx.fillStyle = 'rgba(255, 230, 190, 0.12)';
  ctx.lineWidth = 2.5;

  if (currentTool === 'spoon') {
    ctx.beginPath();
    ctx.ellipse(0, 0, scoopRadius * 0.65, scoopRadius * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, scoopRadius * 0.28);
    ctx.lineTo(0, scoopRadius * 1.35);
    ctx.stroke();
  } else if (currentTool === 'holey') {
    ctx.beginPath();
    ctx.ellipse(0, 0, scoopRadius * 0.6, scoopRadius * 0.38, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = -2; i <= 2; i++) {
      for (let j = -1; j <= 1; j++) {
        ctx.beginPath();
        ctx.arc(i * 11, j * 7, 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.moveTo(0, scoopRadius * 0.22);
    ctx.lineTo(0, scoopRadius * 1.25);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, scoopRadius * 0.52, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 9, -scoopRadius * 0.48);
      ctx.lineTo(i * 9, scoopRadius * 0.48);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-scoopRadius * 0.48, i * 9);
      ctx.lineTo(scoopRadius * 0.48, i * 9);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, scoopRadius * 0.48);
    ctx.lineTo(0, scoopRadius * 1.35);
    ctx.stroke();
  }
  ctx.restore();
}

function updatePhysics() {
  const w = canvas.width / devicePixelRatio;
  const h = canvas.height / devicePixelRatio;

  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < p.r || p.x > w - p.r) p.vx *= -0.75;
    if (p.y < p.r + 15 || p.y > h - p.r - 15) p.vy *= -0.75;
    p.x = Math.max(p.r, Math.min(w - p.r, p.x));
    p.y = Math.max(p.r + 15, Math.min(h - p.r - 15, p.y));
  });

  // Oil slow aggregation (harder than pure red oil)
  const oils = particles.filter(p => p.type === 'oil');
  for (let i = 0; i < oils.length; i++) {
    for (let j = i + 1; j < oils.length; j++) {
      const a = oils[i], b = oils[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) continue;
      const mergeDist = (a.r + b.r) * 0.95;
      if (dist < mergeDist) {
        if (a.r + b.r < 42 && Math.random() < 0.06) {
          const nr = Math.sqrt(a.r * a.r + b.r * b.r) * 0.93;
          a.x = (a.x * a.r + b.x * b.r) / (a.r + b.r);
          a.y = (a.y * a.r + b.y * b.r) / (a.r + b.r);
          a.r = Math.min(nr, 36);
          a.color = `hsla(${44 + Math.random() * 8}, 65%, ${74 + Math.random() * 8}%, 0.62)`;
          const idx = particles.indexOf(b);
          if (idx > -1) particles.splice(idx, 1);
          break;
        } else if (dist < mergeDist * 1.3) {
          const f = 0.018;
          a.vx -= (dx / dist) * f;
          a.vy -= (dy / dist) * f;
          b.vx += (dx / dist) * f;
          b.vy += (dy / dist) * f;
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

function tryScoop() {
  const caught = [];
  const indices = [];
  particles.forEach((p, i) => {
    const d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
    if (d < scoopRadius * 0.8 + p.r * 0.4) {
      caught.push(p);
      indices.push(i);
    }
  });

  if (caught.length === 0) {
    showHint('沒撈到東西...');
    return;
  }

  let gained = 0;
  let lost = 0;
  const toRemove = [];

  caught.forEach((p, idx) => {
    const good = GOOD_TOOLS[p.type].includes(currentTool);
    const isBig = p.r > 20;

    if (good) {
      let pts = Math.round(p.r * 1.8 + 3);
      if (p.type === 'oil' && isBig) pts = Math.round(pts * 1.7);
      if (p.type === 'veg' && isBig) pts = Math.round(pts * 1.3);
      gained += pts;
      scooped[p.type]++;
      toRemove.push(indices[idx]);
    } else {
      // Wrong tool: partial fail
      lost += Math.round(p.r * 0.8 + 2);
      scooped.fail++;
      if (Math.random() < 0.45) toRemove.push(indices[idx]); // sometimes leak through
    }
  });

  // Remove in reverse order
  toRemove.sort((a, b) => b - a).forEach(i => particles.splice(i, 1));

  score += gained - lost;
  score = Math.max(0, score);
  scoreEl.textContent = score;
  updateCounts();

  if (gained > lost) {
    const bonus = caught.some(p => p.r > 20 && GOOD_TOOLS[p.type].includes(currentTool));
    showHint(bonus ? `大塊撈取成功！ +${gained - lost}` : `成功撈起 +${gained - lost}`);
  } else {
    showHint(`工具不適合，漏掉了… -${lost - gained}`);
  }
}

function showHint(msg) {
  hintEl.textContent = msg;
  clearTimeout(showHint._t);
  showHint._t = setTimeout(() => { if (hintEl.textContent === msg) hintEl.textContent = ''; }, 1600);
}

function loop() {
  if (!running) return;
  updatePhysics();
  drawSoup();
  drawParticles();
  drawTool();
  requestAnimationFrame(loop);
}

function startGame() {
  score = 0;
  timeLeft = 40;
  scooped = { meat: 0, veg: 0, oil: 0, fail: 0 };
  scoreEl.textContent = '0';
  timeDisplay.textContent = '40';
  timeDisplay.classList.remove('warn');
  updateCounts();
  spawn();
  currentTool = 'strainer';
  document.querySelectorAll('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === currentTool));
  showScreen('game');
  running = true;
  resize();
  // Center mouse initially
  mouse.x = canvas.getBoundingClientRect().width / 2;
  mouse.y = canvas.getBoundingClientRect().height / 2;
  loop();
  clearInterval(timer);
  timer = setInterval(() => {
    timeLeft--;
    timeDisplay.textContent = timeLeft;
    if (timeLeft <= 8) timeDisplay.classList.add('warn');
    if (timeLeft <= 0) endGame();
  }, 1000);
  hintEl.textContent = '同一鍋大骨湯，用對的工具撈！';
}

function endGame() {
  running = false;
  clearInterval(timer);
  finalScoreEl.textContent = score;

  const total = scooped.meat + scooped.veg + scooped.oil;
  resultStats.innerHTML = `
    <div>🥩 肉沫撈起：<strong>${scooped.meat}</strong> 份</div>
    <div>🥦 蔬菜撈起：<strong>${scooped.veg}</strong> 塊</div>
    <div>🟡 浮油撈起：<strong>${scooped.oil}</strong> 片</div>
    <div>❌ 工具失誤：<strong>${scooped.fail}</strong> 次</div>
  `;

  let comment = '';
  if (score >= 280) comment = '太厲害了！湯底幾乎清乾淨，工具運用完美。';
  else if (score >= 160) comment = '不錯的過濾成果，再注意一下大骨湯的浮油。';
  else if (score >= 80) comment = '有撈到東西，但工具選擇還可以更精準。';
  else comment = '時間內撈得不多，試試不同工具對應不同內容。';
  resultComment.textContent = comment;
  showScreen('result');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// Events
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('howToBtn').addEventListener('click', () => showScreen('howto'));
document.getElementById('backMenu').addEventListener('click', () => showScreen('menu'));

document.querySelectorAll('.tool').forEach(btn => {
  btn.addEventListener('click', () => {
    currentTool = btn.dataset.tool;
    document.querySelectorAll('.tool').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

canvas.addEventListener('pointerdown', e => {
  if (!running) return;
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
  tryScoop();
});
canvas.addEventListener('pointermove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

document.getElementById('pauseBtn').addEventListener('click', () => {
  running = !running;
  if (running) loop();
  document.getElementById('pauseBtn').textContent = running ? '暫停' : '繼續';
});
document.getElementById('endBtn').addEventListener('click', endGame);
document.getElementById('retryBtn').addEventListener('click', startGame);
document.getElementById('menuBtn').addEventListener('click', () => {
  showScreen('menu');
  running = false;
  clearInterval(timer);
});

showScreen('menu');
