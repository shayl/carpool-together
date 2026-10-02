export const PULL_REFRESH_THRESHOLD = 72;
export const PULL_REFRESH_DAMPING = 0.55;
export const PULL_REFRESH_LIMIT = 96;

export type PullPoint = {
  x: number;
  y: number;
  identifier: number;
  touches: number;
  scrollTop: number;
  blocked: boolean;
};

export type PullGesture = {
  startX: number;
  startY: number;
  identifier: number;
  distance: number;
};

export function beginPull(point: PullPoint): PullGesture | null {
  if (point.blocked || point.scrollTop > 0 || point.touches !== 1) return null;
  return {
    startX: point.x,
    startY: point.y,
    identifier: point.identifier,
    distance: 0,
  };
}

export function movePull(gesture: PullGesture, point: PullPoint): PullGesture | null {
  if (
    point.blocked ||
    point.scrollTop > 0 ||
    point.touches !== 1 ||
    point.identifier !== gesture.identifier
  ) return null;
  const dy = point.y - gesture.startY;
  const dx = Math.abs(point.x - gesture.startX);
  if (dy < 0 || (dx > 8 && dx > dy)) return null;
  return {
    ...gesture,
    distance: Math.min(Math.max(dy * PULL_REFRESH_DAMPING, 0), PULL_REFRESH_LIMIT),
  };
}

export function releasePull(gesture: PullGesture | null) {
  return Boolean(gesture && gesture.distance >= PULL_REFRESH_THRESHOLD);
}
