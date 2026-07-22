const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const {
  AppUpdateController,
  DEFAULT_INITIAL_DELAY_MS,
  DEFAULT_INTERVAL_MS,
  clampProgress,
  isPrereleaseVersion,
} = require("../electron/app-updater.cjs");

class TestUpdater extends EventEmitter {
  constructor() {
    super();
    this.checkResult = "available";
    this.checkCalls = 0;
    this.downloadCalls = 0;
    this.quitCalls = [];
    this.autoDownload = true;
    this.autoInstallOnAppQuit = true;
    this.allowPrerelease = false;
    this.allowDowngrade = true;
    this.downloadDeferred = null;
  }

  async checkForUpdates() {
    this.checkCalls += 1;
    this.emit("checking-for-update");
    if (this.checkResult === "error") {
      this.emit("error", new Error("offline"));
      return null;
    }
    if (this.checkResult === "none") {
      this.emit("update-not-available", { version: "1.0.1" });
      return null;
    }
    this.emit("update-available", { version: "1.0.2", releaseDate: "2026-07-22T00:00:00.000Z" });
    return { updateInfo: { version: "1.0.2" } };
  }

  downloadUpdate() {
    this.downloadCalls += 1;
    if (!this.downloadDeferred) {
      let resolve;
      const promise = new Promise((done) => { resolve = done; });
      this.downloadDeferred = { promise, resolve };
    }
    return this.downloadDeferred.promise;
  }

  quitAndInstall(...args) {
    this.quitCalls.push(args);
  }
}

function createController({ version = "1.0.1", enabled = true, updater = new TestUpdater(), overrides = {} } = {}) {
  const states = [];
  const activities = [];
  let beforeInstallCalls = 0;
  const controller = new AppUpdateController({
    app: { getVersion: () => version },
    updater,
    enabled,
    now: () => new Date("2026-07-22T12:00:00.000Z"),
    onStateChange: (state) => states.push(state),
    onActivity: (activity) => activities.push(activity),
    beforeInstall: async () => { beforeInstallCalls += 1; },
    ...overrides,
  });
  controller.initialize();
  return {
    controller,
    updater,
    states,
    activities,
    beforeInstallCalls: () => beforeInstallCalls,
  };
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

async function main() {
  assert.equal(isPrereleaseVersion("1.0.2-beta.1"), true);
  assert.equal(isPrereleaseVersion("1.0.2"), false);
  assert.equal(clampProgress(104.44), 100);
  assert.equal(clampProgress(-3), 0);
  assert.equal(clampProgress(42.44), 42.4);

  const disabled = createController({ enabled: false });
  assert.equal(disabled.controller.getState().status, "disabled");
  await disabled.controller.checkForUpdates({ manual: true });
  assert.equal(disabled.updater.checkCalls, 0);
  disabled.controller.dispose();

  const stable = createController();
  assert.equal(stable.updater.autoDownload, false);
  assert.equal(stable.updater.autoInstallOnAppQuit, false);
  assert.equal(stable.updater.allowPrerelease, false);
  assert.equal(stable.updater.allowDowngrade, false);
  stable.controller.dispose();

  const prerelease = createController({ version: "1.0.2-beta.1" });
  assert.equal(prerelease.updater.allowPrerelease, true);
  prerelease.controller.dispose();

  const automaticNone = createController();
  automaticNone.updater.checkResult = "none";
  await automaticNone.controller.checkForUpdates({ manual: false });
  assert.equal(automaticNone.controller.getState().status, "idle");
  automaticNone.controller.dispose();

  const manualNone = createController();
  manualNone.updater.checkResult = "none";
  await manualNone.controller.checkForUpdates({ manual: true });
  assert.equal(manualNone.controller.getState().status, "up-to-date");
  assert.equal(manualNone.controller.getState().checkedAt, "2026-07-22T12:00:00.000Z");
  manualNone.controller.dispose();

  const automaticError = createController();
  automaticError.updater.checkResult = "error";
  await automaticError.controller.checkForUpdates({ manual: false });
  assert.equal(automaticError.controller.getState().status, "idle");
  assert.equal(automaticError.activities.at(-1).message, "Could not check for updates");
  automaticError.controller.dispose();

  const manualError = createController();
  manualError.updater.checkResult = "error";
  await manualError.controller.checkForUpdates({ manual: true });
  assert.equal(manualError.controller.getState().status, "error");
  assert.match(manualError.controller.getState().message, /Could not check/);
  manualError.updater.checkResult = "none";
  await manualError.controller.startUpdate();
  assert.equal(manualError.updater.checkCalls, 2);
  assert.equal(manualError.controller.getState().status, "up-to-date");
  manualError.controller.dispose();

  const update = createController();
  await update.controller.checkForUpdates({ manual: false });
  assert.equal(update.controller.getState().status, "available");
  assert.equal(update.controller.getState().availableVersion, "1.0.2");
  const firstDownload = update.controller.startUpdate();
  const duplicateDownload = update.controller.startUpdate();
  await flush();
  assert.equal(update.updater.downloadCalls, 1);
  update.updater.emit("download-progress", { percent: 53.25 });
  assert.equal(update.controller.getState().progress, 53.3);
  update.updater.emit("update-downloaded", { version: "1.0.2" });
  await flush();
  assert.equal(update.controller.getState().status, "installing");
  assert.equal(update.beforeInstallCalls(), 1);
  assert.deepEqual(update.updater.quitCalls, [[false, true]]);
  update.updater.downloadDeferred.resolve([]);
  await Promise.all([firstDownload, duplicateDownload]);
  update.controller.dispose();

  const scheduledDelays = [];
  const scheduledIntervals = [];
  const scheduled = createController({
    overrides: {
      setTimeoutFn: (_callback, delay) => {
        scheduledDelays.push(delay);
        return { unref() {} };
      },
      clearTimeoutFn: () => undefined,
      setIntervalFn: (_callback, delay) => {
        scheduledIntervals.push(delay);
        return { unref() {} };
      },
      clearIntervalFn: () => undefined,
    },
  });
  scheduled.controller.startScheduling();
  assert.deepEqual(scheduledDelays, [DEFAULT_INITIAL_DELAY_MS]);
  assert.deepEqual(scheduledIntervals, [DEFAULT_INTERVAL_MS]);
  scheduled.controller.dispose();

  console.log("Application updater state machine verified.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
