export type HealthState = "connected" | "detected" | "busy" | "missing" | "error";

export interface EventEntry {
  id: string;
  timestamp: string;
  source: "system" | "codex" | "streamdeck";
  level: "info" | "success" | "warning" | "error";
  message: string;
  detail?: string;
}

export type CodexTaskStatus = "working" | "question" | "unread" | "read" | "waiting" | "error" | "off";
export type CodexTaskPriority = "active" | "pinned" | "recent";

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
  priority: CodexTaskPriority;
  status: CodexTaskStatus;
  color: string;
  activityAt: number;
  updatedAt?: number;
  turnId?: string;
  threadSource: string;
}

export interface SystemSnapshot {
  scannedAt: string;
  codex: {
    state: HealthState;
    processCount: number;
    appServerPid?: number;
    detail: string;
    source: string;
    tasks: Array<CodexTask | null>;
  };
  streamDeck: {
    state: HealthState;
    processCount: number;
    pluginConnected: boolean;
    detail: string;
  };
  companion: {
    state: HealthState;
    detail: string;
  };
  displaySettings: DisplaySettings;
}

export type LabelConfigurableStatus = Exclude<CodexTaskStatus, "off">;

export interface DisplaySettings {
  showThreadTitle: Record<LabelConfigurableStatus, boolean>;
}

export interface BridgeApi {
  getSnapshot(): Promise<SystemSnapshot>;
  refresh(): Promise<SystemSnapshot>;
  setDisplaySettings(value: DisplaySettings): Promise<DisplaySettings>;
  openCodexThread(threadId: string, title: string): Promise<{ ok: boolean; message: string; deepLink?: string }>;
  onEvent(callback: (event: EventEntry) => void): () => void;
}

declare global {
  interface Window {
    bridgeApi: BridgeApi;
  }
}
