const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { comparePluginVersions, parsePluginVersion } = require("../electron/stream-deck-plugin-install.cjs");

const projectRoot = path.join(__dirname, "..");
const manifestPath = "stream-deck/com.roie.deck-threads.sdPlugin/manifest.json";
const packagePath = "stream-deck/package.json";
const packageLockPath = "stream-deck/package-lock.json";

function git(args) {
  return execFileSync("git", args, { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function readJsonAtRef(reference, filePath) {
  return JSON.parse(git(["show", `${reference}:${filePath}`]));
}

function normalizeVersionOnlyFields(filePath, value) {
  const copy = structuredClone(value);
  if (filePath === manifestPath) delete copy.Version;
  if (filePath === packagePath) delete copy.version;
  if (filePath === packageLockPath) {
    delete copy.version;
    if (copy.packages?.[""]) delete copy.packages[""].version;
  }
  return copy;
}

function jsonMateriallyChanged(reference, filePath) {
  const previous = normalizeVersionOnlyFields(filePath, readJsonAtRef(reference, filePath));
  const current = normalizeVersionOnlyFields(filePath, JSON.parse(fs.readFileSync(path.join(projectRoot, filePath), "utf8")));
  return JSON.stringify(previous) !== JSON.stringify(current);
}

function findPreviousRelease() {
  if (process.env.DECK_THREADS_PREVIOUS_RELEASE) return process.env.DECK_THREADS_PREVIOUS_RELEASE;
  try {
    const currentTags = new Set(git(["tag", "--points-at", "HEAD", "--list", "v*"]).split("\n").filter(Boolean));
    return git(["tag", "--list", "v*", "--sort=-version:refname"])
      .split("\n")
      .find((tag) => tag && !currentTags.has(tag)) || null;
  } catch {
    return null;
  }
}

function assertPluginVersionChange({ currentVersion, nonVersionPayloadChanged, previousVersion, reference }) {
  if (!parsePluginVersion(currentVersion) || !parsePluginVersion(previousVersion)) {
    throw new Error(`Plugin versions must contain four numeric components: ${previousVersion} -> ${currentVersion}`);
  }
  if (nonVersionPayloadChanged && comparePluginVersions(currentVersion, previousVersion) !== 1) {
    throw new Error(`Stream Deck plugin payload changed after ${reference}, but manifest version ${currentVersion} is not higher than ${previousVersion}.`);
  }
  if (comparePluginVersions(currentVersion, previousVersion) === -1) {
    throw new Error(`Stream Deck plugin version cannot decrease: ${previousVersion} -> ${currentVersion}.`);
  }
}

function verifyPluginVersion(reference) {
  if (!reference) return { status: "no-previous-release" };
  const changedFiles = git(["diff", "--name-only", reference, "--", "stream-deck"])
    .split("\n")
    .filter(Boolean);
  const jsonFiles = new Set([manifestPath, packagePath, packageLockPath]);
  const nonVersionPayloadChanged = changedFiles.some((filePath) => !jsonFiles.has(filePath))
    || [...jsonFiles].some((filePath) => changedFiles.includes(filePath) && jsonMateriallyChanged(reference, filePath));

  const currentVersion = JSON.parse(fs.readFileSync(path.join(projectRoot, manifestPath), "utf8")).Version;
  const previousVersion = readJsonAtRef(reference, manifestPath).Version;
  assertPluginVersionChange({ currentVersion, nonVersionPayloadChanged, previousVersion, reference });
  return { status: "verified", currentVersion, nonVersionPayloadChanged, previousVersion, reference };
}

if (require.main === module) {
  try {
    const result = verifyPluginVersion(findPreviousRelease());
    if (result.status === "no-previous-release") {
      console.log("No previous release tag was available; plugin version comparison skipped.");
    } else {
      console.log(`Stream Deck plugin version verified against ${result.reference}: ${result.previousVersion} -> ${result.currentVersion}.`);
    }
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}

module.exports = {
  assertPluginVersionChange,
  findPreviousRelease,
  normalizeVersionOnlyFields,
  verifyPluginVersion,
};
