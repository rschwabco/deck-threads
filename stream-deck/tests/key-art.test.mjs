import assert from "node:assert/strict";
import test from "node:test";
import { threadKey } from "../src/key-art.ts";

const task = {
  id: "task-1",
  stableId: "codex:task-1",
  sourceId: "codex",
  sourceName: "Codex",
  sourceLabel: "CX",
  slot: 0,
  title: "Animate the key",
  cwd: "/tmp/deck-threads",
  projectName: "Deck Threads",
  projectAbbreviation: "DT",
  projectThreadNumber: 1,
  projectLabel: "DT1",
  pinned: false,
  priority: "active",
  status: "working",
  color: "#6682FF",
  activityAt: 1,
};

function svg(animation, frame) {
  const uri = threadKey(task, 0, true, frame, false, { backgroundColor: "#24375F", animation });
  return Buffer.from(uri.split(",")[1], "base64").toString("utf8");
}

test("still keys do not change when the animation frame advances", () => {
  assert.equal(svg("still", 0), svg("still", 17));
});

for (const animation of ["breathe", "sweep", "pulse", "wave", "orbit", "scan", "sparkle"]) {
  test(`${animation} produces distinct physical frames`, () => {
    const first = svg(animation, 0);
    const next = svg(animation, 17);
    assert.notEqual(first, next);
    assert.match(first, new RegExp(`data-animation="${animation}"`));
  });
}
