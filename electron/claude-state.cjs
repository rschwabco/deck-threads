const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const CLAUDE_SOURCE_ID = "claude";
const CACHE_WINDOW_MS = 2500;
const MAX_TRANSCRIPT_TAIL_BYTES = 256 * 1024;
const MAX_SESSION_METADATA_HEADER_BYTES = 64 * 1024;
const ACTIVE_WINDOW_MS = 30 * 60 * 1000;
const sessionMetadataPathCache = new Map();

function defaultClaudeDesktopRoot() {
  return path.join(os.homedir(), "Library", "Application Support", "Claude");
}

function compareVersions(left, right) {
  return right.localeCompare(left, undefined, { numeric: true, sensitivity: "base" });
}

function findClaudeBinary(options = {}) {
  const explicit = options.binary || process.env.CLAUDE_BINARY;
  if (explicit) return explicit;

  const desktopVersionsRoot = path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "Claude",
    "claude-code",
  );
  try {
    const versions = fs.readdirSync(desktopVersionsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(compareVersions);
    for (const version of versions) {
      const candidate = path.join(
        desktopVersionsRoot,
        version,
        "claude.app",
        "Contents",
        "MacOS",
        "claude",
      );
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {
    // Fall through to standalone Claude Code installations.
  }

  for (const candidate of [
    path.join(os.homedir(), ".local", "bin", "claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return "claude";
}

function cleanTitle(value) {
  const firstLine = String(value || "Claude task")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return (firstLine || "Claude task").replace(/\s+/g, " ").slice(0, 240);
}

function abbreviateProjectName(value) {
  const words = String(value || "Claude")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  if (!words.length) return "CL";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 2).map((word) => word[0].toUpperCase()).join("");
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function findTranscriptPath(sessionId, claudeHome = path.join(os.homedir(), ".claude")) {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId || "")) return undefined;
  const projectsRoot = path.join(claudeHome, "projects");
  try {
    for (const entry of fs.readdirSync(projectsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(projectsRoot, entry.name, `${sessionId}.jsonl`);
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {
    // Claude can be active before it has materialized a transcript.
  }
  return undefined;
}

function findClaudeSessionMetadataPath(sessionId, claudeDesktopRoot = defaultClaudeDesktopRoot()) {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId || "")) return undefined;
  const cacheKey = `${claudeDesktopRoot}\0${sessionId}`;
  const cachedPath = sessionMetadataPathCache.get(cacheKey);
  if (cachedPath && fs.existsSync(cachedPath)) return cachedPath;

  const sessionsRoot = path.join(claudeDesktopRoot, "claude-code-sessions");
  const fileName = `local_${sessionId}.json`;
  const queue = [{ directory: sessionsRoot, depth: 0 }];
  const candidates = new Set();
  while (queue.length) {
    const current = queue.shift();
    const candidate = path.join(current.directory, fileName);
    if (fs.existsSync(candidate)) candidates.add(candidate);
    if (current.depth >= 3) continue;
    try {
      for (const entry of fs.readdirSync(current.directory, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          queue.push({ directory: path.join(current.directory, entry.name), depth: current.depth + 1 });
          continue;
        }
        if (!entry.isFile() || !/^local_[0-9a-f-]{36}\.json$/i.test(entry.name)) continue;
        const metadataPath = path.join(current.directory, entry.name);
        if (metadataPath === candidate) continue;
        let descriptor;
        try {
          const stat = fs.statSync(metadataPath);
          const length = Math.min(stat.size, MAX_SESSION_METADATA_HEADER_BYTES);
          const buffer = Buffer.alloc(length);
          descriptor = fs.openSync(metadataPath, "r");
          fs.readSync(descriptor, buffer, 0, length, 0);
          const prefix = buffer.toString("utf8");
          const cliSessionMatch = prefix.match(/"cliSessionId"\s*:\s*"([0-9a-f-]{36})"/i);
          if (cliSessionMatch?.[1] === sessionId) candidates.add(metadataPath);
        } catch {
          // Claude can replace a session file while the sidebar is updating.
        } finally {
          if (descriptor !== undefined) fs.closeSync(descriptor);
        }
      }
    } catch {
      // Claude may not have created its desktop session store yet.
    }
  }

  const matches = [...candidates].flatMap((metadataPath) => {
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
      const desktopSessionId = String(metadata.sessionId || "").replace(/^local_/, "");
      if (desktopSessionId !== sessionId && metadata.cliSessionId !== sessionId) return [];
      const stat = fs.statSync(metadataPath);
      return [{
        metadataPath,
        archived: metadata.isArchived === true,
        titled: Boolean(String(metadata.title || "").trim()),
        activityAt: Math.max(
          Number(metadata.lastActivityAt) || 0,
          Number(metadata.lastFocusedAt) || 0,
          Number(metadata.createdAt) || 0,
          stat.mtimeMs,
        ),
      }];
    } catch {
      return [];
    }
  });
  matches.sort((left, right) => Number(left.archived) - Number(right.archived)
    || Number(right.titled) - Number(left.titled)
    || right.activityAt - left.activityAt);
  const metadataPath = matches[0]?.metadataPath;
  if (metadataPath) sessionMetadataPathCache.set(cacheKey, metadataPath);
  return metadataPath;
}

function readClaudeSessionMetadata(sessionId, claudeDesktopRoot = defaultClaudeDesktopRoot()) {
  const metadataPath = findClaudeSessionMetadataPath(sessionId, claudeDesktopRoot);
  if (!metadataPath) return undefined;
  try {
    return JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  } catch {
    return undefined;
  }
}

function readClaudeStarredIds(claudeDesktopRoot = defaultClaudeDesktopRoot()) {
  const levelDbRoot = path.join(
    claudeDesktopRoot,
    "IndexedDB",
    "https_claude.ai_0.indexeddb.leveldb",
  );
  let latest = { updatedAt: -1, ids: [] };
  try {
    const files = fs.readdirSync(levelDbRoot)
      .filter((name) => /\.(?:ldb|log)$/i.test(name));
    for (const name of files) {
      const contents = fs.readFileSync(path.join(levelDbRoot, name)).toString("utf8");
      const persistedState = /\{"state":\{"starredIds":(\[[^\]]*\])\},"version":\d+,"updatedAt":(\d+)\}/g;
      let match;
      while ((match = persistedState.exec(contents))) {
        const updatedAt = Number(match[2]);
        try {
          const ids = JSON.parse(match[1]);
          if (
            Array.isArray(ids)
            && Number.isFinite(updatedAt)
            && updatedAt >= latest.updatedAt
            && (updatedAt > latest.updatedAt || ids.length >= latest.ids.length)
          ) {
            latest = { updatedAt, ids };
          }
        } catch {
          // Ignore an incomplete LevelDB record while Claude is writing it.
        }
      }
    }
  } catch {
    return new Set();
  }
  return new Set(latest.ids.flatMap((id) => {
    const value = String(id || "");
    return [value, value.replace(/^local_/, "")];
  }));
}

function readTranscriptTail(filePath, maxBytes = MAX_TRANSCRIPT_TAIL_BYTES) {
  if (!filePath) return [];
  let descriptor;
  try {
    const stat = fs.statSync(filePath);
    const length = Math.min(stat.size, maxBytes);
    const start = Math.max(0, stat.size - length);
    const buffer = Buffer.alloc(length);
    descriptor = fs.openSync(filePath, "r");
    fs.readSync(descriptor, buffer, 0, length, start);
    const lines = buffer.toString("utf8").split("\n");
    if (start > 0) lines.shift();
    return lines.filter(Boolean).flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function classifyClaudeLifecycle(rows) {
  let status = "working";
  for (const row of rows) {
    if (row?.type === "user") {
      const content = row.message?.content;
      const items = Array.isArray(content) ? content : [];
      const hasToolResult = items.some((item) => item?.type === "tool_result");
      const hasText = typeof content === "string"
        ? Boolean(content.trim()) && !/^<task-notification\b/i.test(content.trim())
        : items.some((item) => item?.type === "text" && Boolean(String(item.text || "").trim()));
      // Claude appends empty synthetic user rows after stop hooks. They do not
      // represent a new turn and must not reopen an already completed task.
      if (hasToolResult || hasText) status = "working";
      continue;
    }
    if (row?.type === "assistant") {
      const content = Array.isArray(row.message?.content) ? row.message.content : [];
      const asksQuestion = content.some((item) =>
        item?.type === "tool_use"
        && /^(AskUserQuestion|request_user_input)$/i.test(String(item.name || "")),
      );
      const stopReason = String(row.message?.stop_reason || row.stop_reason || "");
      status = asksQuestion ? "question" : stopReason === "end_turn" ? "read" : "working";
      continue;
    }
    if (row?.type === "result") {
      const deferredTool = row.deferred_tool_use || row.deferredToolUse;
      status = /^(AskUserQuestion|request_user_input)$/i.test(String(deferredTool?.name || ""))
        ? "question"
        : "read";
      continue;
    }
    if (row?.type === "system" && /(?:stop|completed|result)/i.test(String(row.subtype || ""))) {
      status = "read";
    }
  }
  return status;
}

function latestClaudeCustomTitle(rows) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row?.type !== "custom-title") continue;
    const value = row.customTitle || row.title || row.name;
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function projectThreadNumbers(agents) {
  const byProject = new Map();
  for (const agent of agents) {
    const key = agent.cwd || "Claude";
    const group = byProject.get(key) || [];
    group.push(agent);
    byProject.set(key, group);
  }
  const numbers = new Map();
  for (const group of byProject.values()) {
    [...group]
      .sort((left, right) => (left.startedAt || 0) - (right.startedAt || 0)
        || left.sessionId.localeCompare(right.sessionId))
      .forEach((agent, index) => numbers.set(agent.sessionId, index + 1));
  }
  return numbers;
}

function normalizeClaudeAgents(value) {
  const rows = Array.isArray(value) ? value : [];
  const eligible = rows.filter((agent) =>
    /^[0-9a-f-]{36}$/i.test(agent?.sessionId || "")
    && agent?.archived !== true
    && agent?.isArchived !== true
    && String(agent?.status || "").toLowerCase() !== "archived"
    && processIsAlive(agent?.pid),
  );
  const bySessionId = new Map();
  for (const agent of eligible) {
    const current = bySessionId.get(agent.sessionId);
    if (!current) {
      bySessionId.set(agent.sessionId, agent);
      continue;
    }
    const agentIsWorktree = /[/\\]\.claude[/\\]worktrees[/\\]/.test(String(agent.cwd || ""));
    const currentIsWorktree = /[/\\]\.claude[/\\]worktrees[/\\]/.test(String(current.cwd || ""));
    if (
      (agentIsWorktree && !currentIsWorktree)
      || (agentIsWorktree === currentIsWorktree && (agent.startedAt || Infinity) < (current.startedAt || Infinity))
    ) {
      bySessionId.set(agent.sessionId, agent);
    }
  }
  return [...bySessionId.values()];
}

function tasksFromClaudeAgents(agents, options = {}) {
  const claudeHome = options.claudeHome || path.join(os.homedir(), ".claude");
  const claudeDesktopRoot = options.claudeDesktopRoot || defaultClaudeDesktopRoot();
  const nowMs = options.nowMs || Date.now();
  const numbers = projectThreadNumbers(agents);
  const starredIds = readClaudeStarredIds(claudeDesktopRoot);
  const tasks = agents.flatMap((agent) => {
    const transcriptPath = findTranscriptPath(agent.sessionId, claudeHome);
    const transcriptRows = readTranscriptTail(transcriptPath);
    const desktopMetadata = readClaudeSessionMetadata(agent.sessionId, claudeDesktopRoot);
    if (desktopMetadata?.isArchived === true) return [];
    let transcriptStat;
    try {
      transcriptStat = transcriptPath ? fs.statSync(transcriptPath) : undefined;
    } catch {
      // The session may rotate its transcript between discovery and inspection.
    }
    const activityAt = transcriptStat?.mtimeMs || agent.startedAt || nowMs;
    const cwd = typeof agent.cwd === "string" ? agent.cwd : "";
    const projectName = path.basename(cwd) || "Claude";
    const projectAbbreviation = abbreviateProjectName(projectName);
    const projectThreadNumber = numbers.get(agent.sessionId) || 1;
    const lifecycle = classifyClaudeLifecycle(transcriptRows);
    const status = lifecycle === "working" && nowMs - activityAt > ACTIVE_WINDOW_MS
      ? "read"
      : lifecycle;
    const sidebarTitle = desktopMetadata
      ? desktopMetadata.title || "General coding session"
      : latestClaudeCustomTitle(transcriptRows) || agent.name;
    const desktopSessionId = String(desktopMetadata?.sessionId || "");
    const desktopOpenId = desktopSessionId.replace(/^local_/, "");
    return [{
      id: agent.sessionId,
      openId: /^[0-9a-f-]{36}$/i.test(desktopOpenId) ? desktopOpenId : agent.sessionId,
      stableId: `${CLAUDE_SOURCE_ID}:${agent.sessionId}`,
      sourceId: CLAUDE_SOURCE_ID,
      sourceName: "Claude",
      sourceLabel: "CL",
      slot: 0,
      title: cleanTitle(sidebarTitle),
      cwd,
      projectName,
      projectAbbreviation,
      projectThreadNumber,
      projectLabel: `${projectAbbreviation}${projectThreadNumber}`,
      pinned: starredIds.has(agent.sessionId)
        || starredIds.has(desktopSessionId)
        || starredIds.has(desktopSessionId.replace(/^local_/, "")),
      priority: "active",
      status,
      color: status === "question" ? "#FF6D00" : status === "read" ? "#FFFFFF" : "#304FFE",
      activityAt,
      updatedAt: activityAt,
      threadSource: String(agent.kind || "interactive"),
      processId: agent.pid,
    }];
  });
  const attentionRank = { question: 0, working: 1, waiting: 2, unread: 3, read: 4, error: 5 };
  return tasks.sort((left, right) =>
    (attentionRank[left.status] ?? 9) - (attentionRank[right.status] ?? 9)
      || right.activityAt - left.activityAt
      || left.stableId.localeCompare(right.stableId),
  );
}

async function executeClaudeAgents(binary, options = {}) {
  const execOptions = {
    timeout: options.timeoutMs || 3500,
    maxBuffer: 1024 * 1024,
    env: process.env,
  };
  try {
    const { stdout } = await execFileAsync(binary, ["agents", "--json", "--all"], execOptions);
    return JSON.parse(stdout || "[]");
  } catch (error) {
    if (!/unknown|unexpected|option|argument/i.test(String(error.stderr || error.message || ""))) throw error;
    const { stdout } = await execFileAsync(binary, ["agents", "--json"], execOptions);
    return JSON.parse(stdout || "[]");
  }
}

class ClaudeTaskClient {
  constructor(options = {}) {
    this.options = options;
    this.cached = undefined;
    this.inFlight = undefined;
  }

  async readTasks() {
    const now = Date.now();
    if (this.cached && now - this.cached.readAt < CACHE_WINDOW_MS) return this.cached.value;
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.readFresh().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  async readFresh() {
    const binary = findClaudeBinary(this.options);
    const rawAgents = await executeClaudeAgents(binary, this.options);
    const agents = normalizeClaudeAgents(rawAgents);
    const value = {
      tasks: tasksFromClaudeAgents(agents, this.options),
      source: "Claude active-session registry",
      binary,
    };
    this.cached = { readAt: Date.now(), value };
    return value;
  }
}

module.exports = {
  ACTIVE_WINDOW_MS,
  CLAUDE_SOURCE_ID,
  ClaudeTaskClient,
  abbreviateProjectName,
  classifyClaudeLifecycle,
  findClaudeBinary,
  findClaudeSessionMetadataPath,
  findTranscriptPath,
  latestClaudeCustomTitle,
  normalizeClaudeAgents,
  readClaudeSessionMetadata,
  readClaudeStarredIds,
  tasksFromClaudeAgents,
};
