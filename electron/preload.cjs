const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bridgeApi", {
  getSnapshot: () => ipcRenderer.invoke("bridge:get-snapshot"),
  refresh: () => ipcRenderer.invoke("bridge:refresh"),
  setDisplaySettings: (value) => ipcRenderer.invoke("bridge:set-display-settings", value),
  setSourceAllocation: (value) => ipcRenderer.invoke("bridge:set-source-allocation", value),
  openTask: (sourceId, threadId, title, openId) => ipcRenderer.invoke("bridge:open-task", sourceId, threadId, title, openId),
  openCodexThread: (threadId, title) => ipcRenderer.invoke("bridge:open-codex-thread", threadId, title),
  getUpdateState: () => ipcRenderer.invoke("updates:get-state"),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  startUpdate: () => ipcRenderer.invoke("updates:start"),
  onUpdateState: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("updates:state", handler);
    return () => ipcRenderer.removeListener("updates:state", handler);
  },
  onEvent: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("bridge:event", handler);
    return () => ipcRenderer.removeListener("bridge:event", handler);
  },
});
