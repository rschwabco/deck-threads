const { app, BrowserWindow, ipcMain, Menu, nativeImage, nativeTheme, shell, Tray } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { CodexAppServerClient } = require("./codex-app-server.cjs");
const { ClaudeTaskClient } = require("./claude-state.cjs");
const { readCodexTasks } = require("./codex-state.cjs");
const { readDisplaySettings, writeDisplaySettings } = require("./display-settings.cjs");
const { taskDeepLink } = require("./task-open.cjs");
const {
  allocateTasksBySource,
  readSourceAllocation,
  writeSourceAllocation,
} = require("./source-allocation.cjs");
const { assignStableTaskSlots, readTaskSlotIds, writeTaskSlotIds } = require("./task-slots.cjs");
const { installBundledStreamDeckPlugin } = require("./stream-deck-plugin-install.cjs");

const execFileAsync = promisify(execFile);
const BRIDGE_HOST = "127.0.0.1";
const STREAM_DECK_PLUGIN_BUNDLE = "com.roie.deck-threads.sdPlugin";
const requestedBridgePort = Number(process.env.DECK_THREADS_BRIDGE_PORT);
const BRIDGE_PORT = Number.isInteger(requestedBridgePort) && requestedBridgePort > 0 && requestedBridgePort <= 65535
  ? requestedBridgePort
  : 9876;

app.setName("Deck Threads");

if (process.env.DECK_THREADS_USER_DATA_DIR) {
  app.setPath("userData", process.env.DECK_THREADS_USER_DATA_DIR);
}

let mainWindow;
let tray;
let isQuitting = false;
let previousTaskStates = new Map();
let stableTaskIds;
let bridgeServer;
const codexAppServer = new CodexAppServerClient();
const claudeTaskClient = new ClaudeTaskClient();

function displaySettingsPath() {
  return path.join(app.getPath("userData"), "display-settings.json");
}

function getDisplaySettings() {
  return readDisplaySettings(displaySettingsPath());
}

function sourceAllocationPath() {
  return path.join(app.getPath("userData"), "source-allocation.json");
}

function getSourceAllocation() {
  return readSourceAllocation(sourceAllocationPath());
}

function getResourcePath(filename) {
  return app.isPackaged
    ? path.join(process.resourcesPath, filename)
    : path.join(__dirname, "..", "build", filename);
}

async function ensureBundledStreamDeckPlugin() {
  if (process.platform !== "darwin" || !app.isPackaged) {
    return { status: "development" };
  }

  const source = path.join(process.resourcesPath, "stream-deck-plugin", STREAM_DECK_PLUGIN_BUNDLE);
  const pluginsRoot = process.env.DECK_THREADS_STREAM_DECK_PLUGINS_DIR
    || path.join(app.getPath("home"), "Library", "Application Support", "com.elgato.StreamDeck", "Plugins");
  const destination = path.join(pluginsRoot, STREAM_DECK_PLUGIN_BUNDLE);
  const result = await installBundledStreamDeckPlugin(source, destination);

  if (result.status === "installed"
    && process.env.DECK_THREADS_SKIP_STREAM_DECK_RESTART !== "1"
    && fs.existsSync("/Applications/Elgato Stream Deck.app")) {
    await execFileAsync("/usr/bin/pkill", ["-x", "Stream Deck"]).catch(() => undefined);
    await execFileAsync("/usr/bin/open", ["-a", "/Applications/Elgato Stream Deck.app"]).catch(() => undefined);
  }

  return result;
}

function getLaunchAtLoginStatus() {
  if (process.platform !== "darwin" || !app.isPackaged) {
    return { openAtLogin: false, status: "development" };
  }
  const settings = app.getLoginItemSettings({ type: "mainAppService" });
  return {
    openAtLogin: settings.openAtLogin,
    status: settings.status,
    wasOpenedAtLogin: settings.wasOpenedAtLogin,
  };
}

function ensureLaunchAtLogin() {
  if (process.platform !== "darwin" || !app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: true, type: "mainAppService" });
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  app.dock?.show();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  const trayImage = nativeImage.createFromPath(getResourcePath("trayTemplate.png"));
  trayImage.setTemplateImage(true);
  tray = new Tray(trayImage);
  tray.setToolTip("Deck Threads");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open Deck Threads", click: showMainWindow },
    { type: "separator" },
    {
      label: "Starts Automatically at Login",
      type: "checkbox",
      checked: getLaunchAtLoginStatus().openAtLogin,
      enabled: false,
    },
    { label: `Stream Deck API  ${BRIDGE_HOST}:${BRIDGE_PORT}`, enabled: false },
    { type: "separator" },
    {
      label: "Quit Deck Threads",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]));
  tray.on("double-click", showMainWindow);
}

function createApplicationMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "Deck Threads",
      submenu: [
        { label: "Open Deck Threads", accelerator: "CmdOrCtrl+Shift+K", click: showMainWindow },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ]));
}

async function readLiveCodexTasks() {
  const state = readCodexTasks();
  try {
    const threadNames = await codexAppServer.listThreadNames();
    state.tasks = state.tasks.map((task) => ({
      ...task,
      title: threadNames.get(task.id) || task.title,
    }));
    state.source = "Codex app-server + runtime logs";
  } catch {
    // Keep the SQLite title as a fallback if the desktop app-server is unavailable.
  }
  state.tasks = state.tasks.map((task) => ({
    ...task,
    stableId: `codex:${task.id}`,
    sourceId: "codex",
    sourceName: "Codex",
    sourceLabel: "CX",
  }));
  return state;
}

async function readLiveTaskState() {
  const [codexResult, claudeResult] = await Promise.allSettled([
    readLiveCodexTasks(),
    claudeTaskClient.readTasks(),
  ]);
  const codex = codexResult.status === "fulfilled"
    ? codexResult.value
    : { tasks: [], source: "Unavailable", error: codexResult.reason?.message || String(codexResult.reason) };
  const claude = claudeResult.status === "fulfilled"
    ? claudeResult.value
    : { tasks: [], source: "Unavailable", error: claudeResult.reason?.message || String(claudeResult.reason) };
  const allocationSettings = getSourceAllocation();
  const selectedTasks = allocateTasksBySource([...codex.tasks, ...claude.tasks], allocationSettings);
  const slotStatePath = path.join(app.getPath("userData"), "task-slots.json");
  if (!stableTaskIds) stableTaskIds = readTaskSlotIds(slotStatePath);
  const stableState = assignStableTaskSlots(selectedTasks, stableTaskIds);
  if (JSON.stringify(stableState.taskIds) !== JSON.stringify(stableTaskIds)) {
    stableTaskIds = stableState.taskIds;
    try {
      writeTaskSlotIds(slotStatePath, stableTaskIds);
    } catch (error) {
      emitEvent("system", "warning", "Could not save task slot positions", error.message);
    }
  }
  return {
    tasks: stableState.tasks,
    sources: { codex, claude },
    allocationSettings,
    source: "Codex + Claude local activity",
  };
}

function createWindow() {
  nativeTheme.themeSource = "dark";
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: "#0c1018",
    icon: getResourcePath("icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow?.webContents.setZoomFactor(1);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.on("close", (event) => {
    if (isQuitting || process.platform !== "darwin") return;
    event.preventDefault();
    mainWindow.hide();
    app.dock?.hide();
  });

  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
}

function emitEvent(source, level, message, detail) {
  const event = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    source,
    level,
    message,
    detail,
  };
  mainWindow?.webContents.send("bridge:event", event);
}

async function openTask(sourceId, threadId, title) {
  const deepLink = taskDeepLink(sourceId, threadId);
  const sourceName = sourceId === "claude" ? "Claude" : "Codex";
  if (sourceId === "claude" && process.platform === "darwin") {
    await execFileAsync("/usr/bin/open", [deepLink], { timeout: 3000 });
  } else {
    await shell.openExternal(deepLink);
  }
  const taskTitle = cleanEventTitle(title);
  emitEvent(sourceId, "info", `Opened ${taskTitle}`, threadId);
  return { ok: true, message: `Opened ${taskTitle} in ${sourceName}.`, deepLink };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function startBridgeServer() {
  bridgeServer = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", `http://${BRIDGE_HOST}:${BRIDGE_PORT}`);

      if (request.method === "GET" && url.pathname === "/v1/health") {
        sendJson(response, 200, {
          ok: true,
          service: "deck-threads",
          version: app.getVersion(),
          launchAtLogin: getLaunchAtLoginStatus(),
          windowVisible: Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()),
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/threads") {
        const state = await readLiveTaskState();
        sendJson(response, 200, {
          scannedAt: new Date().toISOString(),
          source: state.source,
          tasks: state.tasks,
          displaySettings: getDisplaySettings(),
          allocationSettings: state.allocationSettings,
        });
        return;
      }

      const openMatch = request.method === "POST"
        ? /^\/v1\/threads\/(codex|claude)\/([0-9a-f-]+)\/open$/i.exec(url.pathname)
        : null;
      if (openMatch) {
        const sourceId = openMatch[1].toLowerCase();
        const threadId = openMatch[2];
        const task = (await readLiveTaskState()).tasks.find((candidate) =>
          candidate?.sourceId === sourceId && candidate.id === threadId,
        );
        const result = await openTask(sourceId, task?.openId || threadId, task?.title || "task");
        sendJson(response, 200, result);
        return;
      }

      const legacyOpenMatch = request.method === "POST"
        ? /^\/v1\/threads\/([0-9a-f-]+)\/open$/i.exec(url.pathname)
        : null;
      if (legacyOpenMatch) {
        const threadId = legacyOpenMatch[1];
        const task = (await readLiveTaskState()).sources.codex.tasks.find((candidate) => candidate.id === threadId);
        const result = await openTask("codex", threadId, task?.title || "task");
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/focus") {
        showMainWindow();
        sendJson(response, 200, { ok: true });
        return;
      }

      sendJson(response, 404, { ok: false, message: "Not found." });
    } catch (error) {
      emitEvent("system", "error", "Local companion API request failed", error.message);
      sendJson(response, 500, { ok: false, message: error.message });
    }
  });

  bridgeServer.on("error", (error) => {
    emitEvent("system", "error", "Local companion API could not start", error.message);
  });
  bridgeServer.listen(BRIDGE_PORT, BRIDGE_HOST, () => {
    emitEvent("system", "success", "Stream Deck companion is ready", `http://${BRIDGE_HOST}:${BRIDGE_PORT}`);
  });
}

function inspectCodex(processLines, taskState) {
  const processes = processLines.filter((line) => /\/Applications\/(ChatGPT|Codex)\.app\//.test(line));
  const serverLine = processes.find((line) => /\bapp-server\b/.test(line));
  const appServerPid = serverLine ? Number(serverLine.match(/^(\d+)/)?.[1]) : undefined;
  const error = taskState.error;
  return {
    state: error ? "error" : processes.length || taskState.tasks.length ? "connected" : "missing",
    processCount: processes.length,
    appServerPid,
    source: taskState.source,
    taskCount: taskState.tasks.length,
    detail: error
      ? `Could not read Codex task state: ${error}`
      : processes.length
        ? `Desktop is live${appServerPid ? `, app-server PID ${appServerPid}` : ""}. ${taskState.tasks.length} active or recent tasks found.`
        : "Codex Desktop is not currently running.",
  };
}

function inspectClaude(processLines, taskState) {
  const processes = processLines.filter((line) => /\/Applications\/Claude\.app\//.test(line));
  const error = taskState.error;
  return {
    state: error ? "error" : processes.length || taskState.tasks.length ? "connected" : "missing",
    processCount: processes.length,
    source: taskState.source,
    taskCount: taskState.tasks.length,
    detail: error
      ? `Could not read Claude task state: ${error}`
      : taskState.tasks.length
        ? `${taskState.tasks.length} active Claude Code ${taskState.tasks.length === 1 ? "session" : "sessions"} found on this Mac.`
        : processes.length
          ? "Claude Desktop is live. No active Claude Code sessions are currently registered."
          : "Claude Desktop is not running and no active Claude Code sessions were found.",
  };
}

function trackTaskStateChanges(tasks) {
  const visibleTasks = tasks.filter(Boolean);
  const next = new Map(visibleTasks.map((task) => [task.stableId, task.status]));
  if (previousTaskStates.size) {
    for (const task of visibleTasks) {
      const previous = previousTaskStates.get(task.stableId);
      if (previous && previous !== task.status) {
        emitEvent(task.sourceId, task.status === "unread" ? "success" : "info", task.title, `${previous} to ${task.status}`);
      }
    }
  }
  previousTaskStates = next;
}

function inspectStreamDeck(processLines) {
  const processes = processLines.filter((line) => /\/Applications\/Elgato Stream Deck\.app\//.test(line));
  const pluginLine = processLines.find((line) => /com\.roie\.deck-threads\.sdPlugin\/bin\/plugin\.js/.test(line));
  return {
    state: processes.length ? "connected" : "missing",
    processCount: processes.length,
    pluginConnected: Boolean(pluginLine),
    detail: processes.length
      ? `Stream Deck is running${pluginLine ? " and the Deck Threads plugin is connected." : ". Install or restart the plugin to connect it."}`
      : "Open Stream Deck to display your live Codex and Claude tasks.",
  };
}

async function getSnapshot() {
  const [taskState, processResult] = await Promise.all([
    readLiveTaskState(),
    execFileAsync("ps", ["ax", "-o", "pid=,command="]).catch((error) => ({ stdout: "", error })),
  ]);
  const processLines = processResult.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  const codex = inspectCodex(processLines, taskState.sources.codex);
  const claude = inspectClaude(processLines, taskState.sources.claude);
  const streamDeck = processResult.error
    ? { state: "error", processCount: 0, pluginConnected: false, detail: processResult.error.message }
    : inspectStreamDeck(processLines);
  trackTaskStateChanges(taskState.tasks);
  return {
    scannedAt: new Date().toISOString(),
    tasks: taskState.tasks,
    codex,
    claude,
    streamDeck,
    companion: {
      state: "connected",
      detail: `Local task API is available at http://${BRIDGE_HOST}:${BRIDGE_PORT}.`,
    },
    displaySettings: getDisplaySettings(),
    allocationSettings: taskState.allocationSettings,
  };
}

ipcMain.handle("bridge:get-snapshot", getSnapshot);
ipcMain.handle("bridge:refresh", async () => {
  const snapshot = await getSnapshot();
  emitEvent("system", "info", "Task status refreshed", snapshot.scannedAt);
  return snapshot;
});

ipcMain.handle("bridge:set-display-settings", (_event, value) => {
  const settings = writeDisplaySettings(displaySettingsPath(), value);
  emitEvent("system", "success", "Stream Deck labels updated", "Key labels refresh automatically.");
  return settings;
});

ipcMain.handle("bridge:set-source-allocation", (_event, value) => {
  const settings = writeSourceAllocation(sourceAllocationPath(), value);
  emitEvent("system", "success", "Task allocation updated", settings.fillUnused
    ? "Unused slots can be filled by either app."
    : "Each app is limited to its reserved slots.");
  return settings;
});

ipcMain.handle("bridge:open-task", async (_event, sourceId, threadId, title, openId) => {
  try {
    return await openTask(sourceId, openId || threadId, title);
  } catch (error) {
    emitEvent(sourceId === "claude" ? "claude" : "codex", "error", "Could not open task", error.message);
    return { ok: false, message: error.message };
  }
});

ipcMain.handle("bridge:open-codex-thread", async (_event, threadId, title) => {
  try {
    return await openTask("codex", threadId, title);
  } catch (error) {
    emitEvent("codex", "error", "Could not open task in Codex", error.message);
    return { ok: false, message: error.message };
  }
});

function cleanEventTitle(title) {
  const value = String(title || "task").replace(/\s+/g, " ").trim();
  return value || "task";
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

app.on("second-instance", showMainWindow);

app.whenReady().then(() => {
  ensureLaunchAtLogin();
  createTray();
  createApplicationMenu();
  app.dock?.setIcon(getResourcePath("icon.png"));
  const openedAtLogin = app.isPackaged && app.getLoginItemSettings().wasOpenedAtLogin;
  if (openedAtLogin) app.dock?.hide();
  else showMainWindow();
  ensureBundledStreamDeckPlugin()
    .then((result) => {
      if (result.status === "installed") {
        emitEvent("system", "success", "Stream Deck plugin installed", `Version ${result.version || "current"} is ready.`);
      }
    })
    .catch((error) => {
      emitEvent("system", "warning", "Could not install the Stream Deck plugin", error.message);
    });
  if (process.env.CODEX_BRIDGE_API_DISABLED !== "1") startBridgeServer();
  app.on("activate", showMainWindow);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  bridgeServer?.close();
  codexAppServer.close();
});
