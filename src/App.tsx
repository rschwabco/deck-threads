import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowSquareOut,
  ArrowsClockwise,
  Check,
  CircleNotch,
  Command,
  Monitor,
  Plug,
  PushPinSimple,
  SquaresFour,
  TerminalWindow,
  Warning,
  X,
} from "@phosphor-icons/react";
import type { CodexTaskStatus, EventEntry, HealthState, SystemSnapshot } from "./types";

const STATUS_META: Record<CodexTaskStatus, { label: string; color: string; description: string }> = {
  working: { label: "Working", color: "#4169FF", description: "A calm cobalt flow while Codex is active." },
  unread: { label: "Unread", color: "#2ED47A", description: "A brighter green signal when work finishes." },
  read: { label: "Read", color: "#D9DEE8", description: "A quiet neutral key after you view the result." },
  waiting: { label: "Waiting", color: "#F5A742", description: "Amber when Codex needs your attention." },
  error: { label: "Error", color: "#FF5C70", description: "Red when a task cannot continue." },
  off: { label: "Empty", color: "#303746", description: "An unused slot stays dark." },
};

const EMPTY_SNAPSHOT: SystemSnapshot = {
  scannedAt: new Date(0).toISOString(),
  codex: { state: "missing", processCount: 0, detail: "Looking for Codex Desktop.", source: "Scanning", tasks: [] },
  streamDeck: { state: "missing", processCount: 0, pluginConnected: false, detail: "Looking for Stream Deck." },
  companion: { state: "connected", detail: "Starting the local task service." },
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
    working: snapshot.codex.tasks.filter((task) => task?.status === "working").length,
    unread: snapshot.codex.tasks.filter((task) => task?.status === "unread").length,
    pinned: snapshot.codex.tasks.filter((task) => task?.pinned).length,
  }), [snapshot.codex.tasks]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadSnapshot(true);
    } finally {
      setRefreshing(false);
    }
  };

  const openTask = async (slot: number) => {
    const task = snapshot.codex.tasks[slot];
    if (!task) return;
    const result = await window.bridgeApi.openCodexThread(task.id, task.title);
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
          <a className="nav-item nav-active" href="#threads"><SquaresFour /> Threads</a>
          <a className="nav-item" href="#status"><Plug /> Connections</a>
          <a className="nav-item" href="#activity"><TerminalWindow /> Activity</a>
        </nav>

        <div className="sidebar-note">
          <p>Deck sync</p>
          <strong>{snapshot.streamDeck.pluginConnected ? "Plugin connected" : "Waiting for plugin"}</strong>
          <span>Keep this companion running to update keys and open tasks.</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar" id="threads">
          <div>
            <p className="section-kicker">Live task surface</p>
            <h1>Your Codex work, on deck.</h1>
            <p className="topbar-copy">See what is active, spot finished work, and open any task with one press.</p>
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
          <div><strong>{taskCounts.unread}</strong><span>unread</span></div>
          <div><strong>{taskCounts.pinned}</strong><span>pinned</span></div>
          <p>{snapshot.codex.source}</p>
        </section>

        <section className="task-panel" aria-labelledby="task-heading">
          <div className="panel-heading">
            <div>
              <h2 id="task-heading">Eight live task keys</h2>
              <p>Working tasks keep their key. Open slots follow recent activity first, then pinned projects. Press any task here or on your Stream Deck to open it in Codex.</p>
            </div>
          </div>

          <div className="task-grid">
            {Array.from({ length: 8 }, (_, index) => snapshot.codex.tasks[index]).map((task, index) => {
              const status = STATUS_META[task?.status || "off"];
              return (
                <button
                  className={`task-key task-${task?.status || "off"}`}
                  key={task?.id || `empty-${index}`}
                  onClick={() => openTask(index)}
                  disabled={!task}
                  data-thread-id={task?.id}
                  data-cwd={task?.cwd}
                  style={{ "--task-color": status.color } as React.CSSProperties}
                  aria-label={task ? `Open task slot ${index + 1} in Codex: ${task.title}, ${status.label}` : `Task slot ${index + 1}: empty`}
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

        <div className="lower-grid" id="status">
          <section className="connection-panel" aria-labelledby="connection-heading">
            <div className="panel-heading">
              <div>
                <h2 id="connection-heading">Connections</h2>
                <p>The companion stays local. It reads Codex task state and serves it only to Stream Deck on this Mac.</p>
              </div>
            </div>
            {loading ? (
              <div className="health-loading" aria-label="Checking connections">
                {[0, 1, 2].map((item) => <div className="skeleton" key={item} />)}
              </div>
            ) : (
              <div className="health-list">
                <HealthItem icon={<Command />} label="Codex Desktop" state={snapshot.codex.state} detail={snapshot.codex.detail} />
                <HealthItem icon={<Monitor />} label="Stream Deck" state={snapshot.streamDeck.state} detail={snapshot.streamDeck.detail} />
                <HealthItem icon={<Plug />} label="Local companion" state={snapshot.companion.state} detail={snapshot.companion.detail} />
              </div>
            )}
          </section>

          <section className="behavior-panel" aria-labelledby="behavior-heading">
            <div className="panel-heading">
              <div>
                <h2 id="behavior-heading">Attention signals</h2>
                <p>Color and motion communicate task state at a glance.</p>
              </div>
            </div>
            <div className="behavior-list">
              {(Object.keys(STATUS_META) as CodexTaskStatus[]).filter((status) => status !== "off").map((status) => (
                <div className="behavior-row" key={status}>
                  <span className={`behavior-swatch swatch-${status}`} style={{ "--task-color": STATUS_META[status].color } as React.CSSProperties} />
                  <div><strong>{STATUS_META[status].label}</strong><p>{STATUS_META[status].description}</p></div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="event-panel" id="activity" aria-labelledby="event-heading">
          <div className="panel-heading">
            <div>
              <h2 id="event-heading">Activity</h2>
              <p>Task transitions and companion events from this session.</p>
            </div>
            <button className="text-button" onClick={() => setEvents([])} disabled={events.length === 0}>Clear</button>
          </div>
          <div className="event-list" aria-live="polite">
            {events.length === 0 ? (
              <div className="empty-state">
                <TerminalWindow />
                <div><strong>No activity yet</strong><p>Task changes will appear here as Codex works.</p></div>
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
      </main>
    </div>
  );
}
