const fs = require("node:fs");
const path = require("node:path");

const DISPLAY_STATUSES = ["working", "question", "unread", "read", "waiting", "error"];
const DEFAULT_DISPLAY_SETTINGS = Object.freeze({
  showThreadTitle: Object.freeze({
    working: false,
    question: false,
    unread: false,
    read: true,
    waiting: false,
    error: false,
  }),
});

function normalizeDisplaySettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const sourceTitles = source.showThreadTitle && typeof source.showThreadTitle === "object"
    ? source.showThreadTitle
    : {};
  return {
    showThreadTitle: Object.fromEntries(DISPLAY_STATUSES.map((status) => [
      status,
      typeof sourceTitles[status] === "boolean"
        ? sourceTitles[status]
        : DEFAULT_DISPLAY_SETTINGS.showThreadTitle[status],
    ])),
  };
}

function readDisplaySettings(filePath) {
  try {
    return normalizeDisplaySettings(JSON.parse(fs.readFileSync(filePath, "utf8")));
  } catch {
    return normalizeDisplaySettings();
  }
}

function writeDisplaySettings(filePath, value) {
  const normalized = normalizeDisplaySettings(value);
  const directory = path.dirname(filePath);
  const temporaryPath = `${filePath}.tmp`;
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(temporaryPath, `${JSON.stringify({ version: 1, ...normalized }, null, 2)}\n`);
  fs.renameSync(temporaryPath, filePath);
  return normalized;
}

module.exports = {
  DEFAULT_DISPLAY_SETTINGS,
  DISPLAY_STATUSES,
  normalizeDisplaySettings,
  readDisplaySettings,
  writeDisplaySettings,
};
