// Particle physics functions. Depends on game.js globals: particles/particleGroups,
// canvas dimensions, brothId/BROTHS, boilingNow, reduceMotion, random(), and physics constants.
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
      const force = BOIL_FLOW_FORCE * broth.flow * frameScale;
      p.vx += (-dy / distance) * force;
      p.vy += (dx / distance) * force;
      p.vx += (dx / distance) * force * BOIL_RADIAL_FORCE_RATIO;
      p.vy += (dy / distance) * force * BOIL_RADIAL_FORCE_RATIO;
      p.vx = Math.max(-MAX_PARTICLE_SPEED, Math.min(MAX_PARTICLE_SPEED, p.vx));
      p.vy = Math.max(-MAX_PARTICLE_SPEED, Math.min(MAX_PARTICLE_SPEED, p.vy));
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
      p.vx -= projection * BOUNDARY_REFLECTION_MULTIPLIER * normalX;
      p.vy -= projection * BOUNDARY_REFLECTION_MULTIPLIER * normalY;
      p.x = cx + normalX * (rx - p.r);
      p.y = cy + normalY * (ry - p.r);
    }
  });

  const oils = particleGroups.oil;
  const liveOils = new Set(oils);
  const oilOrder = new Map(oils.map((oil, index) => [oil, index]));
  const cellSize = OIL_GRID_CELL_SIZE;
  const cells = new Map();
  const oilCellByParticle = new Map();
  const cellKey = (x, y) => `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
  const addToCell = oil => {
    const key = cellKey(oil.x, oil.y);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(oil);
    oilCellByParticle.set(oil, key);
  };
  const removeFromCell = oil => {
    const key = oilCellByParticle.get(oil);
    if (key === undefined) return;
    const cell = cells.get(key);
    const index = cell?.indexOf(oil) ?? -1;
    if (index !== -1) cell.splice(index, 1);
    if (cell && cell.length === 0) cells.delete(key);
    oilCellByParticle.delete(oil);
  };
  const updateOilCell = oil => {
    const nextKey = cellKey(oil.x, oil.y);
    if (oilCellByParticle.get(oil) === nextKey) return;
    removeFromCell(oil);
    addToCell(oil);
  };
  for (const oil of oils) addToCell(oil);
  const baseMergeRate = Math.min(OIL_MERGE_RATE_CAP, OIL_MERGE_BASE_RATE * broth.aggregation * (boilingNow ? OIL_MERGE_BOIL_MULTIPLIER : 1));
  const mergeChance = 1 - Math.pow(1 - baseMergeRate, frameScale);
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
      const mergeDist = (a.r + b.r) * OIL_MERGE_DISTANCE_FACTOR;
      if (dist < mergeDist) {
        if (a.r + b.r < OIL_MERGE_CAP && random() < mergeChance) {
          const areaA = a.r * a.r;
          const areaB = b.r * b.r;
          const area = areaA + areaB;
          a.x = (a.x * areaA + b.x * areaB) / area;
          a.y = (a.y * areaA + b.y * areaB) / area;
          a.r = Math.min(Math.sqrt(area), OIL_PARTICLE_RADIUS_CAP);
          a.mass = (a.mass || areaA) + (b.mass || areaB);
          a.units = (a.units || 1) + (b.units || 1);
          a.vx = (a.vx * areaA + b.vx * areaB) / area;
          a.vy = (a.vy * areaA + b.vy * areaB) / area;
          const index = particles.indexOf(b);
          if (index !== -1) particles.splice(index, 1);
          removeFromCell(b);
          liveOils.delete(b);
          // Incrementally move the survivor and remove the absorbed droplet from the grid.
          updateOilCell(a);
          break;
        }
        if (dist < mergeDist * OIL_ATTRACTION_RANGE_FACTOR) {
          const force = OIL_ATTRACTION_FORCE * broth.aggregation * (boilingNow ? OIL_ATTRACTION_BOIL_MULTIPLIER : 1) * frameScale;
          a.vx -= (dx / dist) * force;
          a.vy -= (dy / dist) * force;
          b.vx += (dx / dist) * force;
          b.vy += (dy / dist) * force;
        }
      }
    }
  }
  refreshParticleGroups();
}
