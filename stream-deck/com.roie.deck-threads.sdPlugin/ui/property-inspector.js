let websocket;
let pluginUUID;
let actionUUID;

const statusDot = document.getElementById("status-dot");
const statusTitle = document.getElementById("status-title");
const statusDetail = document.getElementById("status-detail");
const openButton = document.getElementById("open-companion");
const checkButton = document.getElementById("check-again");
const downloadButton = document.getElementById("download-companion");

function renderStatus(payload) {
  const online = Boolean(payload?.online);
  statusDot.className = `status-dot ${online ? "online" : "offline"}`;
  statusTitle.textContent = online ? "Companion connected" : "Companion not found";
  statusDetail.textContent = online
    ? `${payload.taskCount || 0} task${payload.taskCount === 1 ? "" : "s"} available. Keys update automatically.`
    : "Open the Deck Threads companion, then check again.";
  openButton.disabled = !online;
}

function send(command) {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
  websocket.send(JSON.stringify({
    action: actionUUID,
    event: "sendToPlugin",
    context: pluginUUID,
    payload: { command },
  }));
}

function openURL(url) {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
  websocket.send(JSON.stringify({ event: "openUrl", payload: { url } }));
}

window.connectElgatoStreamDeckSocket = function connectElgatoStreamDeckSocket(port, uuid, registerEvent, _info, actionInfo) {
  pluginUUID = uuid;
  try {
    actionUUID = JSON.parse(actionInfo).action;
  } catch {
    actionUUID = "com.roie.deck-threads.thread";
  }
  websocket = new WebSocket(`ws://127.0.0.1:${port}`);
  websocket.onopen = () => {
    websocket.send(JSON.stringify({ event: registerEvent, uuid }));
    send("status");
  };
  websocket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.event === "sendToPropertyInspector" && message.payload?.type === "status") {
        renderStatus(message.payload);
      }
    } catch {
      // Ignore non-JSON diagnostic messages from Stream Deck.
    }
  };
  websocket.onclose = () => renderStatus({ online: false });
};

openButton.addEventListener("click", () => send("focusCompanion"));
checkButton.addEventListener("click", () => send("status"));
downloadButton.addEventListener("click", () => openURL("https://github.com/rschwabco/deck-threads/releases/latest"));
