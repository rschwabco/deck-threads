const TASK_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validTaskId(sourceId, threadId) {
  if (!TASK_ID_PATTERN.test(threadId)) {
    throw new Error(`${sourceId === "claude" ? "Claude" : "Codex"} returned an invalid task ID.`);
  }
}

function taskDeepLink(sourceId, threadId, openId) {
  if (sourceId !== "codex" && sourceId !== "claude") {
    throw new Error("Unknown task source.");
  }
  validTaskId(sourceId, threadId);
  if (sourceId === "claude") {
    if (openId) {
      validTaskId(sourceId, openId);
      return `claude://claude.ai/claude-code-desktop/local_${encodeURIComponent(openId)}`;
    }
    return `claude://resume?session=${encodeURIComponent(threadId)}`;
  }
  return `codex://threads/${encodeURIComponent(threadId)}`;
}

module.exports = { taskDeepLink };
