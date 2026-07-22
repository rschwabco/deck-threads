const fs = require("node:fs");
const path = require("node:path");

function readPluginVersion(pluginRoot) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, "manifest.json"), "utf8"));
    return typeof manifest.Version === "string" ? manifest.Version : null;
  } catch {
    return null;
  }
}

async function installBundledStreamDeckPlugin(source, destination) {
  if (!fs.existsSync(source)) return { status: "not-bundled", version: null };

  const sourceVersion = readPluginVersion(source);
  const destinationVersion = readPluginVersion(destination);
  if (sourceVersion && sourceVersion === destinationVersion) {
    return { status: "up-to-date", version: sourceVersion };
  }

  const pluginsRoot = path.dirname(destination);
  const staging = path.join(pluginsRoot, `.${path.basename(destination)}.installing-${process.pid}`);
  await fs.promises.mkdir(pluginsRoot, { recursive: true });
  await fs.promises.rm(staging, { recursive: true, force: true });
  await fs.promises.cp(source, staging, { recursive: true });
  await fs.promises.rm(destination, { recursive: true, force: true });
  await fs.promises.rename(staging, destination);
  return { status: "installed", version: sourceVersion };
}

module.exports = {
  installBundledStreamDeckPlugin,
  readPluginVersion,
};
