const BASE_URL = "http://127.0.0.1:9876/v1";

export type TaskStatus = "working" | "unread" | "read" | "waiting" | "error" | "off";
export type TaskPriority = "active" | "pinned" | "recent";

export interface CodexTask {
  id: string;
  slot: number;
  title: string;
  cwd: string;
  projectName: string;
  projectAbbreviation: string;
  projectThreadNumber: number;
  projectLabel: string;
  pinned: boolean;
  priority: TaskPriority;
  status: TaskStatus;
  color: string;
  activityAt: number;
  updatedAt?: number;
}

interface ThreadResponse {
  scannedAt: string;
  tasks: Array<CodexTask | null>;
}

class CompanionClient {
  tasks: Array<CodexTask | null> = [];
  online = false;
  scannedAt?: string;
  private refreshPromise?: Promise<void>;

  refresh(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.performRefresh().finally(() => {
      this.refreshPromise = undefined;
    });
    return this.refreshPromise;
  }

  private async performRefresh() {
    try {
      const response = await fetch(`${BASE_URL}/threads`, { signal: AbortSignal.timeout(1400) });
      if (!response.ok) throw new Error(`Companion returned ${response.status}`);
      const payload = (await response.json()) as ThreadResponse;
      this.tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
      this.scannedAt = payload.scannedAt;
      this.online = true;
    } catch {
      this.online = false;
      this.tasks = [];
    }
  }

  async openThread(threadId: string) {
    const response = await fetch(`${BASE_URL}/threads/${encodeURIComponent(threadId)}/open`, {
      method: "POST",
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) throw new Error(`Could not open thread (${response.status})`);
  }

  async focusCompanion() {
    const response = await fetch(`${BASE_URL}/focus`, {
      method: "POST",
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) throw new Error(`Could not focus companion (${response.status})`);
  }
}

export const companionClient = new CompanionClient();
