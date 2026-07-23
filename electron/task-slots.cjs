const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_SLOT_COUNT = 8;

function normalizeTaskIds(value, slotCount = DEFAULT_SLOT_COUNT) {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: slotCount }, (_, index) =>
    typeof source[index] === "string" && source[index] ? source[index] : null,
  );
}

function taskIdentity(task) {
  if (typeof task?.stableId === "string" && task.stableId) return task.stableId;
  if (typeof task?.sourceId === "string" && task.sourceId && typeof task?.id === "string") {
    return `${task.sourceId}:${task.id}`;
  }
  return task?.id;
}

function assignStableTaskSlots(tasks, previousTaskIds = [], slotCount = DEFAULT_SLOT_COUNT) {
  const selectedTasks = tasks.slice(0, slotCount);
  const remainingById = new Map(selectedTasks.map((task) => [taskIdentity(task), task]));
  const slots = Array(slotCount).fill(null);

  normalizeTaskIds(previousTaskIds, slotCount).forEach((taskId, slot) => {
    if (!taskId) return;
    const task = remainingById.get(taskId)
      || selectedTasks.find((candidate) => candidate.id === taskId && remainingById.has(taskIdentity(candidate)));
    if (!task) return;
    slots[slot] = { ...task, slot };
    remainingById.delete(taskIdentity(task));
  });

  for (const task of selectedTasks) {
    const identity = taskIdentity(task);
    if (!remainingById.has(identity)) continue;
    const slot = slots.findIndex((candidate) => candidate === null);
    if (slot < 0) break;
    slots[slot] = { ...task, slot };
    remainingById.delete(identity);
  }

  return {
    tasks: slots,
    taskIds: slots.map((task) => taskIdentity(task) || null),
  };
}

function readTaskSlotIds(filePath, slotCount = DEFAULT_SLOT_COUNT) {
  try {
    const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return normalizeTaskIds(payload.taskIds, slotCount);
  } catch {
    return normalizeTaskIds([], slotCount);
  }
}

function writeTaskSlotIds(filePath, taskIds) {
  const normalized = normalizeTaskIds(taskIds);
  const directory = path.dirname(filePath);
  const temporaryPath = `${filePath}.tmp`;
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(temporaryPath, `${JSON.stringify({ version: 1, taskIds: normalized }, null, 2)}\n`);
  fs.renameSync(temporaryPath, filePath);
}

module.exports = {
  DEFAULT_SLOT_COUNT,
  assignStableTaskSlots,
  readTaskSlotIds,
  taskIdentity,
  writeTaskSlotIds,
};
