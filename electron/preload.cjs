const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bridgeApi", {
  getSnapshot: () => ipcRenderer.invoke("bridge:get-snapshot"),
  refresh: () => ipcRenderer.invoke("bridge:refresh"),
  setDisplaySettings: (value) => ipcRenderer.invoke("bridge:set-display-settings", value),
  openCodexThread: (threadId, title) => ipcRenderer.invoke("bridge:open-codex-thread", threadId, title),
  onEvent: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("bridge:event", handler);
    return () => ipcRenderer.removeListener("bridge:event", handler);
  },
});
