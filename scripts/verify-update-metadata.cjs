const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function readScalar(source, key) {
  const match = source.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m"));
  if (!match) return null;
  return match[1].replace(/^['"]|['"]$/g, "");
}

function sha512Base64(filePath) {
  const hash = crypto.createHash("sha512");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("base64");
}

function findApp(root) {
  const pending = [root];
  while (pending.length) {
    const current = pending.shift();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory() && entry.name === "Deck Threads.app") return entryPath;
      if (entry.isDirectory()) pending.push(entryPath);
    }
  }
  return null;
}

function verifyUpdateMetadata(releaseRoot, projectRoot = path.join(__dirname, "..")) {
  const packageVersion = require(path.join(projectRoot, "package.json")).version;
  const metadataPath = path.join(releaseRoot, "latest-mac.yml");
  if (!fs.existsSync(metadataPath)) throw new Error(`Missing updater metadata: ${metadataPath}`);

  const metadata = fs.readFileSync(metadataPath, "utf8");
  const version = readScalar(metadata, "version");
  const zipName = readScalar(metadata, "path");
  const expectedHash = readScalar(metadata, "sha512");
  if (version !== packageVersion) {
    throw new Error(`Updater metadata version ${version || "missing"} does not match package version ${packageVersion}.`);
  }
  const expectedZipName = `Deck-Threads-${packageVersion}-universal.zip`;
  if (zipName !== expectedZipName) {
    throw new Error(`Updater metadata path must name the exact universal ZIP ${expectedZipName}; found ${zipName || "missing"}.`);
  }
  const zipPath = path.join(releaseRoot, zipName);
  if (!fs.existsSync(zipPath)) throw new Error(`Updater ZIP is missing: ${zipPath}`);
  const blockmapPath = `${zipPath}.blockmap`;
  if (!fs.existsSync(blockmapPath)) throw new Error(`Updater ZIP blockmap is missing: ${blockmapPath}`);
  const actualHash = sha512Base64(zipPath);
  if (!expectedHash || actualHash !== expectedHash) {
    throw new Error("Updater ZIP SHA-512 does not match latest-mac.yml.");
  }

  const appPath = findApp(releaseRoot);
  if (!appPath) throw new Error(`Deck Threads.app was not found under ${releaseRoot}.`);
  const appUpdatePath = path.join(appPath, "Contents", "Resources", "app-update.yml");
  if (!fs.existsSync(appUpdatePath)) throw new Error(`Embedded updater configuration is missing: ${appUpdatePath}`);
  const appUpdate = fs.readFileSync(appUpdatePath, "utf8");
  const provider = readScalar(appUpdate, "provider");
  const owner = readScalar(appUpdate, "owner");
  const repo = readScalar(appUpdate, "repo");
  if (provider !== "github" || owner !== "rschwabco" || repo !== "deck-threads") {
    throw new Error(`Unexpected updater provider: ${provider || "missing"}/${owner || "missing"}/${repo || "missing"}`);
  }

  const bundledPluginManifest = path.join(
    appPath,
    "Contents",
    "Resources",
    "stream-deck-plugin",
    "com.roie.deck-threads.sdPlugin",
    "manifest.json",
  );
  if (!fs.existsSync(bundledPluginManifest)) {
    throw new Error("The release app does not contain the bundled Stream Deck plugin.");
  }
  const bundledPluginVersion = JSON.parse(fs.readFileSync(bundledPluginManifest, "utf8")).Version;
  if (typeof bundledPluginVersion !== "string" || !/^\d+\.\d+\.\d+\.\d+$/.test(bundledPluginVersion)) {
    throw new Error(`Bundled Stream Deck plugin version is invalid: ${bundledPluginVersion || "missing"}`);
  }

  return { appPath, blockmapPath, bundledPluginVersion, metadataPath, zipPath, version };
}

if (require.main === module) {
  try {
    const projectRoot = path.join(__dirname, "..");
    const releaseRoot = path.resolve(process.argv[2] || path.join(projectRoot, "release-production"));
    const result = verifyUpdateMetadata(releaseRoot, projectRoot);
    console.log(`Updater metadata verified for Deck Threads ${result.version}.`);
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}

module.exports = {
  readScalar,
  sha512Base64,
  verifyUpdateMetadata,
};
