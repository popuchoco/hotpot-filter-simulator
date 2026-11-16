export function rescaleParticles(particles, oldGeom, newGeom) {
  const oldRadius = oldGeom?.potRadius || 0;
  const newRadius = newGeom?.potRadius || 0;
  if (!oldRadius || !newRadius) return particles.map(particle => ({ ...particle }));

  const scale = newRadius / oldRadius;
  const oldCenterX = oldGeom.width / 2;
  const oldCenterY = oldGeom.height / 2;
  const newCenterX = newGeom.width / 2;
  const newCenterY = newGeom.height / 2;
  return particles.map(particle => ({
    ...particle,
    x: newCenterX + (particle.x - oldCenterX) * scale,
    y: newCenterY + (particle.y - oldCenterY) * scale
  }));
}
