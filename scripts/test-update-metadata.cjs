const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { verifyUpdateMetadata } = require("./verify-update-metadata.cjs");

function main() {
  const projectRoot = path.join(__dirname, "..");
  const version = require(path.join(projectRoot, "package.json")).version;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "deck-threads-update-metadata-"));
  try {
    const appResources = path.join(root, "mac-universal", "Deck Threads.app", "Contents", "Resources");
    const pluginRoot = path.join(appResources, "stream-deck-plugin", "com.roie.deck-threads.sdPlugin");
    fs.mkdirSync(pluginRoot, { recursive: true });
    fs.writeFileSync(path.join(pluginRoot, "manifest.json"), JSON.stringify({ Version: "1.0.1.0" }));
    fs.writeFileSync(path.join(appResources, "app-update.yml"), [
      "provider: github",
      "owner: rschwabco",
      "repo: deck-threads",
      "",
    ].join("\n"));

    const zipName = `Deck-Threads-${version}-universal.zip`;
    const zipPath = path.join(root, zipName);
    fs.writeFileSync(zipPath, "signed update fixture");
    fs.writeFileSync(`${zipPath}.blockmap`, "blockmap fixture");
    const hash = crypto.createHash("sha512").update("signed update fixture").digest("base64");
    fs.writeFileSync(path.join(root, "latest-mac.yml"), [
      `version: ${version}`,
      "files:",
      `  - url: ${zipName}`,
      `    sha512: ${hash}`,
      `path: ${zipName}`,
      `sha512: ${hash}`,
      "",
    ].join("\n"));

    const verified = verifyUpdateMetadata(root, projectRoot);
    assert.equal(verified.version, version);
    assert.equal(verified.bundledPluginVersion, "1.0.1.0");

    fs.appendFileSync(zipPath, "tampered");
    assert.throws(() => verifyUpdateMetadata(root, projectRoot), /SHA-512/);
    console.log("Release updater metadata verification checks passed.");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
