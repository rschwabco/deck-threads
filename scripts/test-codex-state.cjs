const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const {
  ACTIVE_PRIORITY_WINDOW_MS,
  abbreviateProjectName,
  assignProjectThreadNumbers,
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
const {
  ACTIVE_WINDOW_MS: CLAUDE_ACTIVE_WINDOW_MS,
  classifyClaudeLifecycle,
  latestClaudeCustomTitle,
  normalizeClaudeAgents,
  readClaudeSessionMetadata,
  readClaudeStarredIds,
  tasksFromClaudeAgents,
} = require("../electron/claude-state.cjs");
const {
  allocateTasksBySource,
  normalizeSourceAllocation,
  readSourceAllocation,
  writeSourceAllocation,
} = require("../electron/source-allocation.cjs");
const { taskDeepLink } = require("../electron/task-open.cjs");

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "deck-threads-state-"));
const unreadId = "11111111-1111-4111-8111-111111111111";
const readId = "22222222-2222-4222-8222-222222222222";
const secondProjectThreadId = "33333333-3333-4333-8333-333333333333";
const archivedId = "99999999-9999-4999-8999-999999999999";

try {
  fs.writeFileSync(
    path.join(temporaryRoot, ".codex-global-state.json"),
    JSON.stringify({
      "pinned-thread-ids": [readId],
      "local-projects": {
        "project-deck-threads": { name: "Deck Threads" },
      },
      "sidebar-project-thread-orders": {
        "project-deck-threads": { threadIds: [secondProjectThreadId, unreadId] },
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
      created_at INTEGER,
      created_at_ms INTEGER,
      recency_at_ms INTEGER,
      updated_at_ms INTEGER,
      thread_source TEXT,
      archived INTEGER
    );
  `);
  const insertThread = stateDb.prepare(`
    INSERT INTO threads (id, title, cwd, created_at, created_at_ms, recency_at_ms, updated_at_ms, thread_source, archived)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'user', 0)
  `);
  insertThread.run(unreadId, "Unread completed task", "/tmp/unread", 1, 1, 2, 2);
  insertThread.run(readId, "Read completed task", "/tmp/read", 1, 1, 1, 1);
  insertThread.run(secondProjectThreadId, "Second project task", "/tmp/second", 2, 2, 0, 0);
  insertThread.run(archivedId, "Archived task", "/tmp/archived", 3, 3, Date.now(), Date.now());
  stateDb.prepare("UPDATE threads SET archived = 1 WHERE id = ?").run(archivedId);
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
  assert.equal(result.tasks.some((task) => task.id === archivedId), false);
  assert.equal(result.tasks[0].status, "unread");
  assert.equal(result.tasks[0].color, "#00FF4C");
  assert.equal(result.tasks[0].projectName, "Deck Threads");
  assert.equal(result.tasks[0].projectLabel, "DT2");
  assert.equal(result.tasks[0].projectThreadNumber, 2);
  assert.equal(result.tasks[0].pinned, false);
  assert.equal(result.tasks[1].status, "read");
  assert.equal(result.tasks[1].color, "#FFFFFF");
  assert.equal(result.tasks[1].projectLabel, "RE1");
  assert.equal(result.tasks[1].pinned, true);
  assert.equal(result.tasks[2].projectLabel, "DT1");
  assert.equal(result.tasks[2].projectThreadNumber, 1);
  const createdOrderNumbers = assignProjectThreadNumbers([
    { id: secondProjectThreadId, cwd: "/tmp/second", createdAt: 2 },
    { id: unreadId, cwd: "/tmp/unread", createdAt: 1 },
  ], {
    "local-projects": { "project-deck-threads": { name: "Deck Threads" } },
    "thread-project-assignments": {
      [unreadId]: { projectId: "project-deck-threads" },
      [secondProjectThreadId]: { projectId: "project-deck-threads" },
    },
  });
  assert.equal(createdOrderNumbers.get(unreadId), 1);
  assert.equal(createdOrderNumbers.get(secondProjectThreadId), 2);
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
  const sharedTaskId = "66666666-6666-4666-8666-666666666666";
  const sourceAwareSlots = assignStableTaskSlots([
    { id: sharedTaskId, stableId: `codex:${sharedTaskId}`, sourceId: "codex", status: "working" },
    { id: sharedTaskId, stableId: `claude:${sharedTaskId}`, sourceId: "claude", status: "working" },
  ]);
  assert.deepEqual(sourceAwareSlots.taskIds.slice(0, 2), [`codex:${sharedTaskId}`, `claude:${sharedTaskId}`]);

  const makeTask = (sourceId, index, status = "read") => ({
    id: `${sourceId}-${index}`,
    stableId: `${sourceId}:${index}`,
    sourceId,
    status,
    priority: "recent",
    activityAt: 100 - index,
  });
  const allocationPool = [
    ...Array.from({ length: 6 }, (_, index) => makeTask("codex", index)),
    ...Array.from({ length: 2 }, (_, index) => makeTask("claude", index)),
  ];
  const adaptiveTasks = allocateTasksBySource(allocationPool, undefined);
  assert.equal(adaptiveTasks.filter((task) => task.sourceId === "codex").length, 6);
  assert.equal(adaptiveTasks.filter((task) => task.sourceId === "claude").length, 2);
  const strictTasks = allocateTasksBySource(allocationPool, {
    reservations: { codex: 4, claude: 4 },
    fillUnused: false,
  });
  assert.equal(strictTasks.filter((task) => task.sourceId === "codex").length, 4);
  assert.equal(strictTasks.filter((task) => task.sourceId === "claude").length, 2);
  const balancedPool = [
    ...Array.from({ length: 6 }, (_, index) => makeTask("codex", index)),
    ...Array.from({ length: 6 }, (_, index) => makeTask("claude", index)),
  ];
  const balancedTasks = allocateTasksBySource(balancedPool, undefined);
  assert.equal(balancedTasks.filter((task) => task.sourceId === "codex").length, 4);
  assert.equal(balancedTasks.filter((task) => task.sourceId === "claude").length, 4);
  const customBalancedTasks = allocateTasksBySource(balancedPool, {
    reservations: { codex: 6, claude: 2 },
    fillUnused: false,
  });
  assert.equal(customBalancedTasks.filter((task) => task.sourceId === "codex").length, 6);
  assert.equal(customBalancedTasks.filter((task) => task.sourceId === "claude").length, 2);

  assert.deepEqual(normalizeSourceAllocation({ reservations: { codex: 6, claude: 2 } }), {
    reservations: { codex: 6, claude: 2 },
    fillUnused: true,
  });
  const allocationPath = path.join(temporaryRoot, "source-allocation.json");
  const savedAllocation = writeSourceAllocation(allocationPath, {
    reservations: { codex: 5, claude: 3 },
    fillUnused: false,
  });
  assert.deepEqual(readSourceAllocation(allocationPath), savedAllocation);

  assert.equal(classifyClaudeLifecycle([{ type: "user", message: { content: "Start this task" } }]), "working");
  assert.equal(classifyClaudeLifecycle([{
    type: "assistant",
    message: { content: [{ type: "tool_use", name: "AskUserQuestion" }] },
  }]), "question");
  assert.equal(classifyClaudeLifecycle([{
    type: "assistant",
    message: { content: [{ type: "text", text: "Done" }], stop_reason: "end_turn" },
  }]), "read");
  assert.equal(classifyClaudeLifecycle([{
    type: "assistant",
    message: { content: [{ type: "tool_use", name: "Read" }], stop_reason: "tool_use" },
  }]), "working");
  assert.equal(classifyClaudeLifecycle([{ type: "assistant", message: { content: [] } }, { type: "system", subtype: "stop_hook_summary" }]), "read");
  assert.equal(classifyClaudeLifecycle([
    { type: "system", subtype: "stop_hook_summary" },
    { type: "user", message: { content: [] } },
  ]), "read");
  assert.equal(classifyClaudeLifecycle([
    { type: "system", subtype: "stop_hook_summary" },
    { type: "user", message: { content: "<task-notification><status>completed</status></task-notification>" } },
  ]), "read");
  assert.equal(classifyClaudeLifecycle([{
    type: "result",
    deferred_tool_use: { name: "AskUserQuestion" },
  }]), "question");
  assert.equal(latestClaudeCustomTitle([
    { type: "custom-title", customTitle: "First Claude title" },
    { type: "custom-title", customTitle: "Latest Claude title" },
  ]), "Latest Claude title");
  const linkTaskId = "88888888-8888-4888-8888-888888888888";
  assert.equal(taskDeepLink("claude", linkTaskId), `claude://resume?session=${linkTaskId}`);
  assert.equal(taskDeepLink("codex", linkTaskId), `codex://threads/${linkTaskId}`);
  assert.throws(() => taskDeepLink("claude", "not-a-thread-id"), /invalid task ID/i);
  const claudeSessionId = "77777777-7777-4777-8777-777777777777";
  const claudeDesktopSessionId = "66666666-6666-4666-8666-666666666666";
  const claudeProjectPath = path.join(temporaryRoot, "claude", "projects", "-tmp-deck-threads");
  const claudeDesktopRoot = path.join(temporaryRoot, "claude-desktop");
  const claudeSessionMetadataPath = path.join(
    claudeDesktopRoot,
    "claude-code-sessions",
    "account-id",
    "workspace-id",
    `local_${claudeDesktopSessionId}.json`,
  );
  const claudeDuplicateSessionMetadataPath = path.join(
    path.dirname(claudeSessionMetadataPath),
    `local_${claudeSessionId}.json`,
  );
  const claudeIndexedDbPath = path.join(
    claudeDesktopRoot,
    "IndexedDB",
    "https_claude.ai_0.indexeddb.leveldb",
  );
  fs.mkdirSync(claudeProjectPath, { recursive: true });
  fs.mkdirSync(path.dirname(claudeSessionMetadataPath), { recursive: true });
  fs.mkdirSync(claudeIndexedDbPath, { recursive: true });
  fs.writeFileSync(path.join(claudeProjectPath, `${claudeSessionId}.jsonl`), [
    JSON.stringify({ type: "user" }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "AskUserQuestion" }] } }),
  ].join("\n"));
  fs.writeFileSync(claudeSessionMetadataPath, JSON.stringify({
    sessionId: `local_${claudeDesktopSessionId}`,
    cliSessionId: claudeSessionId,
    title: "Claude sidebar thread name",
    isArchived: false,
    lastActivityAt: Date.now(),
  }));
  fs.writeFileSync(claudeDuplicateSessionMetadataPath, JSON.stringify({
    sessionId: `local_${claudeSessionId}`,
    cliSessionId: claudeSessionId,
    isArchived: false,
    lastActivityAt: Date.now() + 1000,
  }));
  fs.writeFileSync(path.join(claudeIndexedDbPath, "000003.log"), Buffer.concat([
    Buffer.from([0, 4, 9]),
    Buffer.from(JSON.stringify({
      state: { starredIds: [] },
      version: 0,
      updatedAt: 100,
    })),
    Buffer.from([0, 3]),
    Buffer.from(JSON.stringify({
      state: { starredIds: [`local_${claudeDesktopSessionId}`] },
      version: 0,
      updatedAt: 200,
    })),
    Buffer.from([0, 2]),
    Buffer.from(JSON.stringify({
      state: { starredIds: [] },
      version: 0,
      updatedAt: 200,
    })),
  ]));
  const claudeAgents = [{
    cwd: "/tmp/deck-threads",
    kind: "interactive",
    name: "Implement Claude support",
    pid: process.pid,
    sessionId: claudeSessionId,
    startedAt: Date.now() - 1000,
  }];
  assert.equal(normalizeClaudeAgents(claudeAgents).length, 1);
  assert.equal(normalizeClaudeAgents([{ ...claudeAgents[0], archived: true }]).length, 0);
  assert.equal(normalizeClaudeAgents([{ ...claudeAgents[0], status: "archived" }]).length, 0);
  const claudeWorktreeCwd = "/tmp/deck-threads/.claude/worktrees/real-agent";
  const duplicateClaudeAgents = normalizeClaudeAgents([
    { ...claudeAgents[0], cwd: claudeWorktreeCwd },
    {
      ...claudeAgents[0],
      cwd: "/tmp/deck-threads",
      name: "Duplicate base-folder resume",
      startedAt: claudeAgents[0].startedAt + 1000,
    },
  ]);
  assert.equal(duplicateClaudeAgents.length, 1);
  assert.equal(duplicateClaudeAgents[0].cwd, claudeWorktreeCwd);
  assert.equal(readClaudeSessionMetadata(claudeSessionId, claudeDesktopRoot).title, "Claude sidebar thread name");
  assert.equal(readClaudeStarredIds(claudeDesktopRoot).has(claudeDesktopSessionId), true);
  const claudeTasks = tasksFromClaudeAgents(claudeAgents, {
    claudeHome: path.join(temporaryRoot, "claude"),
    claudeDesktopRoot,
  });
  assert.equal(claudeTasks[0].sourceId, "claude");
  assert.equal(claudeTasks[0].stableId, `claude:${claudeSessionId}`);
  assert.equal(claudeTasks[0].openId, claudeDesktopSessionId);
  assert.equal(claudeTasks[0].status, "question");
  assert.equal(claudeTasks[0].projectLabel, "DT1");
  assert.equal(claudeTasks[0].title, "Claude sidebar thread name");
  assert.equal(claudeTasks[0].pinned, true);
  fs.writeFileSync(claudeSessionMetadataPath, JSON.stringify({
    sessionId: `local_${claudeDesktopSessionId}`,
    cliSessionId: claudeSessionId,
    title: "Claude sidebar thread name",
    isArchived: true,
    lastActivityAt: Date.now(),
  }));
  assert.equal(tasksFromClaudeAgents(claudeAgents, {
    claudeHome: path.join(temporaryRoot, "claude"),
    claudeDesktopRoot,
  }).length, 0);
  fs.writeFileSync(claudeSessionMetadataPath, JSON.stringify({
    sessionId: `local_${claudeDesktopSessionId}`,
    cliSessionId: claudeSessionId,
    title: "Claude sidebar thread name",
    isArchived: false,
    lastActivityAt: Date.now(),
  }));
  fs.writeFileSync(path.join(claudeProjectPath, `${claudeSessionId}.jsonl`), [
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash" }], stop_reason: "tool_use" } }),
    JSON.stringify({ type: "user", message: { content: [{ type: "tool_result" }] } }),
  ].join("\n"));
  const staleActivityAt = Date.now() - CLAUDE_ACTIVE_WINDOW_MS - 1000;
  fs.utimesSync(path.join(claudeProjectPath, `${claudeSessionId}.jsonl`), staleActivityAt / 1000, staleActivityAt / 1000);
  const staleClaudeTasks = tasksFromClaudeAgents(claudeAgents, {
    claudeHome: path.join(temporaryRoot, "claude"),
    claudeDesktopRoot,
    nowMs: Date.now(),
  });
  assert.equal(staleClaudeTasks[0].status, "read");
  const settingsPath = path.join(temporaryRoot, "display-settings.json");
  assert.equal(readDisplaySettings(settingsPath).showThreadTitle.read, true);
  assert.equal(readDisplaySettings(settingsPath).showThreadTitle.question, false);
  assert.equal(readDisplaySettings(settingsPath).statusAppearance.codex.working.backgroundColor, "#24375F");
  assert.equal(readDisplaySettings(settingsPath).statusAppearance.claude.question.animation, "pulse");
  assert.deepEqual(readDisplaySettings(settingsPath).typography.codex, { slotHandleFontSize: 17, threadNameFontSize: 12 });
  const savedSettings = writeDisplaySettings(settingsPath, {
    showThreadTitle: { question: true, read: false },
    statusAppearance: {
      codex: { working: { backgroundColor: "#123456", animation: "breathe" } },
      claude: { error: { backgroundColor: "#ABCDEF", animation: "sweep" } },
    },
    typography: {
      codex: { slotHandleFontSize: 24, threadNameFontSize: 16 },
      claude: { slotHandleFontSize: 14, threadNameFontSize: 10 },
    },
  });
  assert.equal(savedSettings.showThreadTitle.question, true);
  assert.equal(savedSettings.showThreadTitle.read, false);
  assert.equal(savedSettings.showThreadTitle.working, false);
  assert.deepEqual(savedSettings.statusAppearance.codex.working, { backgroundColor: "#123456", animation: "breathe" });
  assert.deepEqual(savedSettings.statusAppearance.claude.error, { backgroundColor: "#ABCDEF", animation: "sweep" });
  assert.equal(savedSettings.statusAppearance.codex.read.animation, "still");
  assert.deepEqual(savedSettings.typography.codex, { slotHandleFontSize: 24, threadNameFontSize: 16 });
  assert.deepEqual(savedSettings.typography.claude, { slotHandleFontSize: 14, threadNameFontSize: 10 });
  assert.deepEqual(readDisplaySettings(settingsPath), savedSettings);
  assert.equal(normalizeDisplaySettings({ showThreadTitle: { error: true } }).showThreadTitle.error, true);
  assert.deepEqual(
    normalizeDisplaySettings({ statusAppearance: { codex: { working: { backgroundColor: "invalid", animation: "flash" } } } }).statusAppearance.codex.working,
    { backgroundColor: "#24375F", animation: "sweep" },
  );
  assert.deepEqual(
    normalizeDisplaySettings({ typography: { codex: { slotHandleFontSize: 99, threadNameFontSize: 2 } } }).typography.codex,
    { slotHandleFontSize: 28, threadNameFontSize: 9 },
  );
  process.stdout.write("Codex and Claude lifecycle, allocation, display settings, labels, pins, and stable slots passed.\n");
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
