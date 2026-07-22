const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { installBundledStreamDeckPlugin } = require("../electron/stream-deck-plugin-install.cjs");

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "deck-threads-plugin-test-"));
  const source = path.join(root, "source", "com.roie.deck-threads.sdPlugin");
  const destination = path.join(root, "plugins", "com.roie.deck-threads.sdPlugin");
  try {
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(source, "manifest.json"), JSON.stringify({ Version: "1.0.0" }));
    fs.writeFileSync(path.join(source, "plugin.js"), "current");

    const installed = await installBundledStreamDeckPlugin(source, destination);
    assert.equal(installed.status, "installed");
    assert.equal(fs.readFileSync(path.join(destination, "plugin.js"), "utf8"), "current");

    const unchanged = await installBundledStreamDeckPlugin(source, destination);
    assert.equal(unchanged.status, "up-to-date");

    fs.writeFileSync(path.join(source, "manifest.json"), JSON.stringify({ Version: "1.1.0" }));
    fs.writeFileSync(path.join(source, "plugin.js"), "updated");
    const updated = await installBundledStreamDeckPlugin(source, destination);
    assert.equal(updated.status, "installed");
    assert.equal(updated.version, "1.1.0");
    assert.equal(fs.readFileSync(path.join(destination, "plugin.js"), "utf8"), "updated");

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
