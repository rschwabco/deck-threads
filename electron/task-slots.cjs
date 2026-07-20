const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_SLOT_COUNT = 8;

function normalizeTaskIds(value, slotCount = DEFAULT_SLOT_COUNT) {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: slotCount }, (_, index) =>
    typeof source[index] === "string" && source[index] ? source[index] : null,
  );
}

function assignStableTaskSlots(tasks, previousTaskIds = [], slotCount = DEFAULT_SLOT_COUNT) {
  const selectedTasks = tasks.slice(0, slotCount);
  const remainingById = new Map(selectedTasks.map((task) => [task.id, task]));
  const slots = Array(slotCount).fill(null);

  normalizeTaskIds(previousTaskIds, slotCount).forEach((taskId, slot) => {
    if (!taskId) return;
    const task = remainingById.get(taskId);
    if (!task) return;
    slots[slot] = { ...task, slot };
    remainingById.delete(taskId);
  });

  for (const task of selectedTasks) {
    if (!remainingById.has(task.id)) continue;
    const slot = slots.findIndex((candidate) => candidate === null);
    if (slot < 0) break;
    slots[slot] = { ...task, slot };
    remainingById.delete(task.id);
  }

  return {
    tasks: slots,
    taskIds: slots.map((task) => task?.id || null),
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
  writeTaskSlotIds,
};
