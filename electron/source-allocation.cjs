const fs = require("node:fs");
const path = require("node:path");

const SOURCE_IDS = ["codex", "claude"];
const SLOT_COUNT = 8;
const DEFAULT_SOURCE_ALLOCATION = Object.freeze({
  reservations: Object.freeze({ codex: 4, claude: 4 }),
  fillUnused: true,
});

function clampSlotCount(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(SLOT_COUNT, Math.round(number)));
}

function normalizeSourceAllocation(value) {
  const source = value && typeof value === "object" ? value : {};
  const reservations = source.reservations && typeof source.reservations === "object"
    ? source.reservations
    : {};
  const codex = clampSlotCount(reservations.codex, DEFAULT_SOURCE_ALLOCATION.reservations.codex);
  const requestedClaude = clampSlotCount(reservations.claude, SLOT_COUNT - codex);
  const claude = codex + requestedClaude === SLOT_COUNT ? requestedClaude : SLOT_COUNT - codex;
  return {
    reservations: { codex, claude },
    fillUnused: typeof source.fillUnused === "boolean"
      ? source.fillUnused
      : DEFAULT_SOURCE_ALLOCATION.fillUnused,
  };
}

function compareTasks(left, right) {
  const attentionRank = { question: 0, working: 1, waiting: 2, unread: 3, error: 4, read: 5 };
  const priorityRank = { active: 0, pinned: 1, recent: 2 };
  return (attentionRank[left.status] ?? 9) - (attentionRank[right.status] ?? 9)
    || (priorityRank[left.priority] ?? 9) - (priorityRank[right.priority] ?? 9)
    || (right.activityAt || 0) - (left.activityAt || 0)
    || String(left.stableId || left.id).localeCompare(String(right.stableId || right.id));
}

function allocateTasksBySource(tasks, value, slotCount = SLOT_COUNT) {
  const settings = normalizeSourceAllocation(value);
  const grouped = new Map();
  for (const task of Array.isArray(tasks) ? tasks : []) {
    const sourceId = SOURCE_IDS.includes(task?.sourceId) ? task.sourceId : "codex";
    const group = grouped.get(sourceId) || [];
    group.push(task);
    grouped.set(sourceId, group);
  }
  for (const group of grouped.values()) group.sort(compareTasks);

  const selected = [];
  const selectedIds = new Set();
  for (const sourceId of SOURCE_IDS) {
    const reservation = Math.min(settings.reservations[sourceId] || 0, slotCount - selected.length);
    for (const task of (grouped.get(sourceId) || []).slice(0, reservation)) {
      selected.push(task);
      selectedIds.add(task.stableId || `${sourceId}:${task.id}`);
    }
  }

  if (settings.fillUnused && selected.length < slotCount) {
    const overflow = [...grouped.values()]
      .flat()
      .filter((task) => !selectedIds.has(task.stableId || `${task.sourceId || "codex"}:${task.id}`))
      .sort(compareTasks);
    selected.push(...overflow.slice(0, slotCount - selected.length));
  }
  return selected.slice(0, slotCount);
}

function readSourceAllocation(filePath) {
  try {
    return normalizeSourceAllocation(JSON.parse(fs.readFileSync(filePath, "utf8")));
  } catch {
    return normalizeSourceAllocation();
  }
}

function writeSourceAllocation(filePath, value) {
  const normalized = normalizeSourceAllocation(value);
  const directory = path.dirname(filePath);
  const temporaryPath = `${filePath}.tmp`;
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(temporaryPath, `${JSON.stringify({ version: 1, ...normalized }, null, 2)}\n`);
  fs.renameSync(temporaryPath, filePath);
  return normalized;
}

module.exports = {
  DEFAULT_SOURCE_ALLOCATION,
  SLOT_COUNT,
  SOURCE_IDS,
  allocateTasksBySource,
  compareTasks,
  normalizeSourceAllocation,
  readSourceAllocation,
  writeSourceAllocation,
};
