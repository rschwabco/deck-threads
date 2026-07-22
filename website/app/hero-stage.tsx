const INSTALLER_DOWNLOAD = "https://github.com/rschwabco/deck-threads/releases/download/v1.0.1-beta.1/Deck-Threads-Installer.dmg";
const COMPANION_DOWNLOAD = "https://github.com/rschwabco/deck-threads/releases/download/v1.0.1-beta.1/Deck-Threads-Companion.dmg";

const keys = [
  { label: "DT1", title: "Deck Threads site", state: "working" },
  { label: "MP1", title: "Marketplace plan", state: "read" },
  { label: "QA2", title: "Review release", state: "unread" },
  { label: "?", title: "Needs your input", state: "question" },
  { label: "NX1", title: "Nexus integration", state: "read" },
  { label: "DT2", title: "Package companion", state: "working" },
  { label: "AS1", title: "Stand up QA", state: "read" },
  { label: "MP2", title: "Fix support routing", state: "read" },
];

export default function HeroStage() {
  return (
    <section className="hero" id="top" data-parallax-root>
      <div className="hero-copy">
        <div className="eyebrow"><span className="live-dot" /> Built for desktop coding agents</div>
        <h1>Your tasks.<br /><span>Within reach.</span></h1>
        <p className="hero-lede">
          Deck Threads puts eight active coding-agent tasks on Stream Deck. See what needs you and press a key to open the exact task.
        </p>
        <div className="hero-actions">
          <a className="button button-primary" href={INSTALLER_DOWNLOAD} download>
            <span>Download app + plugin (.dmg)</span><span aria-hidden="true">↓</span>
          </a>
          <a className="button button-secondary" href={COMPANION_DOWNLOAD} download>
            Companion app only (.dmg)
          </a>
        </div>
        <p className="requirements">Universal macOS beta · Developer ID signed · Apple notarization pending</p>
      </div>

      <div
        className="hero-visual"
        role="img"
        aria-label="Eight active coding-agent tasks mapped to Stream Deck keys"
        data-scroll-parallax
        data-parallax-speed="0.105"
        data-parallax-max="112"
      >
        <div className="deck-glow" aria-hidden="true" />
        <div className="deck-shell">
          <div className="deck-topline"><span>8 ACTIVE TASKS</span><span className="connection"><i /> CONNECTED</span></div>
          <div className="key-grid">
            {keys.map((key) => (
              <div className={`task-key ${key.state}`} key={`${key.label}-${key.title}`}>
                <span className="key-label">{key.label}</span>
                <span className="key-title">{key.title}</span>
                {key.state === "working" && <span className="working-wave" aria-hidden="true" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
