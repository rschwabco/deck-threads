const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron: electron } = require("playwright");

async function waitForJson(url, attempts = 40) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`${url} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

(async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-threads-runtime-smoke-"));
  const bridgePort = 19877;
  const application = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      DECK_THREADS_BRIDGE_PORT: String(bridgePort),
      DECK_THREADS_USER_DATA_DIR: userDataDir,
      DECK_THREADS_UPDATE_FIXTURE: "up-to-date",
    },
  });

  try {
    const page = await application.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await page.getByRole("heading", { name: "Eight live task keys" }).waitFor();

    assert.equal(await page.title(), "Deck Threads");
    assert.equal(await page.locator(".task-key").count(), 8);

    const health = await waitForJson(`http://127.0.0.1:${bridgePort}/v1/health`);
    assert.equal(health.ok, true);
    assert.equal(health.service, "deck-threads");
    assert.equal(health.version, require("../package.json").version);

    const threads = await waitForJson(`http://127.0.0.1:${bridgePort}/v1/threads`);
    assert.equal(Array.isArray(threads.tasks), true);
    assert.deepEqual(threads.allocationSettings.reservations, { codex: 4, claude: 4 });
    assert.equal(threads.allocationSettings.fillUnused, true);

    console.log(JSON.stringify({
      architecture: process.arch,
      version: health.version,
      renderedTaskKeys: 8,
      bridgeHealthy: true,
    }));
  } finally {
    await application.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
