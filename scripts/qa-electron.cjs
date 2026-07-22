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
  const bridgePort = 19876;
  const outputDir = path.join(process.cwd(), "output", "playwright");
  fs.mkdirSync(outputDir, { recursive: true });
  const screenshots = {
    wide: path.join(outputDir, "deck-threads-wide.png"),
    statuses: path.join(outputDir, "deck-threads-statuses.png"),
    sources: path.join(outputDir, "deck-threads-sources.png"),
    appearance: path.join(outputDir, "deck-threads-appearance.png"),
    labels: path.join(outputDir, "deck-threads-key-labels.png"),
    compact: path.join(outputDir, "deck-threads-compact.png"),
  };
  const application = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      DECK_THREADS_BRIDGE_PORT: String(bridgePort),
      DECK_THREADS_USER_DATA_DIR: userDataDir,
    },
  });

  try {
    const page = await application.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await page.getByRole("heading", { name: "Eight live task keys" }).waitFor();
    await page.waitForFunction(() => /Working|Question|Unread|Read/.test(document.querySelector(".task-key")?.getAttribute("aria-label") || ""));

    const healthResponse = await fetch(`http://127.0.0.1:${bridgePort}/v1/health`);
    assert.equal(healthResponse.ok, true);
    const threadResponse = await fetch(`http://127.0.0.1:${bridgePort}/v1/threads`);
    assert.equal(threadResponse.ok, true);
    const threadPayload = await threadResponse.json();
    assert.equal(threadPayload.tasks.length, 8);
    assert.ok(threadPayload.tasks.filter(Boolean).every((task) => task.sourceId === "codex" || task.sourceId === "claude"));
    assert.equal(threadPayload.displaySettings.statusAppearance.codex.working.animation, "sweep");
    assert.equal(threadPayload.displaySettings.statusAppearance.claude.question.backgroundColor, "#57321F");
    assert.deepEqual(threadPayload.displaySettings.typography.codex, { slotHandleFontSize: 17, threadNameFontSize: 12 });

    const title = await page.title();
    const taskSlots = page.locator(".task-key");
    const taskCount = await taskSlots.count();
    const firstTaskLabel = await taskSlots.first().getAttribute("aria-label");
    const source = (await page.locator(".summary-strip p").textContent())?.trim();

    assert.equal(title, "Deck Threads");
    assert.equal(taskCount, 8);
    assert.match(firstTaskLabel || "", /Working|Question|Unread|Read/);
    assert.equal(await page.locator(".sidebar nav .nav-item").count(), 6);
    assert.equal(await page.locator(".source-badge").count(), 0);
    assert.ok(await page.locator(".task-key.task-source-codex").count() > 0);
    assert.ok(await page.locator(".task-key.task-source-claude").count() > 0);

    const invalidOpen = await page.evaluate(() => window.bridgeApi.openTask("claude", "not-a-thread-id", "Invalid task"));
    assert.equal(invalidOpen.ok, false);
    assert.match(invalidOpen.message, /invalid task ID/i);

    await page.getByRole("button", { name: "Refresh" }).click();
    await page.waitForFunction(() => !document.querySelector(".button-secondary")?.hasAttribute("disabled"));

    const wideLayout = await layoutMetrics(page);
    assert.ok(wideLayout.bodyScrollWidth <= wideLayout.bodyClientWidth, `Wide layout overflow: ${JSON.stringify(wideLayout)}`);
    assert.ok(wideLayout.documentScrollWidth <= wideLayout.documentClientWidth, `Wide document overflow: ${JSON.stringify(wideLayout)}`);
    await captureWindow(application, screenshots.wide);

    await page.evaluate(() => {
      const states = [
        ["working", "Working", "#4169FF", "#FFFFFF"],
        ["question", "Question", "#FF6D00", "#FFFFFF"],
        ["unread", "Unread", "#2ED47A", "#FFFFFF"],
        ["read", "Read", "#D9DEE8", "#111722"],
        ["waiting", "Waiting", "#F5A742", "#111722"],
        ["error", "Error", "#FF5C70", "#FFFFFF"],
      ];
      const buttons = Array.from(document.querySelectorAll(".task-key")).slice(0, states.length);
      buttons.forEach((button, index) => {
        const [state, label, color, foreground] = states[index];
        button.classList.remove("task-working", "task-question", "task-unread", "task-read", "task-waiting", "task-error", "task-off");
        button.classList.remove("task-source-codex", "task-source-claude");
        button.classList.remove("motion-still", "motion-breathe", "motion-sweep", "motion-pulse");
        button.classList.add(`task-${state}`);
        button.classList.add(index < 3 ? "task-source-codex" : "task-source-claude");
        button.classList.add(index % 2 ? "motion-pulse" : "motion-sweep");
        button.style.setProperty("--task-color", color);
        button.style.setProperty("--task-background", color);
        button.style.setProperty("--task-foreground", foreground);
        const statusLine = button.querySelector("small");
        if (statusLine) statusLine.textContent = label;
      });
    });
    await page.waitForTimeout(220);
    const statusBorders = await page.locator(".task-key").evaluateAll((buttons) =>
      buttons.slice(0, 6).map((button) => getComputedStyle(button).borderTopColor),
    );
    assert.deepEqual(statusBorders, [
      "rgb(102, 130, 255)",
      "rgb(102, 130, 255)",
      "rgb(102, 130, 255)",
      "rgb(225, 132, 82)",
      "rgb(225, 132, 82)",
      "rgb(225, 132, 82)",
    ]);
    const statusSurfaces = await page.locator(".task-key").evaluateAll((buttons) =>
      buttons.slice(0, 6).map((button) => getComputedStyle(button).getPropertyValue("--task-background").trim()),
    );
    assert.deepEqual(statusSurfaces, ["#4169FF", "#FF6D00", "#2ED47A", "#D9DEE8", "#F5A742", "#FF5C70"]);
    assert.equal(await page.locator(".task-key").nth(3).evaluate((button) => getComputedStyle(button).color), "rgb(17, 23, 34)");
    await captureWindow(application, screenshots.statuses);
    await page.reload();
    await page.getByRole("heading", { name: "Eight live task keys" }).waitFor();

    await page.getByRole("button", { name: "Sources" }).click();
    await page.getByRole("heading", { name: "Reserved keys" }).waitFor();
    const adaptiveToggle = page.getByRole("checkbox", { name: "Fill unused keys with active tasks" });
    const adaptiveControl = page.locator(".source-toggle");
    assert.equal(await adaptiveToggle.isChecked(), true);
    await page.getByRole("button", { name: "Reserve 6 keys for Codex and 2 for Claude" }).click();
    await page.waitForTimeout(350);
    const allocationPath = path.join(userDataDir, "source-allocation.json");
    const persistedAllocation = JSON.parse(fs.readFileSync(allocationPath, "utf8"));
    assert.deepEqual(persistedAllocation.reservations, { codex: 6, claude: 2 });
    assert.equal(persistedAllocation.fillUnused, true);
    await adaptiveControl.click();
    await page.waitForTimeout(200);
    assert.equal(JSON.parse(fs.readFileSync(allocationPath, "utf8")).fillUnused, false);
    await adaptiveControl.click();
    await page.waitForTimeout(350);
    assert.equal(JSON.parse(fs.readFileSync(allocationPath, "utf8")).fillUnused, true);
    assert.equal(await adaptiveToggle.isChecked(), true);
    await captureWindow(application, screenshots.sources);

    await page.getByRole("button", { name: "Connections" }).click();
    await page.getByRole("heading", { name: "Connection status" }).waitFor();
    assert.equal(await page.locator(".task-grid").count(), 0);
    const streamDeckStatus = (await page.locator(".health-item").filter({ hasText: "Stream Deck" }).textContent())?.replace(/\s+/g, " ").trim();
    assert.match(streamDeckStatus || "", /Online|Offline|Error/);
    const claudeStatus = (await page.locator(".health-item").filter({ hasText: "Claude" }).textContent())?.replace(/\s+/g, " ").trim();
    assert.match(claudeStatus || "", /Online|Offline|Error/);

    await page.getByRole("button", { name: "Appearance" }).click();
    await page.getByRole("heading", { name: "Status backgrounds and motion" }).waitFor();
    assert.equal(await page.locator(".appearance-card").count(), 6);
    assert.equal(await page.locator(".animation-options button").count(), 24);
    assert.equal(await page.locator(".font-size-control").count(), 2);
    const codexHandleSize = page.getByLabel("Slot handle font size for Codex");
    const codexThreadSize = page.getByLabel("Thread name font size for Codex");
    await codexHandleSize.fill("24");
    await codexThreadSize.fill("16");
    const codexWorkingColor = page.getByLabel("Background color for Codex Working");
    await codexWorkingColor.fill("#123456");
    await page.getByRole("button", { name: "Use Pulse animation for Codex Working" }).click();
    await page.waitForTimeout(220);
    const appearanceSettingsPath = path.join(userDataDir, "display-settings.json");
    let persistedAppearance = JSON.parse(fs.readFileSync(appearanceSettingsPath, "utf8"));
    assert.equal(persistedAppearance.version, 3);
    assert.equal(persistedAppearance.statusAppearance.codex.working.backgroundColor, "#123456");
    assert.equal(persistedAppearance.statusAppearance.codex.working.animation, "pulse");
    assert.deepEqual(persistedAppearance.typography.codex, { slotHandleFontSize: 24, threadNameFontSize: 16 });
    assert.equal(await page.locator(".typography-preview-handle").evaluate((element) => getComputedStyle(element).fontSize), "24px");
    assert.equal(await page.locator(".typography-preview strong").evaluate((element) => getComputedStyle(element).fontSize), "16px");
    await page.getByRole("button", { name: /Claude/ }).click();
    await page.getByLabel("Slot handle font size for Claude").fill("14");
    await page.getByLabel("Thread name font size for Claude").fill("10");
    await page.getByRole("button", { name: "Use Sweep animation for Claude Question" }).click();
    await page.waitForTimeout(220);
    persistedAppearance = JSON.parse(fs.readFileSync(appearanceSettingsPath, "utf8"));
    assert.equal(persistedAppearance.statusAppearance.claude.question.animation, "sweep");
    assert.equal(persistedAppearance.statusAppearance.claude.working.backgroundColor, "#24375F");
    assert.deepEqual(persistedAppearance.typography.claude, { slotHandleFontSize: 14, threadNameFontSize: 10 });
    assert.deepEqual(persistedAppearance.typography.codex, { slotHandleFontSize: 24, threadNameFontSize: 16 });
    const updatedThreadResponse = await fetch(`http://127.0.0.1:${bridgePort}/v1/threads`);
    const updatedThreadPayload = await updatedThreadResponse.json();
    assert.equal(updatedThreadPayload.displaySettings.statusAppearance.codex.working.backgroundColor, "#123456");
    assert.equal(updatedThreadPayload.displaySettings.statusAppearance.claude.question.animation, "sweep");
    assert.deepEqual(updatedThreadPayload.displaySettings.typography.codex, { slotHandleFontSize: 24, threadNameFontSize: 16 });
    assert.deepEqual(updatedThreadPayload.displaySettings.typography.claude, { slotHandleFontSize: 14, threadNameFontSize: 10 });
    await page.getByRole("button", { name: /Codex/ }).click();
    await page.waitForTimeout(100);
    assert.equal(await page.locator(".source-tab-codex").getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator(".source-tab-claude").getAttribute("aria-pressed"), "false");
    await captureWindow(application, screenshots.appearance);

    await page.getByRole("button", { name: "Threads" }).click();
    await page.getByRole("heading", { name: "Eight live task keys" }).waitFor();
    const codexTask = page.locator(".task-key.task-source-codex").first();
    assert.equal(await codexTask.locator(".task-number").evaluate((element) => getComputedStyle(element).fontSize), "24px");
    assert.equal(await codexTask.locator("strong").evaluate((element) => getComputedStyle(element).fontSize), "16px");

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
    await captureWindow(application, screenshots.labels);

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
    await captureWindow(application, screenshots.compact);

    process.stdout.write(`${JSON.stringify({
      title,
      source,
      firstTaskLabel,
      streamDeckStatus,
      claudeStatus,
      questionTitleEnabled: await questionToggle.isChecked(),
      sourceAllocation: persistedAllocation,
      appearance: persistedAppearance.statusAppearance,
      typography: persistedAppearance.typography,
      wideLayout,
      compactLayout,
      screenshots: Object.values(screenshots),
    }, null, 2)}\n`);
  } finally {
    await application.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
})().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
