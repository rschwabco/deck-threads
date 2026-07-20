const fs = require("node:fs");
const { spawn } = require("node:child_process");
const readline = require("node:readline");

const DESKTOP_CODEX_BINARY = "/Applications/ChatGPT.app/Contents/Resources/codex";

class CodexAppServerClient {
  constructor() {
    this.child = undefined;
    this.nextId = 1;
    this.pending = new Map();
    this.readyPromise = undefined;
  }

  async listThreadNames(limit = 32) {
    await this.ensureReady();
    const result = await this.request("thread/list", {
      limit,
      sortKey: "recency_at",
      sortDirection: "desc",
    });
    return new Map(
      (result?.data || [])
        .filter((thread) => typeof thread?.id === "string" && typeof thread?.name === "string" && thread.name.trim())
        .map((thread) => [thread.id, thread.name.trim()]),
    );
  }

  ensureReady() {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this.start().catch((error) => {
      this.readyPromise = undefined;
      throw error;
    });
    return this.readyPromise;
  }

  async start() {
    const binary = fs.existsSync(DESKTOP_CODEX_BINARY) ? DESKTOP_CODEX_BINARY : "codex";
    const child = spawn(binary, ["app-server"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;

    const lines = readline.createInterface({ input: child.stdout });
    lines.on("line", (line) => this.onLine(line));
    child.stderr.on("data", () => {});
    child.on("error", (error) => this.onExit(error));
    child.on("exit", (code, signal) => {
      this.onExit(new Error(`Codex app-server exited (${signal || code || "unknown"}).`));
    });

    await this.request("initialize", {
      clientInfo: {
        name: "deck_threads",
        title: "Deck Threads",
        version: "1.0.0",
      },
      capabilities: { experimentalApi: true },
    });
    this.notify("initialized", {});
  }

  request(method, params) {
    if (!this.child?.stdin?.writable) return Promise.reject(new Error("Codex app-server is not writable."));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out.`));
      }, 3000);
      this.pending.set(id, { resolve, reject, timeout });
      this.child.stdin.write(`${JSON.stringify({ method, id, params })}\n`);
    });
  }

  notify(method, params) {
    if (this.child?.stdin?.writable) {
      this.child.stdin.write(`${JSON.stringify({ method, params })}\n`);
    }
  }

  onLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (!Number.isInteger(message.id)) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(message.id);
    if (message.error) pending.reject(new Error(message.error.message || "Codex app-server request failed."));
    else pending.resolve(message.result);
  }

  onExit(error) {
    if (!this.child) return;
    this.child = undefined;
    this.readyPromise = undefined;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }

  close() {
    const child = this.child;
    this.child = undefined;
    this.readyPromise = undefined;
    child?.kill();
  }
}

module.exports = { CodexAppServerClient };
