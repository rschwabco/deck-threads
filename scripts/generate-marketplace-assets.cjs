const { app, BrowserWindow, nativeImage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const outputRoot = path.join(projectRoot, "marketplace");

const taskKeys = [
  ["DT1", "working", ""],
  ["MP1", "working", ""],
  ["DS2", "unread", ""],
  ["API1", "read", "◆"],
  ["WB3", "waiting", ""],
  ["UX1", "read", ""],
  ["RL2", "error", "◆"],
  ["QA1", "read", ""],
];

const baseStyles = `
  * { box-sizing: border-box; }
  html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
  body { position: relative; color: #f7f8fb; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif; background: #080b12; }
  body::before { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 77% 25%, rgba(61, 99, 255, .22), transparent 34%), linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px); background-size: auto, 48px 48px, 48px 48px; mask-image: linear-gradient(to bottom, black, transparent 90%); }
  .frame { position: relative; z-index: 1; width: 100%; height: 100%; padding: 82px 96px; }
  .eyebrow { color: #829cff; font: 700 20px ui-monospace, "SFMono-Regular", monospace; letter-spacing: .13em; text-transform: uppercase; }
  h1 { max-width: 850px; margin: 22px 0 0; font-size: 88px; line-height: .96; letter-spacing: -.065em; }
  h2 { margin: 0; font-size: 60px; line-height: 1; letter-spacing: -.05em; }
  .lede { max-width: 720px; margin: 28px 0 0; color: #aab2c0; font-size: 28px; line-height: 1.4; }
  .mark { display: grid; grid-template-columns: repeat(4, 18px); gap: 8px; width: max-content; }
  .mark i { width: 18px; height: 21px; border-radius: 5px; background: #5276ff; box-shadow: 0 0 22px rgba(82,118,255,.4); }
  .mark i:nth-child(2), .mark i:nth-child(7) { background: #a7b8ff; }
  .deck { display: grid; grid-template-columns: repeat(4, 148px); gap: 18px; padding: 30px; border: 1px solid #2a3140; border-radius: 42px; background: linear-gradient(145deg, #1b202a, #0e1118); box-shadow: 0 50px 100px rgba(0,0,0,.5), inset 0 1px rgba(255,255,255,.08); transform: perspective(1400px) rotateX(5deg) rotateY(-6deg); }
  .key { position: relative; width: 148px; height: 148px; display: grid; place-items: center; overflow: hidden; border: 2px solid rgba(255,255,255,.15); border-radius: 25px; background: #202631; box-shadow: inset 0 2px rgba(255,255,255,.12), 0 9px 0 #07090d, 0 18px 28px rgba(0,0,0,.28); }
  .key strong { font-size: 42px; letter-spacing: -.045em; }
  .key small { position: absolute; top: 14px; right: 16px; color: rgba(255,255,255,.72); font-size: 17px; }
  .key.working { background: linear-gradient(145deg, #547bff, #213fb4); }
  .key.working::before { content: ""; position: absolute; width: 190px; height: 80px; border: 12px solid rgba(255,255,255,.24); border-radius: 50%; transform: rotate(-22deg); }
  .key.working strong { position: absolute; z-index: 1; bottom: 15px; left: 17px; font-size: 26px; }
  .key.unread { color: #07190e; background: linear-gradient(145deg, #5bf09e, #159454); box-shadow: inset 0 2px rgba(255,255,255,.25), 0 9px 0 #063f23, 0 0 48px rgba(46,212,122,.35); }
  .key.unread::before, .key.unread::after { content: ""; position: absolute; border: 5px solid rgba(226,255,239,.7); border-radius: 50%; }
  .key.unread::before { width: 70px; height: 70px; }
  .key.unread::after { width: 108px; height: 108px; opacity: .55; }
  .key.unread strong { z-index: 1; }
  .key.read { background: linear-gradient(145deg, #333b49, #1b202a); }
  .key.waiting { background: linear-gradient(145deg, #e9a445, #774917); }
  .key.error { background: linear-gradient(145deg, #ff687b, #8e2133); }
  .footer { position: absolute; left: 96px; right: 96px; bottom: 58px; display: flex; justify-content: space-between; align-items: center; color: #717a89; font-size: 18px; }
  .brandline { display: flex; align-items: center; gap: 16px; color: #f6f7fb; font-weight: 700; }
  .brandline .mark { grid-template-columns: repeat(4, 7px); gap: 3px; }
  .brandline .mark i { width: 7px; height: 8px; border-radius: 2px; }
`;

function mark() {
  return `<span class="mark">${"<i></i>".repeat(8)}</span>`;
}

function deck(keys = taskKeys) {
  return `<div class="deck">${keys.map(([label, state, pin]) => `<div class="key ${state}"><small>${pin}</small><strong>${label}</strong></div>`).join("")}</div>`;
}

function page(content, extraStyles = "") {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseStyles}${extraStyles}</style></head><body>${content}</body></html>`;
}

const pages = [
  ["thumbnail.png", page(`
    <div class="frame thumbnail">
      <section>${mark()}<h1>Deck<br>Threads</h1><p class="lede">Your live Codex Desktop tasks, on Stream Deck.</p></section>
      <section class="deck-wrap">${deck()}</section>
      <div class="footer"><span>Local macOS companion</span><span>Eight stable task slots</span></div>
    </div>`, `
      .thumbnail { display: grid; grid-template-columns: .82fr 1.18fr; align-items: center; }
      .thumbnail h1 { font-size: 114px; }
      .deck-wrap { margin-left: 40px; }
    `)],
  ["gallery-01-live-tasks.png", page(`
    <div class="frame">
      <div class="eyebrow">Live task surface</div>
      <h2>Eight tasks.<br>Zero tab hunting.</h2>
      <p class="lede">Recently active work comes first. Stable slots keep every working task exactly where you expect it.</p>
      <div class="visual visual-deck">${deck()}</div>
      <div class="footer"><span class="brandline">${mark()} Deck Threads</span><span>Press any key to open the exact task</span></div>
    </div>`, `
      .visual-deck { position: absolute; right: 100px; top: 124px; }
      h2 { margin-top: 28px; }
      .lede { width: 620px; }
    `)],
  ["gallery-02-attention.png", page(`
    <div class="frame">
      <div class="eyebrow">Attention without noise</div>
      <h2>Know what needs you.</h2>
      <p class="lede">Subtle motion for active work. A stronger full-color signal when finished work is waiting to be read.</p>
      <div class="signal-row">
        <div><div class="key working"><strong>DT1</strong></div><b>Working</b><span>Calm flow</span></div>
        <div><div class="key unread"><strong>MP1</strong></div><b>Unread</b><span>Needs attention</span></div>
        <div><div class="key waiting"><strong>QA2</strong></div><b>Waiting</b><span>Needs input</span></div>
        <div><div class="key error"><strong>API1</strong></div><b>Error</b><span>Cannot continue</span></div>
      </div>
      <div class="footer"><span class="brandline">${mark()} Deck Threads</span><span>Color and motion at a glance</span></div>
    </div>`, `
      .signal-row { display: flex; gap: 34px; margin-top: 64px; }
      .signal-row > div { width: 190px; }
      .signal-row .key { width: 190px; height: 190px; }
      .signal-row b, .signal-row span { display: block; }
      .signal-row b { margin-top: 24px; font-size: 24px; }
      .signal-row span { margin-top: 5px; color: #788293; font-size: 17px; }
    `)],
  ["gallery-03-local-companion.png", page(`
    <div class="frame">
      <div class="eyebrow">Built for your Mac</div>
      <h2>Local by design.</h2>
      <p class="lede">No API key, account, analytics, cloud storage, or remote backend. Your task metadata stays on this Mac.</p>
      <div class="app-window">
        <div class="window-rail">${mark()}<strong>Deck Threads</strong><span>THREADS</span><span>CONNECTIONS</span><span>ACTIVITY</span></div>
        <div class="window-main"><small>CONNECTIONS</small><h3>Everything is in sync.</h3>
          <div class="connection"><i></i><b>Codex Desktop</b><em>ONLINE</em></div>
          <div class="connection"><i></i><b>Stream Deck</b><em>ONLINE</em></div>
          <div class="connection"><i></i><b>Local companion</b><em>ONLINE</em></div>
          <p>Loopback only · 127.0.0.1</p>
        </div>
      </div>
      <div class="footer"><span class="brandline">${mark()} Deck Threads</span><span>Starts automatically at login</span></div>
    </div>`, `
      .app-window { position: absolute; right: 90px; top: 105px; width: 900px; height: 690px; display: grid; grid-template-columns: 250px 1fr; overflow: hidden; border: 1px solid #313847; border-radius: 30px; background: #121722; box-shadow: 0 50px 100px rgba(0,0,0,.55); transform: perspective(1600px) rotateY(-4deg); }
      .window-rail { display: flex; flex-direction: column; gap: 24px; padding: 50px 32px; border-right: 1px solid #252d3a; background: #0e131c; }
      .window-rail .mark { grid-template-columns: repeat(4, 8px); gap: 4px; }
      .window-rail .mark i { width: 8px; height: 9px; border-radius: 2px; }
      .window-rail strong { margin-bottom: 32px; font-size: 22px; }
      .window-rail span { color: #7d8796; font: 700 13px ui-monospace, monospace; letter-spacing: .08em; }
      .window-main { padding: 82px 62px; }
      .window-main small { color: #829cff; font: 700 14px ui-monospace, monospace; letter-spacing: .12em; }
      .window-main h3 { margin: 16px 0 42px; font-size: 46px; letter-spacing: -.05em; }
      .connection { display: grid; grid-template-columns: 18px 1fr auto; align-items: center; gap: 16px; padding: 24px 0; border-bottom: 1px solid #2b3341; }
      .connection i { width: 12px; height: 12px; border-radius: 50%; background: #45da88; box-shadow: 0 0 16px rgba(69,218,136,.55); }
      .connection b { font-size: 20px; }
      .connection em { color: #6ee6a3; font: 700 12px ui-monospace, monospace; font-style: normal; letter-spacing: .1em; }
      .window-main p { margin-top: 32px; color: #747e8d; font: 15px ui-monospace, monospace; }
      .frame > .lede { width: 650px; }
    `)],
];

async function render(window, name, html) {
  const renderPath = path.join(outputRoot, `.${name}.html`);
  fs.writeFileSync(renderPath, html);
  await window.loadFile(renderPath);
  const image = await window.capturePage();
  fs.writeFileSync(path.join(outputRoot, name), image.toPNG());
  fs.rmSync(renderPath, { force: true });
}

app.whenReady().then(async () => {
  fs.mkdirSync(outputRoot, { recursive: true });
  const window = new BrowserWindow({
    show: false,
    frame: false,
    useContentSize: true,
    width: 1920,
    height: 960,
    backgroundColor: "#080b12",
    webPreferences: { offscreen: true },
  });
  for (const [name, html] of pages) await render(window, name, html);
  window.destroy();
  const icon = nativeImage.createFromPath(path.join(projectRoot, "build", "icon.png"));
  fs.writeFileSync(path.join(outputRoot, "app-icon.png"), icon.resize({ width: 288, height: 288, quality: "best" }).toPNG());
  process.stdout.write(`Generated ${pages.length + 1} Marketplace assets in ${outputRoot}\n`);
  app.quit();
}).catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  app.exit(1);
});
