export const moveToward = (current, target, speed, deltaSeconds) => {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) {
    return { x: current.x, y: current.y, arrived: true };
  }
  const maxStep = speed * deltaSeconds;
  if (distance <= maxStep) {
    return { x: target.x, y: target.y, arrived: true };
  }
  const ratio = maxStep / distance;
  return {
    x: current.x + dx * ratio,
    y: current.y + dy * ratio,
    arrived: false,
  };
};
