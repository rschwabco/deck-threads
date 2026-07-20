const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron: electron } = require("playwright");

async function layoutMetrics(page) {
  return page.evaluate(() => ({
    innerWidth: window.innerWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
  }));
}

async function captureWindow(application, outputPath) {
  const base64 = await application.evaluate(async ({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    const image = await window.capturePage();
    const [width, height] = window.getContentSize();
    return image.resize({ width, height, quality: "best" }).toPNG().toString("base64");
  });
  fs.writeFileSync(outputPath, Buffer.from(base64, "base64"));
}

(async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-threads-qa-"));
  const application = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      CODEX_BRIDGE_API_DISABLED: "1",
      DECK_THREADS_USER_DATA_DIR: userDataDir,
    },
  });

  try {
    const page = await application.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await page.getByRole("heading", { name: "Eight live task keys" }).waitFor();
    await page.waitForFunction(() => /Working|Question|Unread|Read/.test(document.querySelector(".task-key")?.getAttribute("aria-label") || ""));

    const title = await page.title();
    const taskSlots = page.locator(".task-key");
    const taskCount = await taskSlots.count();
    const firstTaskLabel = await taskSlots.first().getAttribute("aria-label");
    const source = (await page.locator(".summary-strip p").textContent())?.trim();

    assert.equal(title, "Deck Threads");
    assert.equal(taskCount, 8);
    assert.match(firstTaskLabel || "", /Working|Question|Unread|Read/);
    assert.equal(await page.locator(".sidebar nav .nav-item").count(), 4);

    const invalidOpen = await page.evaluate(() => window.bridgeApi.openCodexThread("not-a-thread-id", "Invalid task"));
    assert.equal(invalidOpen.ok, false);
    assert.match(invalidOpen.message, /invalid task ID/i);

    await page.getByRole("button", { name: "Refresh" }).click();
    await page.waitForFunction(() => !document.querySelector(".button-secondary")?.hasAttribute("disabled"));

    const wideLayout = await layoutMetrics(page);
    assert.ok(wideLayout.bodyScrollWidth <= wideLayout.bodyClientWidth, `Wide layout overflow: ${JSON.stringify(wideLayout)}`);
    assert.ok(wideLayout.documentScrollWidth <= wideLayout.documentClientWidth, `Wide document overflow: ${JSON.stringify(wideLayout)}`);
    await captureWindow(application, "/tmp/deck-threads-wide.png");

    await page.getByRole("button", { name: "Connections" }).click();
    await page.getByRole("heading", { name: "Connection status" }).waitFor();
    assert.equal(await page.locator(".task-grid").count(), 0);
    const streamDeckStatus = (await page.locator(".health-item").filter({ hasText: "Stream Deck" }).textContent())?.replace(/\s+/g, " ").trim();
    assert.match(streamDeckStatus || "", /Online|Offline|Error/);

    await page.getByRole("button", { name: "Key labels" }).click();
    await page.getByRole("heading", { name: "Show thread titles" }).waitFor();
    assert.equal(await page.locator(".task-grid").count(), 0);
    assert.ok(await page.getByText("Attention signals", { exact: true }).isVisible());

    const titleToggles = page.locator(".title-setting-option input");
    assert.equal(await titleToggles.count(), 6);
    const questionRow = page.locator(".title-setting-option").filter({ hasText: "Question" });
    const questionToggle = questionRow.getByRole("checkbox", { name: "Show titles for Question tasks" });
    assert.ok(await questionRow.isVisible());
    assert.equal(await questionToggle.isChecked(), false);
    await questionRow.click();
    assert.equal(await questionToggle.isChecked(), true);
    await page.waitForTimeout(150);
    const persistedSettings = JSON.parse(fs.readFileSync(path.join(userDataDir, "display-settings.json"), "utf8"));
    assert.equal(persistedSettings.showThreadTitle.question, true);
    await captureWindow(application, "/tmp/deck-threads-key-labels.png");

    await page.getByRole("button", { name: "Activity" }).click();
    await page.getByRole("heading", { name: "Recent events" }).waitFor();
    assert.equal(await page.locator(".title-settings-panel").count(), 0);

    await page.getByRole("button", { name: "Key labels" }).click();

    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setSize(960, 680);
    });
    await page.waitForTimeout(300);
    const compactLayout = await layoutMetrics(page);
    assert.ok(compactLayout.bodyScrollWidth <= compactLayout.bodyClientWidth, `Compact layout overflow: ${JSON.stringify(compactLayout)}`);
    assert.ok(compactLayout.documentScrollWidth <= compactLayout.documentClientWidth, `Compact document overflow: ${JSON.stringify(compactLayout)}`);
    await captureWindow(application, "/tmp/deck-threads-compact.png");

    process.stdout.write(`${JSON.stringify({
      title,
      source,
      firstTaskLabel,
      streamDeckStatus,
      questionTitleEnabled: await questionToggle.isChecked(),
      wideLayout,
      compactLayout,
      screenshots: ["/tmp/deck-threads-wide.png", "/tmp/deck-threads-key-labels.png", "/tmp/deck-threads-compact.png"],
    }, null, 2)}\n`);
  } finally {
    await application.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
})().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
