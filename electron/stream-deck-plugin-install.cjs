const fs = require("node:fs");
const path = require("node:path");

function readPluginVersion(pluginRoot, fileSystem = fs) {
  try {
    const manifest = JSON.parse(fileSystem.readFileSync(path.join(pluginRoot, "manifest.json"), "utf8"));
    return typeof manifest.Version === "string" ? manifest.Version : null;
  } catch {
    return null;
  }
}

function parsePluginVersion(value) {
  if (typeof value !== "string" || !/^\d+\.\d+\.\d+\.\d+$/.test(value)) return null;
  const parts = value.split(".").map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

function comparePluginVersions(left, right) {
  const leftParts = parsePluginVersion(left);
  const rightParts = parsePluginVersion(right);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] > rightParts[index] ? 1 : -1;
  }
  return 0;
}

async function installBundledStreamDeckPlugin(source, destination, options = {}) {
  const fileSystem = options.fileSystem || fs;
  const installIfMissing = options.installIfMissing === true;
  if (!fileSystem.existsSync(source)) return { status: "not-bundled", version: null };

  const sourceVersion = readPluginVersion(source, fileSystem);
  if (!parsePluginVersion(sourceVersion)) {
    return { status: "invalid-bundled-version", version: sourceVersion };
  }

  const destinationExists = fileSystem.existsSync(destination);
  if (!destinationExists && !installIfMissing) {
    return { status: "not-installed", version: sourceVersion };
  }

  const destinationVersion = readPluginVersion(destination, fileSystem);
  const comparison = comparePluginVersions(sourceVersion, destinationVersion);
  if (comparison === 0) {
    return { status: "up-to-date", version: sourceVersion };
  }
  if (comparison === -1) {
    return { status: "newer-installed", version: destinationVersion, bundledVersion: sourceVersion };
  }

  const pluginsRoot = path.dirname(destination);
  const staging = path.join(pluginsRoot, `.${path.basename(destination)}.installing-${process.pid}`);
  const backup = path.join(pluginsRoot, `.${path.basename(destination)}.backup-${process.pid}`);
  let backedUp = false;

  await fileSystem.promises.mkdir(pluginsRoot, { recursive: true });
  await fileSystem.promises.rm(staging, { recursive: true, force: true });
  await fileSystem.promises.rm(backup, { recursive: true, force: true });
  await fileSystem.promises.cp(source, staging, { recursive: true });
  try {
    if (destinationExists) {
      await fileSystem.promises.rename(destination, backup);
      backedUp = true;
    }
    await fileSystem.promises.rename(staging, destination);
    if (backedUp) await fileSystem.promises.rm(backup, { recursive: true, force: true });
    return { status: destinationExists ? "updated" : "installed", version: sourceVersion };
  } catch (error) {
    await fileSystem.promises.rm(staging, { recursive: true, force: true }).catch(() => undefined);
    if (backedUp && !fileSystem.existsSync(destination) && fileSystem.existsSync(backup)) {
      await fileSystem.promises.rename(backup, destination).catch(() => undefined);
    }
    throw error;
  }
}

module.exports = {
  comparePluginVersions,
  installBundledStreamDeckPlugin,
  parsePluginVersion,
  readPluginVersion,
};
