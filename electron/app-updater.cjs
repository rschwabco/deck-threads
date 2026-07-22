const { EventEmitter } = require("node:events");

const DEFAULT_INITIAL_DELAY_MS = 15_000;
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;
const UP_TO_DATE_DISPLAY_MS = 8_000;

function isPrereleaseVersion(version) {
  return typeof version === "string" && version.includes("-");
}

function clampProgress(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  return Math.max(0, Math.min(100, Math.round(number * 10) / 10));
}

function errorDetail(error) {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown update error");
}

function availableVersion(info) {
  return typeof info?.version === "string" ? info.version : undefined;
}

class AppUpdateController {
  constructor({
    app,
    updater,
    enabled,
    onStateChange = () => undefined,
    onActivity = () => undefined,
    beforeInstall = async () => undefined,
    now = () => new Date(),
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
  }) {
    this.app = app;
    this.updater = updater;
    this.enabled = Boolean(enabled && updater);
    this.onStateChange = onStateChange;
    this.onActivity = onActivity;
    this.beforeInstall = beforeInstall;
    this.now = now;
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;
    this.operation = null;
    this.downloadPromise = null;
    this.installStarted = false;
    this.listeners = [];
    this.initialTimer = null;
    this.intervalTimer = null;
    this.upToDateTimer = null;
    this.state = {
      status: this.enabled ? "idle" : "disabled",
      currentVersion: app.getVersion(),
      message: this.enabled ? undefined : "Updates are available in the installed macOS app.",
    };
  }

  getState() {
    return { ...this.state };
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    this.onStateChange(this.getState());
    return this.getState();
  }

  listen(event, handler) {
    this.updater.on(event, handler);
    this.listeners.push([event, handler]);
  }

  initialize() {
    if (!this.enabled) {
      this.onStateChange(this.getState());
      return this.getState();
    }

    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = false;
    this.updater.allowPrerelease = isPrereleaseVersion(this.app.getVersion());
    this.updater.allowDowngrade = false;

    this.listen("checking-for-update", () => {
      if (this.operation === "manual-check") {
        this.setState({ status: "checking", progress: undefined, message: "Checking for updates..." });
      }
    });

    this.listen("update-available", (info) => {
      const version = availableVersion(info);
      this.operation = null;
      this.clearUpToDateTimer();
      this.setState({
        status: "available",
        availableVersion: version,
        releaseDate: info?.releaseDate,
        progress: undefined,
        checkedAt: this.now().toISOString(),
        message: "Deck Threads will restart when the download finishes.",
      });
      this.onActivity({
        level: "info",
        message: "Deck Threads update available",
        detail: version ? `Version ${version}` : undefined,
      });
    });

    this.listen("update-not-available", () => {
      const manual = this.operation === "manual-check";
      this.operation = null;
      this.clearUpToDateTimer();
      this.setState({
        status: manual ? "up-to-date" : "idle",
        availableVersion: undefined,
        releaseDate: undefined,
        progress: undefined,
        checkedAt: this.now().toISOString(),
        message: manual ? "Deck Threads is up to date." : undefined,
      });
      if (manual) this.scheduleUpToDateDismissal();
    });

    this.listen("download-progress", (progress) => {
      this.setState({
        status: "downloading",
        progress: clampProgress(progress?.percent),
        message: "Downloading the update...",
      });
    });

    this.listen("update-downloaded", (info) => {
      void this.installDownloadedUpdate(info);
    });

    this.listen("error", (error) => {
      this.handleError(error);
    });

    this.onStateChange(this.getState());
    return this.getState();
  }

  startScheduling(initialDelayMs = DEFAULT_INITIAL_DELAY_MS, intervalMs = DEFAULT_INTERVAL_MS) {
    if (!this.enabled || this.initialTimer || this.intervalTimer) return;
    this.initialTimer = this.setTimeoutFn(() => {
      this.initialTimer = null;
      void this.checkForUpdates({ manual: false });
    }, initialDelayMs);
    this.initialTimer?.unref?.();
    this.intervalTimer = this.setIntervalFn(() => {
      void this.checkForUpdates({ manual: false });
    }, intervalMs);
    this.intervalTimer?.unref?.();
  }

  async checkForUpdates({ manual = false } = {}) {
    if (!this.enabled) return this.getState();
    if (["checking", "available", "downloading", "installing"].includes(this.state.status)) {
      return this.getState();
    }

    this.operation = manual ? "manual-check" : "automatic-check";
    if (manual) {
      this.setState({ status: "checking", progress: undefined, message: "Checking for updates..." });
    }
    try {
      await this.updater.checkForUpdates();
    } catch (error) {
      if (this.operation) this.handleError(error);
    }
    return this.getState();
  }

  async startUpdate() {
    if (!this.enabled) return this.getState();
    if (this.downloadPromise) return this.downloadPromise;

    if (this.state.status === "error" && !this.state.availableVersion) {
      return this.checkForUpdates({ manual: true });
    }
    if (!this.state.availableVersion || !["available", "error"].includes(this.state.status)) {
      return this.getState();
    }

    this.operation = "download";
    this.setState({ status: "downloading", progress: 0, message: "Downloading the update..." });
    this.downloadPromise = Promise.resolve()
      .then(() => this.updater.downloadUpdate())
      .then(() => this.getState())
      .catch((error) => {
        if (this.operation) this.handleError(error);
        return this.getState();
      })
      .finally(() => {
        if (this.state.status === "error") this.downloadPromise = null;
      });
    return this.downloadPromise;
  }

  async installDownloadedUpdate(info) {
    if (this.installStarted) return;
    this.installStarted = true;
    this.operation = "install";
    const version = availableVersion(info) || this.state.availableVersion;
    this.setState({
      status: "installing",
      availableVersion: version,
      progress: 100,
      message: "Installing the update. Deck Threads will reopen automatically.",
    });
    try {
      await this.beforeInstall();
      this.updater.quitAndInstall(false, true);
    } catch (error) {
      this.installStarted = false;
      this.handleError(error);
    }
  }

  handleError(error) {
    const operation = this.operation;
    this.operation = null;
    const duringDownload = operation === "download" || this.state.status === "downloading" || this.state.status === "installing";
    const automatic = operation === "automatic-check";
    const message = duringDownload
      ? "The update could not be installed. Check your connection and try again."
      : "Could not check for updates. Check your connection and try again.";

    this.onActivity({
      level: "warning",
      message: duringDownload ? "Deck Threads update failed" : "Could not check for updates",
      detail: errorDetail(error),
    });

    if (automatic) {
      this.setState({ status: "idle", progress: undefined, message: undefined });
      return;
    }
    this.setState({ status: "error", progress: undefined, message });
  }

  scheduleUpToDateDismissal() {
    this.upToDateTimer = this.setTimeoutFn(() => {
      this.upToDateTimer = null;
      if (this.state.status === "up-to-date") {
        this.setState({ status: "idle", message: undefined });
      }
    }, UP_TO_DATE_DISPLAY_MS);
    this.upToDateTimer?.unref?.();
  }

  clearUpToDateTimer() {
    if (!this.upToDateTimer) return;
    this.clearTimeoutFn(this.upToDateTimer);
    this.upToDateTimer = null;
  }

  dispose() {
    if (this.initialTimer) this.clearTimeoutFn(this.initialTimer);
    if (this.intervalTimer) this.clearIntervalFn(this.intervalTimer);
    this.clearUpToDateTimer();
    this.initialTimer = null;
    this.intervalTimer = null;
    for (const [event, handler] of this.listeners) {
      this.updater.removeListener(event, handler);
    }
    this.listeners = [];
  }
}

class FixtureUpdater extends EventEmitter {
  constructor(mode = "available", version = "1.0.2") {
    super();
    this.mode = mode;
    this.version = version;
    this.autoDownload = false;
    this.autoInstallOnAppQuit = false;
    this.allowPrerelease = false;
    this.allowDowngrade = false;
    this.quitAndInstallCalled = false;
    this.downloadAttempts = 0;
  }

  async checkForUpdates() {
    this.emit("checking-for-update");
    if (this.mode === "check-error") {
      this.emit("error", new Error("Fixture update check failed"));
      return null;
    }
    if (this.mode === "up-to-date") {
      this.emit("update-not-available", { version: this.version });
      return null;
    }
    this.emit("update-available", { version: this.version, releaseDate: new Date().toISOString() });
    return { updateInfo: { version: this.version } };
  }

  async downloadUpdate() {
    this.downloadAttempts += 1;
    this.emit("download-progress", { percent: 24 });
    await new Promise((resolve) => setTimeout(resolve, 120));
    this.emit("download-progress", { percent: 68 });
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (this.mode === "download-error" || (this.mode === "download-error-once" && this.downloadAttempts === 1)) {
      this.emit("error", new Error("Fixture update download failed"));
      return [];
    }
    this.emit("update-downloaded", { version: this.version });
    return [];
  }

  quitAndInstall() {
    this.quitAndInstallCalled = true;
  }
}

function createFixtureUpdater(mode) {
  return new FixtureUpdater(mode || "available");
}

module.exports = {
  AppUpdateController,
  DEFAULT_INITIAL_DELAY_MS,
  DEFAULT_INTERVAL_MS,
  FixtureUpdater,
  clampProgress,
  createFixtureUpdater,
  isPrereleaseVersion,
};
