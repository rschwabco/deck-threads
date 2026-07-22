import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowSquareOut,
  ArrowsClockwise,
  Check,
  CircleNotch,
  Command,
  Monitor,
  Palette,
  Plug,
  PushPinSimple,
  SlidersHorizontal,
  SquaresFour,
  TerminalWindow,
  TextAa,
  Warning,
  X,
} from "@phosphor-icons/react";
import type {
  CodexTaskStatus,
  EventEntry,
  HealthState,
  KeyAnimation,
  KeyTypography,
  LabelConfigurableStatus,
  SourceAllocationSettings,
  StatusAppearance,
  SystemSnapshot,
  TaskSourceId,
} from "./types";

const STATUS_META: Record<CodexTaskStatus, { label: string; description: string }> = {
  working: { label: "Working", description: "An agent is actively moving the task forward." },
  question: { label: "Question", description: "The agent is waiting for your answer." },
  unread: { label: "Unread", description: "New completed work is ready to review." },
  read: { label: "Read", description: "The latest result has already been viewed." },
  waiting: { label: "Waiting", description: "The task needs attention before it can continue." },
  error: { label: "Error", description: "The task cannot continue without intervention." },
  off: { label: "Empty", description: "An unused slot stays dark." },
};

const TITLE_STATES: LabelConfigurableStatus[] = ["working", "question", "unread", "read", "waiting", "error"];
const SOURCE_META: Record<TaskSourceId, { label: string; shortLabel: string }> = {
  codex: { label: "Codex", shortLabel: "CX" },
  claude: { label: "Claude", shortLabel: "CL" },
};
const ANIMATION_META: Array<{ id: KeyAnimation; label: string; description: string }> = [
  { id: "still", label: "Still", description: "No motion" },
  { id: "breathe", label: "Breathe", description: "Soft brightness cycle" },
  { id: "sweep", label: "Sweep", description: "Light moves across the key" },
  { id: "pulse", label: "Pulse", description: "Expanding attention signal" },
];
const DEFAULT_STATUS_APPEARANCE: Record<LabelConfigurableStatus, StatusAppearance> = {
  working: { backgroundColor: "#24375F", animation: "sweep" },
  question: { backgroundColor: "#57321F", animation: "pulse" },
  unread: { backgroundColor: "#1C4934", animation: "breathe" },
  read: { backgroundColor: "#2B333F", animation: "still" },
  waiting: { backgroundColor: "#4A3920", animation: "still" },
  error: { backgroundColor: "#4D2730", animation: "still" },
};
type ActiveView = "threads" | "sources" | "connections" | "appearance" | "labels" | "activity";

const EMPTY_SNAPSHOT: SystemSnapshot = {
  scannedAt: new Date(0).toISOString(),
  tasks: [],
  codex: { state: "missing", processCount: 0, detail: "Looking for Codex Desktop.", source: "Scanning", taskCount: 0 },
  claude: { state: "missing", processCount: 0, detail: "Looking for Claude sessions.", source: "Scanning", taskCount: 0 },
  streamDeck: { state: "missing", processCount: 0, pluginConnected: false, detail: "Looking for Stream Deck." },
  companion: { state: "connected", detail: "Starting the local task service." },
  displaySettings: {
    showThreadTitle: {
      working: false,
      question: false,
      unread: false,
      read: true,
      waiting: false,
      error: false,
    },
    statusAppearance: {
      codex: structuredClone(DEFAULT_STATUS_APPEARANCE),
      claude: structuredClone(DEFAULT_STATUS_APPEARANCE),
    },
    typography: {
      codex: { slotHandleFontSize: 17, threadNameFontSize: 12 },
      claude: { slotHandleFontSize: 17, threadNameFontSize: 12 },
    },
  },
  allocationSettings: { reservations: { codex: 4, claude: 4 }, fillUnused: true },
};

function stateLabel(state: HealthState) {
  if (state === "connected") return "Online";
  if (state === "detected") return "Ready";
  if (state === "busy") return "Busy";
  if (state === "error") return "Error";
  return "Offline";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatAge(value?: number) {
  if (!value) return "No activity";
  const seconds = Math.max(0, Math.round((Date.now() - value) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function contrastForeground(backgroundColor: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(backgroundColor);
  if (!match) return "#FFFFFF";
  const value = Number.parseInt(match[1], 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return (red * 299 + green * 587 + blue * 114) / 1000 > 158 ? "#111722" : "#FFFFFF";
}

function HealthItem({
  icon,
  label,
  state,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  state: HealthState;
  detail: string;
}) {
  return (
    <article className="health-item">
      <div className="health-icon" aria-hidden="true">{icon}</div>
      <div className="health-copy">
        <div className="health-heading">
          <h3>{label}</h3>
          <span className={`state-badge state-${state}`}>
            <span className="state-dot" aria-hidden="true" />
            {stateLabel(state)}
          </span>
        </div>
        <p title={detail}>{detail}</p>
      </div>
    </article>
  );
}

function ActionResult({ result }: { result?: { ok: boolean; message: string } }) {
  if (!result) return null;
  return (
    <p className={`action-result ${result.ok ? "result-ok" : "result-error"}`} role="status">
      {result.ok ? <Check weight="bold" /> : <Warning weight="bold" />}
      {result.message}
    </p>
  );
}

export function App() {
  const [activeView, setActiveView] = useState<ActiveView>("threads");
  const [appearanceSource, setAppearanceSource] = useState<TaskSourceId>("codex");
  const [snapshot, setSnapshot] = useState<SystemSnapshot>(EMPTY_SNAPSHOT);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string }>();

  const loadSnapshot = useCallback(async (announce = false) => {
    const next = announce ? await window.bridgeApi.refresh() : await window.bridgeApi.getSnapshot();
    setSnapshot(next);
  }, []);

  useEffect(() => {
    let mounted = true;
    loadSnapshot()
      .catch((error) => {
        if (!mounted) return;
        setEvents((current) => [{
          id: `startup-${Date.now()}`,
          timestamp: new Date().toISOString(),
          source: "system",
          level: "error",
          message: "Companion service did not start",
          detail: error instanceof Error ? error.message : String(error),
        }, ...current]);
      })
      .finally(() => mounted && setLoading(false));

    const removeListener = window.bridgeApi.onEvent((event) => {
      if (mounted) setEvents((current) => [event, ...current].slice(0, 100));
    });
    const timer = window.setInterval(() => loadSnapshot().catch(() => undefined), 3000);

    return () => {
      mounted = false;
      removeListener();
      window.clearInterval(timer);
    };
  }, [loadSnapshot]);

  const taskCounts = useMemo(() => ({
    working: snapshot.tasks.filter((task) => task?.status === "working").length,
    attention: snapshot.tasks.filter((task) => task?.status === "question" || task?.status === "unread" || task?.status === "waiting").length,
    codex: snapshot.tasks.filter((task) => task?.sourceId === "codex").length,
    claude: snapshot.tasks.filter((task) => task?.sourceId === "claude").length,
  }), [snapshot.tasks]);
  const selectedTypography = snapshot.displaySettings.typography[appearanceSource];
  const selectedPreviewAppearance = snapshot.displaySettings.statusAppearance[appearanceSource].working;

  const updateTitleVisibility = async (status: LabelConfigurableStatus, visible: boolean) => {
    const nextSettings = {
      ...snapshot.displaySettings,
      showThreadTitle: {
        ...snapshot.displaySettings.showThreadTitle,
        [status]: visible,
      },
    };
    setSnapshot((current) => ({ ...current, displaySettings: nextSettings }));
    try {
      const saved = await window.bridgeApi.setDisplaySettings(nextSettings);
      setSnapshot((current) => ({ ...current, displaySettings: saved }));
    } catch (error) {
      const failure = {
        id: `settings-${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: "system",
        level: "error",
        message: "Could not save label settings",
        detail: error instanceof Error ? error.message : String(error),
      } satisfies EventEntry;
      setEvents((current) => [failure, ...current].slice(0, 100));
      await loadSnapshot().catch(() => undefined);
    }
  };

  const updateStatusAppearance = async (
    sourceId: TaskSourceId,
    status: LabelConfigurableStatus,
    patch: Partial<StatusAppearance>,
  ) => {
    const nextSettings = {
      ...snapshot.displaySettings,
      statusAppearance: {
        ...snapshot.displaySettings.statusAppearance,
        [sourceId]: {
          ...snapshot.displaySettings.statusAppearance[sourceId],
          [status]: {
            ...snapshot.displaySettings.statusAppearance[sourceId][status],
            ...patch,
          },
        },
      },
    };
    setSnapshot((current) => ({ ...current, displaySettings: nextSettings }));
    try {
      const saved = await window.bridgeApi.setDisplaySettings(nextSettings);
      setSnapshot((current) => ({ ...current, displaySettings: saved }));
    } catch (error) {
      const failure = {
        id: `appearance-${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: "system",
        level: "error",
        message: "Could not save key appearance",
        detail: error instanceof Error ? error.message : String(error),
      } satisfies EventEntry;
      setEvents((current) => [failure, ...current].slice(0, 100));
      await loadSnapshot().catch(() => undefined);
    }
  };

  const updateTypography = async (sourceId: TaskSourceId, patch: Partial<KeyTypography>) => {
    const nextSettings = {
      ...snapshot.displaySettings,
      typography: {
        ...snapshot.displaySettings.typography,
        [sourceId]: {
          ...snapshot.displaySettings.typography[sourceId],
          ...patch,
        },
      },
    };
    setSnapshot((current) => ({ ...current, displaySettings: nextSettings }));
    try {
      const saved = await window.bridgeApi.setDisplaySettings(nextSettings);
      setSnapshot((current) => ({ ...current, displaySettings: saved }));
    } catch (error) {
      const failure = {
        id: `typography-${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: "system",
        level: "error",
        message: "Could not save key text sizes",
        detail: error instanceof Error ? error.message : String(error),
      } satisfies EventEntry;
      setEvents((current) => [failure, ...current].slice(0, 100));
      await loadSnapshot().catch(() => undefined);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadSnapshot(true);
    } finally {
      setRefreshing(false);
    }
  };

  const updateSourceAllocation = async (nextSettings: SourceAllocationSettings) => {
    setSnapshot((current) => ({ ...current, allocationSettings: nextSettings }));
    try {
      const saved = await window.bridgeApi.setSourceAllocation(nextSettings);
      setSnapshot((current) => ({ ...current, allocationSettings: saved }));
      await loadSnapshot();
    } catch (error) {
      const failure = {
        id: `allocation-${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: "system",
        level: "error",
        message: "Could not save task allocation",
        detail: error instanceof Error ? error.message : String(error),
      } satisfies EventEntry;
      setEvents((current) => [failure, ...current].slice(0, 100));
      await loadSnapshot().catch(() => undefined);
    }
  };

  const openTask = async (slot: number) => {
    const task = snapshot.tasks[slot];
    if (!task) return;
    const result = await window.bridgeApi.openTask(task.sourceId, task.id, task.title, task.openId);
    setActionResult(result);
    window.setTimeout(() => loadSnapshot().catch(() => undefined), 500);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <span className="brand-matrix">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</span>
          </div>
          <div>
            <p className="brand-name">Deck Threads</p>
            <p className="brand-subtitle">Stream Deck companion</p>
          </div>
        </div>

        <nav aria-label="Deck Threads">
          <button className={`nav-item ${activeView === "threads" ? "nav-active" : ""}`} onClick={() => setActiveView("threads")}><SquaresFour /> Threads</button>
          <button className={`nav-item ${activeView === "sources" ? "nav-active" : ""}`} onClick={() => setActiveView("sources")}><SlidersHorizontal /> Sources</button>
          <button className={`nav-item ${activeView === "connections" ? "nav-active" : ""}`} onClick={() => setActiveView("connections")}><Plug /> Connections</button>
          <button className={`nav-item ${activeView === "appearance" ? "nav-active" : ""}`} onClick={() => setActiveView("appearance")}><Palette /> Appearance</button>
          <button className={`nav-item ${activeView === "labels" ? "nav-active" : ""}`} onClick={() => setActiveView("labels")}><TextAa /> Key labels</button>
          <button className={`nav-item ${activeView === "activity" ? "nav-active" : ""}`} onClick={() => setActiveView("activity")}><TerminalWindow /> Activity</button>
        </nav>

        <div className="sidebar-note">
          <p>Deck sync</p>
          <strong>{snapshot.streamDeck.pluginConnected ? "Plugin connected" : "Waiting for plugin"}</strong>
          <span>Keep this companion running to update keys and open tasks.</span>
        </div>
      </aside>

      <main className="main-content">
        {activeView === "threads" && <>
        <header className="topbar">
          <div>
            <p className="section-kicker">Live task surface</p>
            <h1>Your agent work, on deck.</h1>
            <p className="topbar-copy">See active Codex and Claude work, spot tasks that need attention, and open either app with one press.</p>
          </div>
          <div className="topbar-actions">
            <span className="scan-time">Updated {formatTime(snapshot.scannedAt)}</span>
            <button className="button button-secondary" onClick={handleRefresh} disabled={refreshing}>
              <ArrowsClockwise className={refreshing ? "spin" : ""} />
              Refresh
            </button>
          </div>
        </header>

        <section className="summary-strip" aria-label="Task summary">
          <div><strong>{taskCounts.working}</strong><span>working</span></div>
          <div><strong>{taskCounts.attention}</strong><span>attention</span></div>
          <div><strong>{taskCounts.codex}</strong><span>Codex</span></div>
          <div><strong>{taskCounts.claude}</strong><span>Claude</span></div>
          <p>{snapshot.allocationSettings.fillUnused ? "Adaptive allocation" : "Strict allocation"}</p>
        </section>

        <section className="task-panel" aria-labelledby="task-heading">
          <div className="panel-heading">
            <div>
              <h2 id="task-heading">Eight live task keys</h2>
              <p>Tasks keep stable keys across refreshes. Press any task here or on your Stream Deck to open it in the app that owns it.</p>
            </div>
          </div>

          <div className="task-grid">
            {Array.from({ length: 8 }, (_, index) => snapshot.tasks[index]).map((task, index) => {
              const status = STATUS_META[task?.status || "off"];
              const appearance = task
                ? snapshot.displaySettings.statusAppearance[task.sourceId][task.status as LabelConfigurableStatus]
                : undefined;
              const typography = task ? snapshot.displaySettings.typography[task.sourceId] : undefined;
              return (
                <button
                  className={`task-key task-${task?.status || "off"}${task ? ` task-source-${task.sourceId} motion-${appearance?.animation || "still"}` : ""}`}
                  key={task?.stableId || `empty-${index}`}
                  onClick={() => openTask(index)}
                  disabled={!task}
                  data-thread-id={task?.id}
                  data-source-id={task?.sourceId}
                  data-cwd={task?.cwd}
                  style={{
                    "--task-color": appearance?.backgroundColor || "#303746",
                    "--task-background": appearance?.backgroundColor || "#202630",
                    "--task-foreground": contrastForeground(appearance?.backgroundColor || "#202630"),
                    "--slot-handle-font-size": `${typography?.slotHandleFontSize || 17}px`,
                    "--thread-name-font-size": `${typography?.threadNameFontSize || 12}px`,
                  } as React.CSSProperties}
                  aria-label={task ? `Open task slot ${index + 1} in ${task.sourceName}: ${task.title}, ${status.label}` : `Task slot ${index + 1}: empty`}
                >
                  <span className="task-key-topline" aria-hidden="true" />
                  <span className="task-key-meta">
                    <span className="task-number">{task?.projectLabel || `${index + 1}`}</span>
                    <span className="task-key-icons">
                      {task?.pinned && <PushPinSimple weight="fill" aria-label="Pinned project" />}
                      {task && <ArrowSquareOut aria-hidden="true" />}
                    </span>
                  </span>
                  <strong title={task?.title}>{task?.title || "Empty slot"}</strong>
                  <small>{status.label}<span aria-hidden="true"> / </span>{formatAge(task?.updatedAt)}</small>
                </button>
              );
            })}
          </div>
          <ActionResult result={actionResult} />
        </section>
        </>}

        {activeView === "sources" && <>
          <header className="topbar">
            <div>
              <p className="section-kicker">Eight key allocation</p>
              <h1>Task sources</h1>
              <p className="topbar-copy">Reserve keys for each app, then decide whether active work may borrow unused keys.</p>
            </div>
          </header>

          <section className="source-settings-panel page-panel" aria-labelledby="source-settings-heading">
            <div className="panel-heading">
              <div>
                <h2 id="source-settings-heading">Reserved keys</h2>
                <p>Choose the baseline split. The two reservations always add up to eight.</p>
              </div>
              <div className="allocation-total" aria-label="Current reserved key allocation">
                <span><b>{snapshot.allocationSettings.reservations.codex}</b> Codex</span>
                <span><b>{snapshot.allocationSettings.reservations.claude}</b> Claude</span>
              </div>
            </div>
            <div className="allocation-scale" role="group" aria-label="Number of keys reserved for Codex">
              {Array.from({ length: 9 }, (_, codexCount) => (
                <button
                  key={codexCount}
                  className={snapshot.allocationSettings.reservations.codex === codexCount ? "allocation-selected" : ""}
                  onClick={() => void updateSourceAllocation({
                    ...snapshot.allocationSettings,
                    reservations: { codex: codexCount, claude: 8 - codexCount },
                  })}
                  aria-pressed={snapshot.allocationSettings.reservations.codex === codexCount}
                  aria-label={`Reserve ${codexCount} keys for Codex and ${8 - codexCount} for Claude`}
                >
                  {codexCount}
                </button>
              ))}
            </div>
            <div className="allocation-axis" aria-hidden="true"><span>All Claude</span><span>Even split</span><span>All Codex</span></div>
          </section>

          <section className="source-settings-panel borrowing-panel" aria-labelledby="borrowing-heading">
            <div className="borrowing-copy">
              <span className="source-setting-icon"><ArrowsClockwise /></span>
              <div>
                <h2 id="borrowing-heading">Fill unused keys with active tasks</h2>
                <p>When one app has fewer tasks than its reservation, the other app can use those open keys. A 4/4 split becomes 6 Codex and 2 Claude when that is what is active.</p>
              </div>
            </div>
            <label className="label-toggle source-toggle">
              <input
                type="checkbox"
                checked={snapshot.allocationSettings.fillUnused}
                onChange={(event) => void updateSourceAllocation({
                  ...snapshot.allocationSettings,
                  fillUnused: event.currentTarget.checked,
                })}
                aria-label="Fill unused keys with active tasks"
              />
              <span aria-hidden="true" />
            </label>
          </section>

          <p className="allocation-preview" role="status">
            Currently showing <strong>{taskCounts.codex} Codex</strong> and <strong>{taskCounts.claude} Claude</strong> tasks across eight keys.
          </p>
        </>}

        {activeView === "connections" && <>
          <header className="topbar">
            <div>
              <p className="section-kicker">Local services</p>
              <h1>Connections</h1>
              <p className="topbar-copy">Confirm that Codex, Claude, Stream Deck, and the local companion can see each other.</p>
            </div>
            <div className="topbar-actions">
              <span className="scan-time">Updated {formatTime(snapshot.scannedAt)}</span>
              <button className="button button-secondary" onClick={handleRefresh} disabled={refreshing}>
                <ArrowsClockwise className={refreshing ? "spin" : ""} />
                Refresh
              </button>
            </div>
          </header>

          <section className="connection-panel page-panel" aria-labelledby="connection-heading">
            <div className="panel-heading">
              <div>
                <h2 id="connection-heading">Connection status</h2>
                <p>The companion stays local. It reads agent task state and serves it only to Stream Deck on this Mac.</p>
              </div>
            </div>
            {loading ? (
              <div className="health-loading" aria-label="Checking connections">
                {[0, 1, 2, 3].map((item) => <div className="skeleton" key={item} />)}
              </div>
            ) : (
              <div className="health-list">
                <HealthItem icon={<Command />} label="Codex Desktop" state={snapshot.codex.state} detail={snapshot.codex.detail} />
                <HealthItem icon={<TerminalWindow />} label="Claude" state={snapshot.claude.state} detail={snapshot.claude.detail} />
                <HealthItem icon={<Monitor />} label="Stream Deck" state={snapshot.streamDeck.state} detail={snapshot.streamDeck.detail} />
                <HealthItem icon={<Plug />} label="Local companion" state={snapshot.companion.state} detail={snapshot.companion.detail} />
              </div>
            )}
          </section>
        </>}

        {activeView === "appearance" && <>
          <header className="topbar">
            <div>
              <p className="section-kicker">Per-app status design</p>
              <h1>Key appearance</h1>
              <p className="topbar-copy">Set the background and motion for every task status. Codex and Claude keep independent palettes.</p>
            </div>
          </header>

          <section className="appearance-panel page-panel" aria-labelledby="appearance-heading">
            <div className="panel-heading appearance-heading">
              <div>
                <h2 id="appearance-heading">Status backgrounds and motion</h2>
                <p>Changes save immediately and update both this preview and your Stream Deck keys.</p>
              </div>
              <div className="source-tabs" role="group" aria-label="App appearance">
                {(Object.keys(SOURCE_META) as TaskSourceId[]).map((sourceId) => (
                  <button
                    key={sourceId}
                    className={`source-tab source-tab-${sourceId}${appearanceSource === sourceId ? " source-tab-active" : ""}`}
                    onClick={() => setAppearanceSource(sourceId)}
                    aria-pressed={appearanceSource === sourceId}
                  >
                    <span>{SOURCE_META[sourceId].shortLabel}</span>
                    {SOURCE_META[sourceId].label}
                  </button>
                ))}
              </div>
            </div>

            <section className="typography-settings" aria-labelledby="typography-heading">
              <div
                className={`typography-preview task-source-${appearanceSource}`}
                style={{
                  "--task-background": selectedPreviewAppearance.backgroundColor,
                  "--task-foreground": contrastForeground(selectedPreviewAppearance.backgroundColor),
                  "--slot-handle-font-size": `${selectedTypography.slotHandleFontSize}px`,
                  "--thread-name-font-size": `${selectedTypography.threadNameFontSize}px`,
                } as React.CSSProperties}
                aria-label={`${SOURCE_META[appearanceSource].label} text size preview`}
              >
                <span className="typography-preview-handle">{SOURCE_META[appearanceSource].shortLabel}3</span>
                <strong>Configure task typography</strong>
                <small>Working</small>
              </div>
              <div className="typography-controls">
                <div className="typography-copy">
                  <h3 id="typography-heading">Key text sizes</h3>
                  <p>Set the slot handle and thread name independently for {SOURCE_META[appearanceSource].label}. Stream Deck scales them to its 144px key canvas.</p>
                </div>
                <label className="font-size-control">
                  <span><strong>Slot handle</strong><small>Project label, such as {SOURCE_META[appearanceSource].shortLabel}3</small></span>
                  <input
                    type="range"
                    min="12"
                    max="28"
                    step="1"
                    value={selectedTypography.slotHandleFontSize}
                    onChange={(event) => void updateTypography(appearanceSource, { slotHandleFontSize: Number(event.currentTarget.value) })}
                    aria-label={`Slot handle font size for ${SOURCE_META[appearanceSource].label}`}
                  />
                  <output>{selectedTypography.slotHandleFontSize}px</output>
                </label>
                <label className="font-size-control">
                  <span><strong>Thread name</strong><small>Full task title when it is shown</small></span>
                  <input
                    type="range"
                    min="9"
                    max="20"
                    step="1"
                    value={selectedTypography.threadNameFontSize}
                    onChange={(event) => void updateTypography(appearanceSource, { threadNameFontSize: Number(event.currentTarget.value) })}
                    aria-label={`Thread name font size for ${SOURCE_META[appearanceSource].label}`}
                  />
                  <output>{selectedTypography.threadNameFontSize}px</output>
                </label>
              </div>
            </section>

            <div className="appearance-status-grid">
              {TITLE_STATES.map((status) => {
                const setting = snapshot.displaySettings.statusAppearance[appearanceSource][status];
                const sourceLabel = SOURCE_META[appearanceSource].label;
                return (
                  <article className="appearance-card" key={`${appearanceSource}-${status}`}>
                    <div
                      className={`appearance-preview task-source-${appearanceSource} motion-${setting.animation}`}
                      style={{
                        "--task-color": setting.backgroundColor,
                        "--task-background": setting.backgroundColor,
                        "--task-foreground": contrastForeground(setting.backgroundColor),
                      } as React.CSSProperties}
                      aria-hidden="true"
                    >
                      <span>{SOURCE_META[appearanceSource].shortLabel}</span>
                      <strong>{STATUS_META[status].label.slice(0, 1)}</strong>
                    </div>
                    <div className="appearance-card-body">
                      <div className="appearance-card-title">
                        <div><h3>{STATUS_META[status].label}</h3><p>{STATUS_META[status].description}</p></div>
                        <label className="color-control">
                          <input
                            type="color"
                            value={setting.backgroundColor}
                            onChange={(event) => void updateStatusAppearance(appearanceSource, status, { backgroundColor: event.currentTarget.value })}
                            aria-label={`Background color for ${sourceLabel} ${STATUS_META[status].label}`}
                          />
                          <output>{setting.backgroundColor}</output>
                        </label>
                      </div>
                      <div className="animation-options" role="group" aria-label={`Animation for ${sourceLabel} ${STATUS_META[status].label}`}>
                        {ANIMATION_META.map((animation) => (
                          <button
                            key={animation.id}
                            className={setting.animation === animation.id ? "animation-selected" : ""}
                            onClick={() => void updateStatusAppearance(appearanceSource, status, { animation: animation.id })}
                            aria-pressed={setting.animation === animation.id}
                            aria-label={`Use ${animation.label} animation for ${sourceLabel} ${STATUS_META[status].label}`}
                            title={animation.description}
                          >
                            {animation.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>}

        {activeView === "labels" && <>
          <header className="topbar">
            <div>
              <p className="section-kicker">Stream Deck appearance</p>
              <h1>Key labels</h1>
              <p className="topbar-copy">Choose when a Stream Deck key includes the full Codex or Claude task name.</p>
            </div>
          </header>

          <section className="title-settings-panel page-panel" aria-labelledby="title-settings-heading">
            <div className="panel-heading">
              <div>
                <h2 id="title-settings-heading">Show thread titles</h2>
                <p>Compact project labels always remain visible. Turn on the full task title for whichever states you want.</p>
              </div>
            </div>
            <div className="title-settings-grid">
              {TITLE_STATES.map((status) => (
                <label className="title-setting-option" key={status}>
                  <span
                    className="title-setting-dot"
                    style={{
                      "--codex-color": snapshot.displaySettings.statusAppearance.codex[status].backgroundColor,
                      "--claude-color": snapshot.displaySettings.statusAppearance.claude[status].backgroundColor,
                    } as React.CSSProperties}
                  />
                  <span className="title-setting-copy"><strong>{STATUS_META[status].label}</strong><small>{snapshot.displaySettings.showThreadTitle[status] ? "Title shown" : "Compact label only"}</small></span>
                  <span className="label-toggle">
                    <input
                      type="checkbox"
                      checked={snapshot.displaySettings.showThreadTitle[status]}
                      onChange={(event) => void updateTitleVisibility(status, event.currentTarget.checked)}
                      aria-label={`Show titles for ${STATUS_META[status].label} tasks`}
                    />
                    <span aria-hidden="true" />
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="behavior-panel" aria-labelledby="behavior-heading">
            <div className="panel-heading">
              <div>
                <h2 id="behavior-heading">Attention signals</h2>
                <p>Color and motion now follow the per-app choices in Appearance.</p>
              </div>
            </div>
            <div className="behavior-list">
              {TITLE_STATES.map((status) => (
                <div className="behavior-row" key={status}>
                  <span
                    className="behavior-swatch"
                    style={{
                      "--codex-color": snapshot.displaySettings.statusAppearance.codex[status].backgroundColor,
                      "--claude-color": snapshot.displaySettings.statusAppearance.claude[status].backgroundColor,
                    } as React.CSSProperties}
                  />
                  <div><strong>{STATUS_META[status].label}</strong><p>Codex and Claude can use different colors and motion.</p></div>
                </div>
              ))}
            </div>
          </section>
        </>}

        {activeView === "activity" && <>
        <header className="topbar">
          <div>
            <p className="section-kicker">Session log</p>
            <h1>Activity</h1>
            <p className="topbar-copy">See task transitions and companion events from this session.</p>
          </div>
        </header>

        <section className="event-panel page-panel" aria-labelledby="event-heading">
          <div className="panel-heading">
            <div>
              <h2 id="event-heading">Recent events</h2>
              <p>Task transitions and companion events from this session.</p>
            </div>
            <button className="text-button" onClick={() => setEvents([])} disabled={events.length === 0}>Clear</button>
          </div>
          <div className="event-list" aria-live="polite">
            {events.length === 0 ? (
              <div className="empty-state">
                <TerminalWindow />
                <div><strong>No activity yet</strong><p>Codex and Claude task changes will appear here.</p></div>
              </div>
            ) : events.map((event) => (
              <div className="event-row" key={event.id}>
                <span className={`event-symbol event-${event.level}`}>
                  {event.level === "success" ? <Check /> : event.level === "error" ? <X /> : event.level === "warning" ? <Warning /> : <CircleNotch />}
                </span>
                <time>{formatTime(event.timestamp)}</time>
                <span className="event-source">{event.source}</span>
                <strong>{event.message}</strong>
                <span className="event-detail">{event.detail}</span>
              </div>
            ))}
          </div>
        </section>
        </>}
      </main>
    </div>
  );
}
