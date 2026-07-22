const fs = require("node:fs");
const path = require("node:path");

const DISPLAY_STATUSES = ["working", "question", "unread", "read", "waiting", "error"];
const TASK_SOURCES = ["codex", "claude"];
const KEY_ANIMATIONS = ["still", "breathe", "sweep", "pulse"];
const FONT_SIZE_LIMITS = Object.freeze({
  slotHandleFontSize: Object.freeze({ min: 12, max: 28, fallback: 17 }),
  threadNameFontSize: Object.freeze({ min: 9, max: 20, fallback: 12 }),
});
const DEFAULT_STATUS_BACKGROUNDS = Object.freeze({
  working: "#24375F",
  question: "#57321F",
  unread: "#1C4934",
  read: "#2B333F",
  waiting: "#4A3920",
  error: "#4D2730",
});
const DEFAULT_STATUS_ANIMATIONS = Object.freeze({
  working: "sweep",
  question: "pulse",
  unread: "breathe",
  read: "still",
  waiting: "still",
  error: "still",
});

function defaultStatusAppearance() {
  return Object.fromEntries(DISPLAY_STATUSES.map((status) => [status, {
    backgroundColor: DEFAULT_STATUS_BACKGROUNDS[status],
    animation: DEFAULT_STATUS_ANIMATIONS[status],
  }]));
}

const DEFAULT_DISPLAY_SETTINGS = Object.freeze({
  showThreadTitle: Object.freeze({
    working: false,
    question: false,
    unread: false,
    read: true,
    waiting: false,
    error: false,
  }),
  statusAppearance: Object.freeze({
    codex: Object.freeze(defaultStatusAppearance()),
    claude: Object.freeze(defaultStatusAppearance()),
  }),
  typography: Object.freeze({
    codex: Object.freeze({ slotHandleFontSize: 17, threadNameFontSize: 12 }),
    claude: Object.freeze({ slotHandleFontSize: 17, threadNameFontSize: 12 }),
  }),
});

function normalizeColor(value, fallback) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toUpperCase()
    : fallback;
}

function normalizeFontSize(value, limits) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? Math.min(limits.max, Math.max(limits.min, Math.round(numericValue)))
    : limits.fallback;
}

function normalizeDisplaySettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const sourceTitles = source.showThreadTitle && typeof source.showThreadTitle === "object"
    ? source.showThreadTitle
    : {};
  const sourceAppearance = source.statusAppearance && typeof source.statusAppearance === "object"
    ? source.statusAppearance
    : {};
  const sourceTypography = source.typography && typeof source.typography === "object"
    ? source.typography
    : {};
  return {
    showThreadTitle: Object.fromEntries(DISPLAY_STATUSES.map((status) => [
      status,
      typeof sourceTitles[status] === "boolean"
        ? sourceTitles[status]
        : DEFAULT_DISPLAY_SETTINGS.showThreadTitle[status],
    ])),
    statusAppearance: Object.fromEntries(TASK_SOURCES.map((sourceId) => {
      const sourceStatuses = sourceAppearance[sourceId] && typeof sourceAppearance[sourceId] === "object"
        ? sourceAppearance[sourceId]
        : {};
      return [sourceId, Object.fromEntries(DISPLAY_STATUSES.map((status) => {
        const statusValue = sourceStatuses[status] && typeof sourceStatuses[status] === "object"
          ? sourceStatuses[status]
          : {};
        const fallback = DEFAULT_DISPLAY_SETTINGS.statusAppearance[sourceId][status];
        return [status, {
          backgroundColor: normalizeColor(statusValue.backgroundColor, fallback.backgroundColor),
          animation: KEY_ANIMATIONS.includes(statusValue.animation)
            ? statusValue.animation
            : fallback.animation,
        }];
      }))];
    })),
    typography: Object.fromEntries(TASK_SOURCES.map((sourceId) => {
      const sourceValue = sourceTypography[sourceId] && typeof sourceTypography[sourceId] === "object"
        ? sourceTypography[sourceId]
        : {};
      return [sourceId, {
        slotHandleFontSize: normalizeFontSize(sourceValue.slotHandleFontSize, FONT_SIZE_LIMITS.slotHandleFontSize),
        threadNameFontSize: normalizeFontSize(sourceValue.threadNameFontSize, FONT_SIZE_LIMITS.threadNameFontSize),
      }];
    })),
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
  fs.writeFileSync(temporaryPath, `${JSON.stringify({ version: 3, ...normalized }, null, 2)}\n`);
  fs.renameSync(temporaryPath, filePath);
  return normalized;
}

module.exports = {
  DEFAULT_DISPLAY_SETTINGS,
  DEFAULT_STATUS_ANIMATIONS,
  DEFAULT_STATUS_BACKGROUNDS,
  DISPLAY_STATUSES,
  FONT_SIZE_LIMITS,
  KEY_ANIMATIONS,
  TASK_SOURCES,
  normalizeDisplaySettings,
  readDisplaySettings,
  writeDisplaySettings,
};
