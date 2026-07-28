export const REFRESH_INTERVAL_MS = 1500;

type SetInterval = (callback: () => void, delay: number) => unknown;

export function scheduleRefresh(refresh: () => Promise<void>, setIntervalFn: SetInterval = setInterval) {
  void refresh();
  return setIntervalFn(() => void refresh(), REFRESH_INTERVAL_MS);
}
