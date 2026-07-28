export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

export interface GitHubRelease {
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  tag_name: string;
  assets: GitHubReleaseAsset[];
}

export type ReleaseChannel = "stable" | "beta";

export const RELEASE_DOWNLOAD_PREFIX = "https://github.com/rschwabco/deck-threads/releases/download/";
export const PLUGIN_DOWNLOAD_ASSET = "com.roie.deck-threads.streamDeckPlugin";
export const REQUIRED_DOWNLOAD_ASSETS = ["Deck-Threads-Installer.pkg", "Deck-Threads-Companion.pkg", PLUGIN_DOWNLOAD_ASSET] as const;
export const STABLE_CHECKSUM_ASSET = "SHA256SUMS.txt";

const SEMVER_PATTERN = /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;

function validChannelTag(tagName: string, channel: ReleaseChannel) {
  const match = SEMVER_PATTERN.exec(tagName);
  if (!match) return false;
  const hasPrerelease = Boolean(match[4]);
  return channel === "stable" ? !hasPrerelease : hasPrerelease;
}

function assetMatchesReleaseTag(asset: GitHubReleaseAsset, tagName: string) {
  try {
    const url = new URL(asset.browser_download_url);
    return url.origin === "https://github.com"
      && decodeURIComponent(url.pathname) === `/rschwabco/deck-threads/releases/download/${tagName}/${asset.name}`;
  } catch {
    return false;
  }
}

export function selectCompleteRelease(releases: GitHubRelease[], channel: ReleaseChannel) {
  return releases
    .filter((release) => !release.draft && release.published_at)
    .filter((release) => channel === "stable" ? !release.prerelease : release.prerelease)
    .filter((release) => validChannelTag(release.tag_name, channel))
    .sort((left, right) => Date.parse(right.published_at!) - Date.parse(left.published_at!))
    .find((release) => {
      const requiredNames = channel === "stable"
        ? [...REQUIRED_DOWNLOAD_ASSETS, STABLE_CHECKSUM_ASSET]
        : [...REQUIRED_DOWNLOAD_ASSETS];
      const assetsByName = new Map(release.assets.map((asset) => [asset.name, asset]));
      return requiredNames.every((name) => {
        const asset = assetsByName.get(name);
        return Boolean(asset && assetMatchesReleaseTag(asset, release.tag_name));
      });
    });
}
