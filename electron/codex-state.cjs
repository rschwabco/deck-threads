const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const ACTIVE_WINDOW_SECONDS = 30 * 60;
const ACTIVE_PRIORITY_WINDOW_MS = 6 * 60 * 60 * 1000;

const STATUS_COLORS = {
  working: "#304FFE",
  question: "#FF6D00",
  unread: "#00FF4C",
  read: "#FFFFFF",
  waiting: "#F5A742",
  error: "#FF0033",
  off: "#000000",
};

function firstExisting(paths) {
  return paths.find((candidate) => fs.existsSync(candidate));
}

function codexDatabasePaths(codexHome = path.join(os.homedir(), ".codex")) {
  return {
    state: firstExisting([
      path.join(codexHome, "state_5.sqlite"),
      path.join(codexHome, "sqlite", "state_5.sqlite"),
    ]),
    logs: firstExisting([
      path.join(codexHome, "logs_2.sqlite"),
      path.join(codexHome, "sqlite", "logs_2.sqlite"),
    ]),
  };
}

function cleanTitle(value) {
  const firstLine = String(value || "Untitled task")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) || "Untitled task";
  return firstLine
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\(https?:\/\/[^)]+\)/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTurnId(body) {
  return String(body || "").match(/turn\.id=([0-9a-f-]{36})/)?.[1];
}

function extractRequestedToolName(body) {
  const text = String(body || "");
  const marker = "handle_output_item_done: ToolCall: ";
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return undefined;
  return text.slice(markerIndex + marker.length).match(/^([^\s]+)/)?.[1];
}

function extractCompletedToolName(body) {
  const text = String(body || "");
  const marker = "tool call completed";
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return undefined;
  return text.slice(markerIndex + marker.length).match(/\btool_name=([^\s]+)/)?.[1];
}

function readGlobalState(codexHome = path.join(os.homedir(), ".codex")) {
  const candidates = [
    path.join(codexHome, ".codex-global-state.json"),
    path.join(codexHome, ".codex-global-state.json.bak"),
  ];

  for (const candidate of candidates) {
    try {
      return JSON.parse(fs.readFileSync(candidate, "utf8"));
    } catch {
      // Codex replaces this file atomically. Try the backup if we caught it mid-write.
    }
  }

  return {};
}

function readUnreadThreadIds(codexHome = path.join(os.homedir(), ".codex")) {
  const state = readGlobalState(codexHome);
  const rawPersistedState = state["electron-persisted-atom-state"];
  let persistedState = rawPersistedState;
  if (typeof rawPersistedState === "string") {
    try {
      persistedState = JSON.parse(rawPersistedState);
    } catch {
      persistedState = undefined;
    }
  }
  const ids = persistedState?.["unread-thread-ids-by-host-v1"]?.local;
  if (Array.isArray(ids)) return new Set(ids.filter((id) => typeof id === "string"));
  return new Set();
}

function abbreviateProjectName(projectName) {
  const words = String(projectName || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  if (!words.length) return "CX";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 2).map((word) => word[0].toUpperCase()).join("");
}

function projectForThread(state, threadId, cwd) {
  const assignment = state["thread-project-assignments"]?.[threadId];
  const assignedProject = assignment?.projectId
    ? state["local-projects"]?.[assignment.projectId]
    : undefined;
  if (assignment?.projectId) {
    return {
      key: `project:${assignment.projectId}`,
      name: assignedProject?.name || path.basename(cwd || "") || "Codex",
    };
  }

  const workspaceLabel = state["electron-workspace-root-labels"]?.[cwd];
  return {
    key: `workspace:${cwd || "codex"}`,
    name: workspaceLabel || path.basename(cwd || "") || "Codex",
  };
}

function assignProjectThreadNumbers(rows, state) {
  const rowsByProject = new Map();

  for (const row of rows) {
    const project = projectForThread(state, row.id, row.cwd);
    const projectRows = rowsByProject.get(project.key) || [];
    projectRows.push(row);
    rowsByProject.set(project.key, projectRows);
  }

  const numberByThreadId = new Map();
  const savedOrders = state["sidebar-project-thread-orders"] || {};

  for (const [projectKey, projectRows] of rowsByProject) {
    const fallbackOrder = [...projectRows].sort((left, right) =>
      (left.createdAt || 0) - (right.createdAt || 0)
        || left.id.localeCompare(right.id),
    );
    const projectId = projectKey.startsWith("project:")
      ? projectKey.slice("project:".length)
      : undefined;
    const manualThreadIds = projectId && Array.isArray(savedOrders[projectId]?.threadIds)
      ? savedOrders[projectId].threadIds
      : [];
    const rowById = new Map(fallbackOrder.map((row) => [row.id, row]));
    const orderedRows = [];

    for (const threadId of manualThreadIds) {
      const row = rowById.get(threadId);
      if (!row) continue;
      orderedRows.push(row);
      rowById.delete(threadId);
    }
    orderedRows.push(...fallbackOrder.filter((row) => rowById.has(row.id)));
    orderedRows.forEach((row, index) => numberByThreadId.set(row.id, index + 1));
  }

  return numberByThreadId;
}

function prioritizeTasks(tasks, nowMs = Date.now(), limit = 8) {
  const activeCutoff = nowMs - ACTIVE_PRIORITY_WINDOW_MS;
  return [...tasks]
    .map((task) => ({
      ...task,
      priority: task.activityAt >= activeCutoff ? "active" : task.pinned ? "pinned" : "recent",
    }))
    .sort((left, right) => {
      const rank = { active: 0, pinned: 1, recent: 2 };
      const attentionRank = { question: 0, working: 1 };
      return (attentionRank[left.status] ?? 2) - (attentionRank[right.status] ?? 2)
        || rank[left.priority] - rank[right.priority]
        || right.activityAt - left.activityAt;
    })
    .slice(0, limit);
}

function readThreadStatus(logsDb, threadId, nowSeconds, unreadThreadIds) {
  const latestTurnRow = logsDb.prepare(`
    SELECT ts, level, target, feedback_log_body AS body
    FROM logs
    WHERE thread_id = ?
      AND feedback_log_body LIKE '%turn.id=%'
    ORDER BY id DESC
    LIMIT 1
  `).get(threadId);

  if (!latestTurnRow) {
    return {
      status: unreadThreadIds.has(threadId) ? "unread" : "read",
      updatedAt: undefined,
      turnId: undefined,
    };
  }

  const turnId = extractTurnId(latestTurnRow.body);
  if (!turnId) {
    return {
      status: unreadThreadIds.has(threadId) ? "unread" : "read",
      updatedAt: latestTurnRow.ts * 1000,
      turnId: undefined,
    };
  }

  const completed = logsDb.prepare(`
    SELECT ts
    FROM logs
    WHERE thread_id = ?
      AND target = 'codex_core::session::turn'
      AND feedback_log_body LIKE ?
      AND feedback_log_body LIKE '%model_needs_follow_up=false%'
    ORDER BY id DESC
    LIMIT 1
  `).get(threadId, `%turn.id=${turnId}%`);

  if (completed) {
    return {
      status: unreadThreadIds.has(threadId) ? "unread" : "read",
      updatedAt: completed.ts * 1000,
      turnId,
    };
  }

  const pendingQuestion = logsDb.prepare(`
    SELECT id, ts, feedback_log_body AS body
    FROM logs
    WHERE thread_id = ?
      AND target = 'codex_core::stream_events_utils'
      AND feedback_log_body LIKE ?
      AND feedback_log_body LIKE '%handle_output_item_done: ToolCall:%'
    ORDER BY id DESC
  `).all(threadId, `%turn.id=${turnId}%`)
    .find((row) => extractRequestedToolName(row.body) === "request_user_input");

  if (pendingQuestion) {
    const questionCompleted = logsDb.prepare(`
      SELECT id, feedback_log_body AS body
      FROM logs
      WHERE thread_id = ?
        AND id > ?
        AND feedback_log_body LIKE ?
        AND feedback_log_body LIKE '%tool call completed%'
      ORDER BY id ASC
    `).all(threadId, pendingQuestion.id, `%turn.id=${turnId}%`)
      .find((row) => extractCompletedToolName(row.body) === "request_user_input");

    if (!questionCompleted) {
      return {
        status: "question",
        updatedAt: pendingQuestion.ts * 1000,
        turnId,
      };
    }
  }

  if (nowSeconds - latestTurnRow.ts <= ACTIVE_WINDOW_SECONDS) {
    return { status: "working", updatedAt: latestTurnRow.ts * 1000, turnId };
  }

  return {
    status: unreadThreadIds.has(threadId) ? "unread" : "read",
    updatedAt: latestTurnRow.ts * 1000,
    turnId,
  };
}

function readCodexTasks(options = {}) {
  const paths = codexDatabasePaths(options.codexHome);
  if (!paths.state) throw new Error("Codex state database was not found.");

  const stateDb = new DatabaseSync(paths.state, { readOnly: true });
  const logsDb = paths.logs ? new DatabaseSync(paths.logs, { readOnly: true }) : undefined;
  const globalState = readGlobalState(options.codexHome);
  const unreadThreadIds = readUnreadThreadIds(options.codexHome);
  const pinnedThreadIds = new Set(
    Array.isArray(globalState["pinned-thread-ids"])
      ? globalState["pinned-thread-ids"].filter((id) => typeof id === "string")
      : [],
  );

  try {
    const rows = stateDb.prepare(`
      SELECT
        id,
        title,
        cwd,
        COALESCE(created_at_ms, created_at * 1000) AS createdAt,
        recency_at_ms AS recencyAt,
        updated_at_ms AS updatedAt,
        thread_source AS threadSource,
        archived
      FROM threads
      WHERE thread_source IN ('user', 'automation')
        AND COALESCE(archived, 0) = 0
      ORDER BY recency_at_ms DESC
    `).all();

    const nowMs = Date.now();
    const nowSeconds = Math.floor(nowMs / 1000);
    const activeCutoff = nowMs - ACTIVE_PRIORITY_WINDOW_MS;
    const candidateRows = rows.filter((row, index) =>
      index < 32
      || pinnedThreadIds.has(row.id)
      || Math.max(row.recencyAt || 0, row.updatedAt || 0) >= activeCutoff,
    );
    const projectThreadNumbers = assignProjectThreadNumbers(rows, globalState);
    const candidates = candidateRows.map((row) => {
      const lifecycle = logsDb
        ? readThreadStatus(logsDb, row.id, nowSeconds, unreadThreadIds)
        : {
            status: unreadThreadIds.has(row.id) ? "unread" : "read",
            updatedAt: row.updatedAt,
            turnId: undefined,
          };
      const project = projectForThread(globalState, row.id, row.cwd);
      const projectName = project.name;
      const projectAbbreviation = abbreviateProjectName(projectName);
      return {
        id: row.id,
        title: cleanTitle(row.title),
        cwd: row.cwd,
        projectName,
        projectAbbreviation,
        projectThreadNumber: projectThreadNumbers.get(row.id) || 1,
        pinned: pinnedThreadIds.has(row.id),
        status: lifecycle.status,
        color: STATUS_COLORS[lifecycle.status],
        updatedAt: lifecycle.updatedAt || row.updatedAt || row.recencyAt,
        activityAt: Math.max(lifecycle.updatedAt || 0, row.updatedAt || 0, row.recencyAt || 0),
        turnId: lifecycle.turnId,
        threadSource: row.threadSource,
      };
    });
    const tasks = prioritizeTasks(candidates, nowMs).map((task, index) => {
      return {
        ...task,
        slot: index,
        projectLabel: `${task.projectAbbreviation}${task.projectThreadNumber}`,
      };
    });

    return {
      tasks,
      statePath: paths.state,
      logsPath: paths.logs,
      source: paths.logs ? "Codex desktop state + runtime logs" : "Codex desktop state",
    };
  } finally {
    logsDb?.close();
    stateDb.close();
  }
}

module.exports = {
  STATUS_COLORS,
  ACTIVE_PRIORITY_WINDOW_MS,
  abbreviateProjectName,
  assignProjectThreadNumbers,
  prioritizeTasks,
  readCodexTasks,
  readThreadStatus,
  readUnreadThreadIds,
};
