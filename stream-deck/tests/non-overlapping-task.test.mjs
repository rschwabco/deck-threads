import assert from "node:assert/strict";
import test from "node:test";
import { NonOverlappingTask } from "../src/non-overlapping-task.ts";

test("coalesces work while a task is in flight and accepts the next task after it settles", async () => {
  const gate = new NonOverlappingTask();
  let release;
  let calls = 0;
  const barrier = new Promise((resolve) => { release = resolve; });

  const first = gate.run(async () => {
    calls += 1;
    await barrier;
  });
  const overlapping = gate.run(async () => {
    calls += 1;
  });

  assert.equal(first, overlapping);
  await Promise.resolve();
  assert.equal(calls, 1);

  release();
  await first;
  await gate.run(async () => {
    calls += 1;
  });
  assert.equal(calls, 2);
});

test("clears the in-flight gate after a failed task", async () => {
  const gate = new NonOverlappingTask();
  await assert.rejects(gate.run(async () => {
    throw new Error("render failed");
  }), /render failed/);

  let recovered = false;
  await gate.run(async () => {
    recovered = true;
  });
  assert.equal(recovered, true);
});
