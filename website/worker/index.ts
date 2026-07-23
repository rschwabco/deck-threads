/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  draft: boolean;
  published_at: string | null;
  assets: GitHubReleaseAsset[];
}

const RELEASES_API = "https://api.github.com/repos/rschwabco/deck-threads/releases?per_page=20";
const RELEASE_DOWNLOAD_PREFIX = "https://github.com/rschwabco/deck-threads/releases/download/";
const DOWNLOAD_ASSETS = {
  "/download/installer": "Deck-Threads-Installer.pkg",
  "/download/companion": "Deck-Threads-Companion.pkg",
} as const;

function errorResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function latestReleaseAssets() {
  const response = await fetch(RELEASES_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "deck-threads-website",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) throw new Error(`GitHub Releases returned ${response.status}`);
  const releases = await response.json() as GitHubRelease[];
  const completeRelease = releases
    .filter((release) => !release.draft && release.published_at)
    .sort((left, right) => Date.parse(right.published_at!) - Date.parse(left.published_at!))
    .find((release) => {
      const names = new Set(release.assets.map((asset) => asset.name));
      return Object.values(DOWNLOAD_ASSETS).every((name) => names.has(name));
    });

  if (!completeRelease) throw new Error("No complete published Deck Threads release was found");
  return new Map(completeRelease.assets.map((asset) => [asset.name, asset.browser_download_url]));
}

async function handleDownload(request: Request, assetName: string, ctx: ExecutionContext) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const cacheStorage = (globalThis as typeof globalThis & { caches?: CacheStorage & { default?: Cache } }).caches;
  const edgeCache = cacheStorage?.default;
  const requestUrl = new URL(request.url);
  const cacheKey = new Request(`${requestUrl.origin}${requestUrl.pathname}`);
  let cached: Response | undefined;
  let edgeCacheAvailable = Boolean(edgeCache);
  try {
    cached = await edgeCache?.match(cacheKey);
  } catch {
    // The Sites runtime can expose CacheStorage before its default cache is
    // available. A cache miss must never prevent a fresh release lookup.
    edgeCacheAvailable = false;
  }
  if (cached) return cached;

  try {
    const assets = await latestReleaseAssets();
    const downloadUrl = assets.get(assetName);
    if (!downloadUrl || !downloadUrl.startsWith(RELEASE_DOWNLOAD_PREFIX)) {
      return errorResponse("The latest Deck Threads download is temporarily unavailable.", 503);
    }

    const redirect = new Response(null, {
      status: 302,
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        Location: downloadUrl,
        "X-Content-Type-Options": "nosniff",
      },
    });
    if (edgeCache && edgeCacheAvailable) {
      ctx.waitUntil(edgeCache.put(cacheKey, redirect.clone()).catch(() => undefined));
    }
    return redirect;
  } catch {
    return errorResponse("The latest Deck Threads download is temporarily unavailable.", 503);
  }
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const downloadAsset = DOWNLOAD_ASSETS[url.pathname as keyof typeof DOWNLOAD_ASSETS];
    if (downloadAsset) return handleDownload(request, downloadAsset, ctx);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
