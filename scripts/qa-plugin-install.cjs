const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron: electron } = require("playwright");

(async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-threads-plugin-ui-"));
  const pluginsRoot = path.join(userDataDir, "stream-deck-plugins");
  const pluginDestination = path.join(pluginsRoot, "com.roie.deck-threads.sdPlugin");
  const bridgePort = 19877;
  const screenshot = path.join(process.cwd(), "output", "playwright", "deck-threads-plugin-install.png");
  fs.mkdirSync(path.dirname(screenshot), { recursive: true });

  const application = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      DECK_THREADS_BRIDGE_PORT: String(bridgePort),
      DECK_THREADS_BUNDLED_PLUGIN_DIR: path.join(process.cwd(), "stream-deck", "com.roie.deck-threads.sdPlugin"),
      DECK_THREADS_SKIP_STREAM_DECK_RESTART: "1",
      DECK_THREADS_STREAM_DECK_PLUGINS_DIR: pluginsRoot,
      DECK_THREADS_USER_DATA_DIR: userDataDir,
    },
  });

  try {
    const page = await application.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await page.getByRole("heading", { name: "Your agent work, on deck." }).waitFor();
    await page.getByRole("button", { name: "Connections" }).click();
    await page.getByRole("heading", { name: "Connection status" }).waitFor();

    const streamDeckRow = page.locator(".health-item").filter({ hasText: "Stream Deck" });
    await streamDeckRow.getByText("Offline", { exact: true }).waitFor();
    assert.match((await streamDeckRow.textContent()) || "", /plugin is not installed/i);
    assert.equal(fs.existsSync(pluginDestination), false);

    await streamDeckRow.getByRole("button", { name: "Install plugin" }).click();
    await page.getByText(/Stream Deck plugin installed \(version \d+\.\d+\.\d+\.\d+\)\./).waitFor();
    assert.equal(fs.existsSync(path.join(pluginDestination, "manifest.json")), true);

    const snapshot = await page.evaluate(() => window.bridgeApi.getSnapshot());
    assert.equal(snapshot.streamDeck.pluginInstalled, true);
    assert.equal(snapshot.streamDeck.pluginConnected, false);
    assert.match(snapshot.streamDeck.pluginVersion || "", /^\d+\.\d+\.\d+\.\d+$/);

    const healthResponse = await fetch(`http://127.0.0.1:${bridgePort}/v1/health`);
    assert.equal(healthResponse.ok, true);
    const health = await healthResponse.json();
    assert.equal(health.streamDeckPlugin.installed, true);
    assert.equal(health.streamDeckPlugin.installedVersion, snapshot.streamDeck.pluginVersion);

    await page.screenshot({ path: screenshot, fullPage: true });
    process.stdout.write(`${JSON.stringify({ snapshot: snapshot.streamDeck, health: health.streamDeckPlugin, screenshot }, null, 2)}\n`);
  } finally {
    await application.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
})().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
