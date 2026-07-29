export const REFRESH_INTERVAL_MS = 1500;
export const ANIMATION_INTERVAL_MS = 50;
export const ANIMATION_CYCLE_FRAMES = 2880;

type SetInterval = (callback: () => void, delay: number) => unknown;

export function scheduleRefresh(refresh: () => Promise<void>, setIntervalFn: SetInterval = setInterval) {
  void refresh();
  return setIntervalFn(() => void refresh(), REFRESH_INTERVAL_MS);
}

export function animationFrameAt(nowMs: number) {
  return Math.floor(nowMs / ANIMATION_INTERVAL_MS) % ANIMATION_CYCLE_FRAMES;
}

export function scheduleAnimation(
  animate: (frame: number) => Promise<void>,
  setIntervalFn: SetInterval = setInterval,
  now: () => number = Date.now,
) {
  return setIntervalFn(() => void animate(animationFrameAt(now())), ANIMATION_INTERVAL_MS);
}
