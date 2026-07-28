import assert from "node:assert/strict";
import test from "node:test";
import { REFRESH_INTERVAL_MS, scheduleRefresh } from "../src/refresh-scheduler.ts";

test("schedules one state refresh interval without a hardware animation loop", async () => {
  const intervals = [];
  let refreshes = 0;
  const timer = scheduleRefresh(async () => {
    refreshes += 1;
  }, (callback, delay) => {
    intervals.push({ callback, delay });
    return "refresh-timer";
  });

  await Promise.resolve();
  assert.equal(timer, "refresh-timer");
  assert.equal(refreshes, 1);
  assert.deepEqual(intervals.map(({ delay }) => delay), [REFRESH_INTERVAL_MS]);

  intervals[0].callback();
  await Promise.resolve();
  assert.equal(refreshes, 2);
});
