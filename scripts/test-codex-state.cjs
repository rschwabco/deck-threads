const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const {
  ACTIVE_PRIORITY_WINDOW_MS,
  abbreviateProjectName,
  prioritizeTasks,
  readCodexTasks,
  readThreadStatus,
  readUnreadThreadIds,
} = require("../electron/codex-state.cjs");
const {
  normalizeDisplaySettings,
  readDisplaySettings,
  writeDisplaySettings,
} = require("../electron/display-settings.cjs");
const { assignStableTaskSlots } = require("../electron/task-slots.cjs");

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "deck-threads-state-"));
const unreadId = "11111111-1111-4111-8111-111111111111";
const readId = "22222222-2222-4222-8222-222222222222";
const secondProjectThreadId = "33333333-3333-4333-8333-333333333333";

try {
  fs.writeFileSync(
    path.join(temporaryRoot, ".codex-global-state.json"),
    JSON.stringify({
      "pinned-thread-ids": [readId],
      "local-projects": {
        "project-deck-threads": { name: "Deck Threads" },
      },
      "thread-project-assignments": {
        [unreadId]: { projectId: "project-deck-threads" },
        [secondProjectThreadId]: { projectId: "project-deck-threads" },
      },
      "electron-persisted-atom-state": {
        "unread-thread-ids-by-host-v1": { local: [unreadId] },
      },
    }),
  );

  const stateDb = new DatabaseSync(path.join(temporaryRoot, "state_5.sqlite"));
  stateDb.exec(`
    CREATE TABLE threads (
      id TEXT PRIMARY KEY,
      title TEXT,
      cwd TEXT,
      recency_at_ms INTEGER,
      updated_at_ms INTEGER,
      thread_source TEXT,
      archived INTEGER
    );
  `);
  const insertThread = stateDb.prepare(`
    INSERT INTO threads (id, title, cwd, recency_at_ms, updated_at_ms, thread_source, archived)
    VALUES (?, ?, ?, ?, ?, 'user', 0)
  `);
  insertThread.run(unreadId, "Unread completed task", "/tmp/unread", 2, 2);
  insertThread.run(readId, "Read completed task", "/tmp/read", 1, 1);
  insertThread.run(secondProjectThreadId, "Second project task", "/tmp/second", 0, 0);
  stateDb.close();

  const logsDb = new DatabaseSync(path.join(temporaryRoot, "logs_2.sqlite"));
  logsDb.exec(`
    CREATE TABLE logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER,
      level TEXT,
      target TEXT,
      feedback_log_body TEXT,
      thread_id TEXT
    );
  `);
  const insertLog = logsDb.prepare(`
    INSERT INTO logs (ts, level, target, feedback_log_body, thread_id)
    VALUES (?, 'info', 'codex_core::session::turn', ?, ?)
  `);
  const insertRuntimeLog = logsDb.prepare(`
    INSERT INTO logs (ts, level, target, feedback_log_body, thread_id)
    VALUES (?, 'info', ?, ?, ?)
  `);
  const now = Math.floor(Date.now() / 1000);
  for (const [threadId, turnId] of [
    [unreadId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    [readId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
  ]) {
    insertLog.run(now, `turn.id=${turnId} model_needs_follow_up=false`, threadId);
  }
  const questionThreadId = "44444444-4444-4444-8444-444444444444";
  const questionTurnId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  insertLog.run(now, `turn.id=${questionTurnId} model_needs_follow_up=true`, questionThreadId);
  insertRuntimeLog.run(
    now,
    "codex_core::stream_events_utils",
    `turn.id=${questionTurnId} handle_output_item_done: ToolCall: request_user_input {}`,
    questionThreadId,
  );
  assert.equal(readThreadStatus(logsDb, questionThreadId, now, new Set()).status, "question");
  insertRuntimeLog.run(
    now,
    "codex_core::tools::parallel",
    `turn.id=${questionTurnId} tool call completed tool_name=request_user_input `,
    questionThreadId,
  );
  assert.equal(readThreadStatus(logsDb, questionThreadId, now, new Set()).status, "working");
  const ordinaryToolThreadId = "55555555-5555-4555-8555-555555555555";
  const ordinaryToolTurnId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  insertLog.run(now, `turn.id=${ordinaryToolTurnId} model_needs_follow_up=true`, ordinaryToolThreadId);
  insertRuntimeLog.run(
    now,
    "codex_core::stream_events_utils",
    `turn.id=${ordinaryToolTurnId} handle_output_item_done: ToolCall: exec query LIKE '%ToolCall: request_user_input %'`,
    ordinaryToolThreadId,
  );
  assert.equal(readThreadStatus(logsDb, ordinaryToolThreadId, now, new Set()).status, "working");
  logsDb.close();

  assert.deepEqual([...readUnreadThreadIds(temporaryRoot)], [unreadId]);
  const result = readCodexTasks({ codexHome: temporaryRoot });
  assert.equal(result.tasks[0].status, "unread");
  assert.equal(result.tasks[0].color, "#00FF4C");
  assert.equal(result.tasks[0].projectName, "Deck Threads");
  assert.equal(result.tasks[0].projectLabel, "DT1");
  assert.equal(result.tasks[0].projectThreadNumber, 1);
  assert.equal(result.tasks[0].pinned, false);
  assert.equal(result.tasks[1].status, "read");
  assert.equal(result.tasks[1].color, "#FFFFFF");
  assert.equal(result.tasks[1].projectLabel, "RE1");
  assert.equal(result.tasks[1].pinned, true);
  assert.equal(result.tasks[2].projectLabel, "DT2");
  assert.equal(result.tasks[2].projectThreadNumber, 2);
  assert.equal(abbreviateProjectName("marketplace"), "MA");
  const priorityNow = Date.now();
  const prioritized = prioritizeTasks([
    { id: "old", activityAt: priorityNow - ACTIVE_PRIORITY_WINDOW_MS - 2, pinned: false },
    { id: "pinned", activityAt: priorityNow - ACTIVE_PRIORITY_WINDOW_MS - 1, pinned: true },
    { id: "active", activityAt: priorityNow - 1, pinned: false },
    { id: "question", status: "question", activityAt: priorityNow - 2, pinned: false },
  ], priorityNow);
  assert.deepEqual(prioritized.map((task) => task.id), ["question", "active", "pinned", "old"]);
  assert.deepEqual(prioritized.map((task) => task.priority), ["active", "active", "pinned", "recent"]);
  const initialSlots = assignStableTaskSlots([
    { id: "working-a", status: "working" },
    { id: "working-b", status: "working" },
    { id: "read-c", status: "read" },
  ]);
  const reorderedSlots = assignStableTaskSlots([
    { id: "working-b", status: "working" },
    { id: "working-a", status: "working" },
    { id: "new-working", status: "working" },
  ], initialSlots.taskIds);
  assert.deepEqual(reorderedSlots.taskIds.slice(0, 3), ["working-a", "working-b", "new-working"]);
  assert.equal(reorderedSlots.tasks[0].slot, 0);
  assert.equal(reorderedSlots.tasks[1].slot, 1);
  const sparseSlots = assignStableTaskSlots([
    { id: "working-a", status: "working" },
    { id: "new-working", status: "working" },
  ], ["working-a", null, "new-working"]);
  assert.deepEqual(sparseSlots.taskIds.slice(0, 3), ["working-a", null, "new-working"]);
  const settingsPath = path.join(temporaryRoot, "display-settings.json");
  assert.equal(readDisplaySettings(settingsPath).showThreadTitle.read, true);
  assert.equal(readDisplaySettings(settingsPath).showThreadTitle.question, false);
  const savedSettings = writeDisplaySettings(settingsPath, {
    showThreadTitle: { question: true, read: false },
  });
  assert.equal(savedSettings.showThreadTitle.question, true);
  assert.equal(savedSettings.showThreadTitle.read, false);
  assert.equal(savedSettings.showThreadTitle.working, false);
  assert.deepEqual(readDisplaySettings(settingsPath), savedSettings);
  assert.equal(normalizeDisplaySettings({ showThreadTitle: { error: true } }).showThreadTitle.error, true);
  process.stdout.write("Codex lifecycle, question detection, display settings, labels, pins, and stable slots passed.\n");
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
