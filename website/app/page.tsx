import HeroStage from "./hero-stage";

const INSTALLER_DOWNLOAD = "https://github.com/rschwabco/deck-threads/releases/download/v1.0.1-beta.1/Deck-Threads-Installer.dmg";
const COMPANION_DOWNLOAD = "https://github.com/rschwabco/deck-threads/releases/download/v1.0.1-beta.1/Deck-Threads-Companion.dmg";

const footerKeys = ["DT1", "MP1", "QA2", "?", "NX1", "DT2", "AS1", "MP2"];

export default function Home() {
  return (
    <main id="main-content">
      <a className="skip-link" href="#product">Skip to product</a>
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <nav className="site-nav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Deck Threads home">
          <img src="/deck-threads-icon.png" alt="" width="38" height="38" />
          <span>Deck Threads</span>
        </a>
        <div className="nav-actions">
          <a href="#product">What it does</a>
          <a href="#how-it-works">Setup</a>
          <a className="nav-download" href="#download">Download</a>
        </div>
      </nav>

      <HeroStage />

      <section className="product-story" id="product">
        <div className="product-copy">
          <div className="section-kicker">What it does</div>
          <h2>See what’s active.<br />Press to jump back in.</h2>
          <p>
            The companion mirrors eight active coding-agent tasks to your Stream Deck. Each key opens the matching task in its desktop app—no sidebar search.
          </p>
          <p className="product-detail">
            Questions and finished work surface automatically. Work in progress stays visible without demanding attention.
          </p>
        </div>

        <div className="app-frame">
          <div className="window-bar"><span /><span /><span /><em>Deck Threads</em></div>
          <img src="/deck-threads-app.png" alt="Deck Threads companion showing eight active agent tasks" width="1280" height="640" />
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="section-kicker">Three short steps</div>
        <h2>From download to working keys.</h2>
        <div className="steps">
          <article><span>1</span><div><h3>Install</h3><p>Download the DMG and drag Deck Threads into Applications.</p></div></article>
          <article><span>2</span><div><h3>Launch once</h3><p>The all-in-one build installs or updates the bundled Stream Deck plugin automatically.</p></div></article>
          <article><span>3</span><div><h3>Press a key</h3><p>Deck Threads opens the matching task in your desktop coding agent.</p></div></article>
        </div>
        <div className="privacy-note"><span className="privacy-mark">LOCAL</span><p><strong>Your task data stays on your Mac.</strong> No account, analytics, telemetry, cloud storage, or API key.</p></div>
      </section>

      <section className="download-section" id="download">
        <div className="download-grid" aria-hidden="true">
          {footerKeys.map((label, index) => <span key={`${label}-${index}`} className={label === "?" ? "question" : index === 0 || index === 5 ? "working" : "read"}>{label}</span>)}
        </div>
        <div className="download-copy">
          <div className="section-kicker">Ready when you are</div>
          <h2>Put your tasks<br />within reach.</h2>
          <div className="hero-actions">
            <a className="button button-light" href={INSTALLER_DOWNLOAD} download>Download app + plugin (.dmg) <span aria-hidden="true">↓</span></a>
            <a className="button button-ghost" href={COMPANION_DOWNLOAD} download>Companion app only (.dmg)</a>
          </div>
          <p className="requirements">Universal macOS beta · Developer ID signed · Apple notarization pending</p>
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
