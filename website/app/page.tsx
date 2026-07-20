const RELEASE_BASE = "https://github.com/rschwabco/deck-threads/releases/latest/download";
const APP_DOWNLOAD = `${RELEASE_BASE}/Deck-Threads-1.0.0-universal.dmg`;
const PLUGIN_DOWNLOAD = `${RELEASE_BASE}/com.roie.deck-threads.streamDeckPlugin`;

const keys = [
  { label: "DT1", title: "Deck Threads site", state: "working", delay: "0s" },
  { label: "MP1", title: "Marketplace plan", state: "read", delay: "-.6s" },
  { label: "QA2", title: "Review release", state: "unread", delay: "-1.2s" },
  { label: "CD1", title: "Needs your input", state: "question", delay: "-1.8s" },
  { label: "NX1", title: "Nexus integration", state: "read", delay: "-.3s" },
  { label: "DT2", title: "Package companion", state: "working", delay: "-.9s" },
  { label: "AS1", title: "Stand up QA", state: "read", delay: "-1.5s" },
  { label: "MP2", title: "Fix support routing", state: "read", delay: "-2.1s" },
];

export default function Home() {
  return (
    <main>
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <nav className="site-nav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Deck Threads home">
          <img src="/deck-threads-icon.png" alt="" width="38" height="38" />
          <span>Deck Threads</span>
        </a>
        <div className="nav-actions">
          <a href="#how-it-works">How it works</a>
          <a href="https://github.com/rschwabco/deck-threads" target="_blank" rel="noreferrer">GitHub</a>
          <a className="nav-download" href={APP_DOWNLOAD}>Download</a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> Built for desktop coding agents</div>
          <h1>Your tasks.<br /><span>Within reach.</span></h1>
          <p className="hero-lede">
            Deck Threads turns Stream Deck into a live control surface for your desktop coding agent—so active work, unread results, and questions never disappear into the sidebar.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href={APP_DOWNLOAD}>
              <span>Download for macOS</span><span aria-hidden="true">↓</span>
            </a>
            <a className="button button-secondary" href={PLUGIN_DOWNLOAD}>
              Get the Stream Deck plugin
            </a>
          </div>
          <p className="requirements">macOS 13+ · Apple silicon & Intel · Free and open source</p>
        </div>

        <div className="hero-visual" aria-label="Eight Deck Threads keys showing live coding-agent task states">
          <div className="deck-glow" aria-hidden="true" />
          <div className="deck-shell">
            <div className="deck-topline"><span>AGENT TASKS</span><span className="connection"><i /> LIVE</span></div>
            <div className="key-grid">
              {keys.map((key, index) => (
                <div
                  className={`task-key ${key.state}`}
                  key={key.label}
                  style={{ "--delay": key.delay, "--order": index } as React.CSSProperties}
                >
                  <span className="key-label">{key.state === "question" ? "?" : key.label}</span>
                  <span className="key-title">{key.title}</span>
                  {key.state === "working" && <span className="working-wave" aria-hidden="true" />}
                </div>
              ))}
            </div>
          </div>
          <div className="orbit orbit-one" aria-hidden="true">QUESTION</div>
          <div className="orbit orbit-two" aria-hidden="true">WORKING</div>
        </div>

        <a className="scroll-cue" href="#attention"><span>See it in motion</span><i aria-hidden="true" /></a>
      </section>

      <section className="signal-strip" aria-label="Task states">
        <span><i className="signal blue" /> Working</span>
        <span><i className="signal orange" /> Needs input</span>
        <span><i className="signal violet" /> Unread</span>
        <span><i className="signal gray" /> Read</span>
      </section>

      <section className="attention-section" id="attention">
        <div className="section-kicker">Attention, engineered</div>
        <div className="attention-grid">
          <div className="attention-copy">
            <h2>Know what needs you<br />without checking.</h2>
            <p>
              Working tasks stay subtle. Completed work asks for a glance. Questions turn unmistakably orange. Every state is designed to earn exactly the right amount of attention.
            </p>
            <div className="state-stack" aria-label="Deck Threads attention states">
              <div className="state-row working-row"><span>01</span><strong>Working</strong><em>Calm, fluid motion</em></div>
              <div className="state-row unread-row"><span>02</span><strong>Unread</strong><em>Ready to review</em></div>
              <div className="state-row question-row"><span>03</span><strong>Needs input</strong><em>Impossible to miss</em></div>
            </div>
          </div>
          <div className="question-stage" aria-hidden="true">
            <div className="question-halo halo-one" />
            <div className="question-halo halo-two" />
            <div className="giant-key"><span>?</span><small>NEEDS INPUT</small></div>
          </div>
        </div>
      </section>

      <section className="product-section">
        <div className="product-heading">
          <div>
            <div className="section-kicker">The companion</div>
            <h2>Eight slots. Zero hunting.</h2>
          </div>
          <p>See the exact tasks selected for your keys, tune title visibility by state, and verify every connection from one quiet menu-bar app.</p>
        </div>
        <div className="app-frame">
          <div className="window-bar"><span /><span /><span /><em>Deck Threads</em></div>
          <img src="/deck-threads-app.png" alt="Deck Threads companion app showing eight agent tasks" width="1280" height="640" />
        </div>
        <div className="feature-grid">
          <article><span>01</span><h3>Stable by design</h3><p>Active tasks keep their physical slot, so muscle memory can take over.</p></article>
          <article><span>02</span><h3>Project-smart labels</h3><p>Compact labels like DT1 and MP2 count tasks inside each project.</p></article>
          <article><span>03</span><h3>One press to focus</h3><p>Press a key and the exact task opens in your desktop agent immediately.</p></article>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="section-kicker">Set up in minutes</div>
        <h2>Local from end to end.</h2>
        <div className="steps">
          <article><span>1</span><div><h3>Install the companion</h3><p>Drag Deck Threads into Applications. It lives quietly in your menu bar and starts at login.</p></div></article>
          <article><span>2</span><div><h3>Add the plugin</h3><p>Open the Stream Deck plugin package. The included profile lays out two rows of four keys.</p></div></article>
          <article><span>3</span><div><h3>Keep building</h3><p>Your keys update automatically and open the matching agent task with one press.</p></div></article>
        </div>
        <div className="privacy-note"><span className="privacy-mark">LOCAL</span><p><strong>Your task data stays on your Mac.</strong> No account, analytics, telemetry, cloud storage, or API key.</p></div>
      </section>

      <section className="download-section">
        <div className="download-grid" aria-hidden="true">
          {keys.map((key) => <span key={`footer-${key.label}`} className={key.state}>{key.state === "question" ? "?" : key.label}</span>)}
        </div>
        <div className="download-copy">
          <div className="section-kicker">Ready when you are</div>
          <h2>Put your agent<br />at your fingertips.</h2>
          <div className="hero-actions">
            <a className="button button-light" href={APP_DOWNLOAD}>Download for macOS <span aria-hidden="true">↓</span></a>
            <a className="button button-ghost" href={PLUGIN_DOWNLOAD}>Stream Deck plugin</a>
          </div>
          <p className="requirements">Version 1.0 · Universal macOS app · MIT licensed</p>
        </div>
      </section>

      <footer>
        <a className="brand" href="#top"><img src="/deck-threads-icon.png" alt="" width="34" height="34" /><span>Deck Threads</span></a>
        <p>Independent, open source, and built for focused work.</p>
        <div><a href="https://github.com/rschwabco/deck-threads">GitHub</a><a href="https://github.com/rschwabco/deck-threads/blob/main/docs/PRIVACY.md">Privacy</a><a href="https://github.com/rschwabco/deck-threads/issues">Support</a></div>
      </footer>
    </main>
  );
}
