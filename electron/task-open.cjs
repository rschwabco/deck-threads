const TASK_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function taskDeepLink(sourceId, threadId) {
  if (sourceId !== "codex" && sourceId !== "claude") {
    throw new Error("Unknown task source.");
  }
  if (!TASK_ID_PATTERN.test(threadId)) {
    throw new Error(`${sourceId === "claude" ? "Claude" : "Codex"} returned an invalid task ID.`);
  }
  return sourceId === "claude"
    ? `claude://resume?session=${encodeURIComponent(threadId)}`
    : `codex://threads/${encodeURIComponent(threadId)}`;
}

module.exports = { taskDeepLink };
