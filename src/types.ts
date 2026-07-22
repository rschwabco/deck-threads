export type HealthState = "connected" | "detected" | "busy" | "missing" | "error";

export interface EventEntry {
  id: string;
  timestamp: string;
  source: "system" | "codex" | "claude" | "streamdeck";
  level: "info" | "success" | "warning" | "error";
  message: string;
  detail?: string;
}

export type CodexTaskStatus = "working" | "question" | "unread" | "read" | "waiting" | "error" | "off";
export type CodexTaskPriority = "active" | "pinned" | "recent";

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
  tasks: Array<AgentTask | null>;
  codex: {
    state: HealthState;
    processCount: number;
    appServerPid?: number;
    detail: string;
    source: string;
    taskCount: number;
  };
  claude: {
    state: HealthState;
    processCount: number;
    detail: string;
    source: string;
    taskCount: number;
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
  allocationSettings: SourceAllocationSettings;
}

export type LabelConfigurableStatus = Exclude<CodexTaskStatus, "off">;
export type KeyAnimation = "still" | "breathe" | "sweep" | "pulse";

export interface StatusAppearance {
  backgroundColor: string;
  animation: KeyAnimation;
}

export interface KeyTypography {
  slotHandleFontSize: number;
  threadNameFontSize: number;
}

export interface DisplaySettings {
  showThreadTitle: Record<LabelConfigurableStatus, boolean>;
  statusAppearance: Record<TaskSourceId, Record<LabelConfigurableStatus, StatusAppearance>>;
  typography: Record<TaskSourceId, KeyTypography>;
}

export interface SourceAllocationSettings {
  reservations: { codex: number; claude: number };
  fillUnused: boolean;
}

export type UpdateStatus = "disabled" | "idle" | "checking" | "up-to-date" | "available" | "downloading" | "installing" | "error";

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion?: string;
  releaseDate?: string;
  progress?: number;
  checkedAt?: string;
  message?: string;
}

export interface BridgeApi {
  getSnapshot(): Promise<SystemSnapshot>;
  refresh(): Promise<SystemSnapshot>;
  setDisplaySettings(value: DisplaySettings): Promise<DisplaySettings>;
  setSourceAllocation(value: SourceAllocationSettings): Promise<SourceAllocationSettings>;
  openTask(sourceId: TaskSourceId, threadId: string, title: string, openId?: string): Promise<{ ok: boolean; message: string; deepLink?: string }>;
  openCodexThread(threadId: string, title: string): Promise<{ ok: boolean; message: string; deepLink?: string }>;
  getUpdateState(): Promise<UpdateState>;
  checkForUpdates(): Promise<UpdateState>;
  startUpdate(): Promise<UpdateState>;
  onUpdateState(callback: (state: UpdateState) => void): () => void;
  onEvent(callback: (event: EventEntry) => void): () => void;
}

declare global {
  interface Window {
    bridgeApi: BridgeApi;
  }
}
