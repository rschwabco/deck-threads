const BASE_URL = "http://127.0.0.1:9876/v1";
const THREADS_REQUEST_TIMEOUT_MS = 5000;
const HEALTH_REQUEST_TIMEOUT_MS = 1000;
const OFFLINE_FAILURE_THRESHOLD = 2;

export type TaskStatus = "working" | "question" | "unread" | "read" | "waiting" | "error" | "off";
export type TaskPriority = "active" | "pinned" | "recent";

export type TaskSourceId = "codex" | "claude";

export interface AgentTask {
  id: string;
  openId?: string;
  stableId: string;
  sourceId: TaskSourceId;
  sourceName: "Codex" | "Claude";
  sourceLabel: "CX" | "CL";
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
  tasks: Array<AgentTask | null>;
  displaySettings?: DisplaySettings;
}

type LabelStatus = Exclude<TaskStatus, "off">;
export type KeyAnimation = "still" | "breathe" | "sweep" | "pulse";
export type StatusAppearance = { backgroundColor: string; animation: KeyAnimation };
export type KeyTypography = { slotHandleFontSize: number; threadNameFontSize: number };
type DisplaySettings = {
  showThreadTitle: Record<LabelStatus, boolean>;
  statusAppearance: Record<TaskSourceId, Record<LabelStatus, StatusAppearance>>;
  typography: Record<TaskSourceId, KeyTypography>;
};

const DEFAULT_TITLE_VISIBILITY: Record<LabelStatus, boolean> = {
  working: false,
  question: false,
  unread: false,
  read: true,
  waiting: false,
  error: false,
};
const STATUSES: LabelStatus[] = ["working", "question", "unread", "read", "waiting", "error"];
const DEFAULT_STATUS_APPEARANCE: Record<LabelStatus, StatusAppearance> = {
  working: { backgroundColor: "#24375F", animation: "sweep" },
  question: { backgroundColor: "#57321F", animation: "pulse" },
  unread: { backgroundColor: "#1C4934", animation: "breathe" },
  read: { backgroundColor: "#2B333F", animation: "still" },
  waiting: { backgroundColor: "#4A3920", animation: "still" },
  error: { backgroundColor: "#4D2730", animation: "still" },
};
const DEFAULT_TYPOGRAPHY: KeyTypography = { slotHandleFontSize: 17, threadNameFontSize: 12 };

function defaultSourceAppearance() {
  return Object.fromEntries(STATUSES.map((status) => [status, { ...DEFAULT_STATUS_APPEARANCE[status] }])) as Record<LabelStatus, StatusAppearance>;
}

function normalizedSourceAppearance(value?: Partial<Record<LabelStatus, StatusAppearance>>) {
  return Object.fromEntries(STATUSES.map((status) => [status, {
    ...DEFAULT_STATUS_APPEARANCE[status],
    ...(value?.[status] || {}),
  }])) as Record<LabelStatus, StatusAppearance>;
}

function normalizedTypography(value?: Partial<KeyTypography>) {
  return {
    slotHandleFontSize: Math.min(28, Math.max(12, Math.round(Number(value?.slotHandleFontSize) || DEFAULT_TYPOGRAPHY.slotHandleFontSize))),
    threadNameFontSize: Math.min(20, Math.max(9, Math.round(Number(value?.threadNameFontSize) || DEFAULT_TYPOGRAPHY.threadNameFontSize))),
  };
}

export class CompanionClient {
  tasks: Array<AgentTask | null> = [];
  online = false;
  scannedAt?: string;
  displaySettings: DisplaySettings = {
    showThreadTitle: { ...DEFAULT_TITLE_VISIBILITY },
    statusAppearance: {
      codex: defaultSourceAppearance(),
      claude: defaultSourceAppearance(),
    },
    typography: {
      codex: { ...DEFAULT_TYPOGRAPHY },
      claude: { ...DEFAULT_TYPOGRAPHY },
    },
  };
  private refreshPromise?: Promise<void>;
  private consecutiveUnavailableRefreshes = 0;

  refresh(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.performRefresh().finally(() => {
      this.refreshPromise = undefined;
    });
    return this.refreshPromise;
  }

  private async performRefresh() {
    try {
      const response = await fetch(`${BASE_URL}/threads`, {
        signal: AbortSignal.timeout(THREADS_REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Companion returned ${response.status}`);
      const payload = (await response.json()) as ThreadResponse;
      this.tasks = Array.isArray(payload.tasks) ? payload.tasks.map((task) => {
        if (!task) return null;
        const sourceId = task.sourceId === "claude" ? "claude" : "codex";
        return {
          ...task,
          sourceId,
          stableId: task.stableId || `${sourceId}:${task.id}`,
          sourceName: sourceId === "claude" ? "Claude" : "Codex",
          sourceLabel: sourceId === "claude" ? "CL" : "CX",
        } as AgentTask;
      }) : [];
      this.scannedAt = payload.scannedAt;
      this.displaySettings = {
        showThreadTitle: {
          ...DEFAULT_TITLE_VISIBILITY,
          ...(payload.displaySettings?.showThreadTitle || {}),
        },
        statusAppearance: {
          codex: normalizedSourceAppearance(payload.displaySettings?.statusAppearance?.codex),
          claude: normalizedSourceAppearance(payload.displaySettings?.statusAppearance?.claude),
        },
        typography: {
          codex: normalizedTypography(payload.displaySettings?.typography?.codex),
          claude: normalizedTypography(payload.displaySettings?.typography?.claude),
        },
      };
      this.consecutiveUnavailableRefreshes = 0;
      this.online = true;
    } catch {
      if (await this.companionIsReachable()) {
        this.consecutiveUnavailableRefreshes = 0;
        this.online = true;
        return;
      }

      this.consecutiveUnavailableRefreshes += 1;
      if (this.consecutiveUnavailableRefreshes >= OFFLINE_FAILURE_THRESHOLD) {
        this.online = false;
        this.tasks = [];
      }
    }
  }

  private async companionIsReachable() {
    try {
      const response = await fetch(`${BASE_URL}/health`, {
        signal: AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  showThreadTitle(status: TaskStatus) {
    return status !== "off" && this.displaySettings.showThreadTitle[status];
  }

  appearanceFor(task: AgentTask) {
    return task.status === "off"
      ? { backgroundColor: "#202630", animation: "still" as const }
      : this.displaySettings.statusAppearance[task.sourceId][task.status];
  }

  typographyFor(task: AgentTask) {
    return this.displaySettings.typography[task.sourceId];
  }

  async openThread(sourceId: TaskSourceId, threadId: string) {
    let response = await fetch(`${BASE_URL}/threads/${sourceId}/${encodeURIComponent(threadId)}/open`, {
      method: "POST",
      signal: AbortSignal.timeout(2000),
    });
    if (sourceId === "codex" && response.status === 404) {
      response = await fetch(`${BASE_URL}/threads/${encodeURIComponent(threadId)}/open`, {
        method: "POST",
        signal: AbortSignal.timeout(2000),
      });
    }
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
