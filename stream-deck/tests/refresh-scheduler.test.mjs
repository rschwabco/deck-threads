import assert from "node:assert/strict";
import test from "node:test";
import {
  ANIMATION_CYCLE_FRAMES,
  ANIMATION_INTERVAL_MS,
  REFRESH_INTERVAL_MS,
  animationFrameAt,
  scheduleAnimation,
  scheduleRefresh,
} from "../src/refresh-scheduler.ts";

test("schedules the state refresh independently", async () => {
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

test("caps animation work at one time-derived frame every 50 ms", async () => {
  const intervals = [];
  const frames = [];
  let now = 10_000;
  const timer = scheduleAnimation(async (frame) => {
    frames.push(frame);
  }, (callback, delay) => {
    intervals.push({ callback, delay });
    return "animation-timer";
  }, () => now);

  assert.equal(timer, "animation-timer");
  assert.deepEqual(intervals.map(({ delay }) => delay), [ANIMATION_INTERVAL_MS]);
  intervals[0].callback();
  await Promise.resolve();
  now += ANIMATION_INTERVAL_MS * 4;
  intervals[0].callback();
  await Promise.resolve();
  assert.deepEqual(frames, [200, 204]);
});

test("bounds animation frame values during long-running sessions", () => {
  assert.equal(animationFrameAt(0), 0);
  assert.equal(animationFrameAt(ANIMATION_INTERVAL_MS * ANIMATION_CYCLE_FRAMES), 0);
  assert.equal(animationFrameAt(Number.MAX_SAFE_INTEGER) < ANIMATION_CYCLE_FRAMES, true);
});
