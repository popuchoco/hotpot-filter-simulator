// Browser-injected bot. Game access is limited to the test API.
window.__bot = function (strategy, intervalMs = 600, switchMs = 250) {
  const api = window.__hotpot;
  const needTool = particle => {
    if (particle.type === 'oil') return api.isOilChilled() ? 'strainer' : 'spoon';
    if (particle.type === 'meat' || particle.type === 'debris') return 'strainer';
    return 'holey';
  };
  const hitSet = (x, y, tool) => api.hitTest
    ? api.hitTest(x, y, tool)
    : api.state.particles.filter(particle =>
      Math.hypot(particle.x - x, particle.y - y) < api.TOOL_CONFIG[tool].radius * .8 + particle.r * .4
    );
  const goodFor = (particle, tool) => {
    if (particle.type === 'oil' && api.isOilChilled()) return tool === 'strainer';
    if (particle.type === 'bone') return tool === 'holey';
    return api.TOOL_CONFIG[tool].types.includes(particle.type);
  };
  const stats = { scoops: 0, cleanScoops: 0, switches: 0, noClean: 0, emptyAtS: null, half: null, n0: api.state.particles.length };
  window.__botStats = stats;

  function step() {
    const { state } = api;
    const { particles } = state;
    if (!state.running) { if (!state.gameEnded) setTimeout(step, intervalMs); return; }
    if (!particles.length) {
      if (stats.emptyAtS === null) stats.emptyAtS = Math.round(state.simulationTimeMs / 100) / 10;
      setTimeout(step, intervalMs);
      return;
    }
    if (stats.half === null && particles.length <= stats.n0 / 2) stats.half = Math.round(state.simulationTimeMs / 100) / 10;
    let tool, x, y;
    if (strategy === 'spoonSpam' || strategy === 'holeySpam') {
      tool = strategy === 'spoonSpam' ? 'spoon' : 'holey';
      if (api.isOilChilled()) tool = 'strainer';
      const particle = particles[Math.floor(Math.random() * particles.length)];
      x = particle.x;
      y = particle.y;
    } else if (strategy === 'naive') {
      const particle = particles[Math.floor(Math.random() * particles.length)];
      tool = needTool(particle);
      x = particle.x;
      y = particle.y;
    } else {
      // Smart: aim at particle centres, avoid collateral errors, maximize good radii, prefer current tool.
      let best = null;
      for (const particle of particles) {
        const candidateTools = particle.type === 'oil' && !api.isOilChilled() ? ['spoon', 'holey'] : [needTool(particle)];
        for (const candidateTool of candidateTools) {
          if (api.isOilChilled() && candidateTool !== 'strainer') continue;
          const hits = hitSet(particle.x, particle.y, candidateTool);
          let bad = 0, points = 0;
          for (const hit of hits) {
            if (goodFor(hit, candidateTool)) points += hit.r;
            else bad++;
          }
          const value = (bad ? -1000 * bad : 0) + points + (candidateTool === state.currentTool ? 15 : 0);
          if (!best || value > best.value) best = { value, tool: candidateTool, x: particle.x, y: particle.y, bad };
        }
      }
      if (!best) { setTimeout(step, intervalMs); return; }
      tool = best.tool;
      x = best.x;
      y = best.y;
      if (best.bad) stats.noClean++;
    }
    let delay = intervalMs;
    if (tool !== state.currentTool) { api.selectTool(tool); stats.switches++; delay += switchMs; }
    // A tool switch delays the scoop; then the next decision waits one full interval.
    setTimeout(() => {
      if (!api.state.running) { if (!api.state.gameEnded) setTimeout(step, intervalMs); return; }
      const failuresBeforeScoop = api.state.scooped.fail;
      api.scoopAt(x, y);
      stats.scoops++;
      if (api.state.scooped.fail === failuresBeforeScoop) stats.cleanScoops++;
      if (!api.state.gameEnded) setTimeout(step, intervalMs);
    }, delay - intervalMs);
  }

  setTimeout(step, intervalMs);
};
