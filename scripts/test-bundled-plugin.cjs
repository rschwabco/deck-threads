const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  clearPluginRepairRequest,
  comparePluginVersions,
  hasPluginRepairRequest,
  inspectStreamDeckPlugin,
  installBundledStreamDeckPlugin,
  parsePluginVersion,
  readPluginInstallPolicy,
  reloadStreamDeckPlugin,
  requestPluginRepair,
  shouldInstallMissingStreamDeckPlugin,
} = require("../electron/stream-deck-plugin-install.cjs");
const { assertPluginVersionChange } = require("./verify-plugin-version.cjs");

function writePlugin(pluginRoot, version, contents) {
  fs.mkdirSync(pluginRoot, { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, "manifest.json"), JSON.stringify({ Version: version }));
  fs.writeFileSync(path.join(pluginRoot, "plugin.js"), contents);
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "deck-threads-plugin-test-"));
  const source = path.join(root, "source", "com.roie.deck-threads.sdPlugin");
  const destination = path.join(root, "plugins", "com.roie.deck-threads.sdPlugin");
  try {
    const mainSource = fs.readFileSync(path.join(__dirname, "..", "electron", "main.cjs"), "utf8");
    assert.equal(mainSource.includes('execFileAsync("/usr/bin/pkill", ["-x", "Stream Deck"])'), false);
    assert.equal(mainSource.includes("reloadStreamDeckPlugin(execFileAsync)"), true);
    assert.equal(mainSource.includes("requestPluginRepair(pluginRepairRequestPath(), app.getVersion())"), true);
    assert.equal(mainSource.includes("shouldInstallMissingPluginAtStartup()"), true);

    assert.deepEqual(parsePluginVersion("1.2.3.4"), [1, 2, 3, 4]);
    assert.equal(parsePluginVersion("1.2.3-beta.1"), null);
    assert.equal(comparePluginVersions("1.0.1.0", "1.0.0.9"), 1);
    assert.equal(comparePluginVersions("1.0.1.0", "1.0.1.0"), 0);
    assert.equal(comparePluginVersions("1.0.0.9", "1.0.1.0"), -1);
    assert.doesNotThrow(() => assertPluginVersionChange({
      currentVersion: "1.0.1.1",
      nonVersionPayloadChanged: true,
      previousVersion: "1.0.1.0",
      reference: "v1.0.1",
    }));
    assert.throws(() => assertPluginVersionChange({
      currentVersion: "1.0.1.0",
      nonVersionPayloadChanged: true,
      previousVersion: "1.0.1.0",
      reference: "v1.0.1",
    }), /payload changed/);
    assert.throws(() => assertPluginVersionChange({
      currentVersion: "1.0.0.9",
      nonVersionPayloadChanged: false,
      previousVersion: "1.0.1.0",
      reference: "v1.0.1",
    }), /cannot decrease/);

    const reloadCalls = [];
    await reloadStreamDeckPlugin(async (...args) => {
      reloadCalls.push(args);
    });
    assert.deepEqual(reloadCalls, [[
      "/usr/bin/open",
      ["streamdeck://plugins/restart/com.roie.deck-threads"],
      { timeout: 3000 },
    ]]);

    writePlugin(source, "1.0.1.0", "current");

    assert.deepEqual(inspectStreamDeckPlugin(source, destination), {
      bundledAvailable: true,
      bundledVersion: "1.0.1.0",
      installed: false,
      installedVersion: null,
      updateAvailable: false,
    });

    const optedOut = await installBundledStreamDeckPlugin(source, destination);
    assert.equal(optedOut.status, "not-installed");
    assert.equal(fs.existsSync(destination), false);

    const installed = await installBundledStreamDeckPlugin(source, destination, { installIfMissing: true });
    assert.equal(installed.status, "installed");
    assert.equal(fs.readFileSync(path.join(destination, "plugin.js"), "utf8"), "current");

    assert.deepEqual(inspectStreamDeckPlugin(source, destination), {
      bundledAvailable: true,
      bundledVersion: "1.0.1.0",
      installed: true,
      installedVersion: "1.0.1.0",
      updateAvailable: false,
    });

    const unchanged = await installBundledStreamDeckPlugin(source, destination);
    assert.equal(unchanged.status, "up-to-date");

    writePlugin(source, "1.0.1.1", "updated");
    assert.equal(inspectStreamDeckPlugin(source, destination).updateAvailable, true);
    const updated = await installBundledStreamDeckPlugin(source, destination);
    assert.equal(updated.status, "updated");
    assert.equal(updated.version, "1.0.1.1");
    assert.equal(fs.readFileSync(path.join(destination, "plugin.js"), "utf8"), "updated");

    writePlugin(source, "1.0.1.0", "older");
    const newerInstalled = await installBundledStreamDeckPlugin(source, destination);
    assert.equal(newerInstalled.status, "newer-installed");
    assert.equal(newerInstalled.version, "1.0.1.1");
    assert.equal(fs.readFileSync(path.join(destination, "plugin.js"), "utf8"), "updated");

    writePlugin(source, "invalid", "invalid");
    const invalid = await installBundledStreamDeckPlugin(source, destination);
    assert.equal(invalid.status, "invalid-bundled-version");
    assert.equal(fs.readFileSync(path.join(destination, "plugin.js"), "utf8"), "updated");

    writePlugin(source, "1.0.1.2", "rollback-candidate");
    const realRename = fs.promises.rename.bind(fs.promises);
    const failingFileSystem = {
      ...fs,
      promises: {
        ...fs.promises,
        rename: async (from, to) => {
          if (from.includes(".installing-") && to === destination) throw new Error("simulated swap failure");
          return realRename(from, to);
        },
      },
    };
    await assert.rejects(
      installBundledStreamDeckPlugin(source, destination, { fileSystem: failingFileSystem }),
      /simulated swap failure/,
    );
    assert.equal(fs.readFileSync(path.join(destination, "plugin.js"), "utf8"), "updated");
    assert.equal(fs.existsSync(path.join(destination, "manifest.json")), true);

    const missing = await installBundledStreamDeckPlugin(path.join(root, "missing"), destination);
    assert.equal(missing.status, "not-bundled");

    const repairMarker = path.join(root, "state", "install-plugin-after-update.json");
    assert.equal(hasPluginRepairRequest(repairMarker), false);
    requestPluginRepair(repairMarker, "1.0.2-beta.2");
    assert.equal(hasPluginRepairRequest(repairMarker), true);
    assert.equal(JSON.parse(fs.readFileSync(repairMarker, "utf8")).requestedByVersion, "1.0.2-beta.2");
    clearPluginRepairRequest(repairMarker);
    assert.equal(hasPluginRepairRequest(repairMarker), false);

    const policyPath = path.join(root, "state", "plugin-install-policy.json");
    assert.equal(readPluginInstallPolicy(policyPath), null);
    fs.writeFileSync(policyPath, JSON.stringify({ policy: "companion-only" }));
    assert.equal(readPluginInstallPolicy(policyPath), "companion-only");
    fs.writeFileSync(policyPath, JSON.stringify({ policy: "complete" }));
    assert.equal(readPluginInstallPolicy(policyPath), "complete");
    fs.writeFileSync(policyPath, JSON.stringify({ policy: "unexpected" }));
    assert.equal(readPluginInstallPolicy(policyPath), null);
    assert.equal(shouldInstallMissingStreamDeckPlugin({ packaged: true }), true);
    assert.equal(shouldInstallMissingStreamDeckPlugin({ packaged: true, installPolicy: "companion-only" }), false);
    assert.equal(shouldInstallMissingStreamDeckPlugin({ packaged: true, installPolicy: "complete" }), true);
    assert.equal(shouldInstallMissingStreamDeckPlugin({ packaged: false, repairPending: true }), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  console.log("Bundled Stream Deck plugin installation verified.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
