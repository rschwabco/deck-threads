const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  comparePluginVersions,
  installBundledStreamDeckPlugin,
  parsePluginVersion,
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

    writePlugin(source, "1.0.1.0", "current");

    const optedOut = await installBundledStreamDeckPlugin(source, destination);
    assert.equal(optedOut.status, "not-installed");
    assert.equal(fs.existsSync(destination), false);

    const installed = await installBundledStreamDeckPlugin(source, destination, { installIfMissing: true });
    assert.equal(installed.status, "installed");
    assert.equal(fs.readFileSync(path.join(destination, "plugin.js"), "utf8"), "current");

    const unchanged = await installBundledStreamDeckPlugin(source, destination);
    assert.equal(unchanged.status, "up-to-date");

    writePlugin(source, "1.0.1.1", "updated");
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
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  console.log("Bundled Stream Deck plugin installation verified.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
