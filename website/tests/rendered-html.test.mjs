import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the complete Deck Threads landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();

  assert.match(html, /<title>Deck Threads — Agent tasks on Stream Deck<\/title>/i);
  assert.match(html, /Your tasks\./);
  assert.match(html, /Within reach\./);
  assert.match(html, /Download app \+ plugin \(\.pkg\)/);
  assert.match(html, /Companion app only \(\.pkg\)/);
  assert.match(html, /Stream Deck plugin only/);
  assert.match(html, /See what’s active\./);
  assert.match(html, /Press to jump back in\./);
  assert.match(html, /data-parallax-root/);
  assert.equal((html.match(/<div class="(?:hero-visual|app-frame|download-grid)"[^>]*data-scroll-parallax/g) ?? []).length, 3);
  assert.match(html, /class="hero-visual"[^>]*data-scroll-parallax/);
  assert.match(html, /class="app-frame"[^>]*data-scroll-parallax/);
  assert.match(html, /class="download-grid"[^>]*data-scroll-parallax/);
  assert.doesNotMatch(html, /class="(?:hero|product|download)-copy"[^>]*data-scroll-parallax/);
  assert.doesNotMatch(html, /data-parallax-copy/);
  assert.match(html, /Your task data stays on your Mac/);
  assert.match(html, /href="\/download\/installer"/);
  assert.match(html, /href="\/download\/companion"/);
  assert.match(html, /href="\/download\/plugin"/);
  assert.match(html, /Apple notarized/);
  assert.doesNotMatch(html, /releases\/download\/v|\.dmg|notarization pending/i);
  assert.doesNotMatch(html, /signal-strip|attention-section|state-stack|feature-grid|class="orbit/);
  assert.match(html, /property="og:image"/);
  assert.match(html, /https:\/\/deck-threads\.cognitive-dynamics\.io\/og\.png/);
  assert.doesNotMatch(html, /codex|openai|Your site is taking shape|react-loading-skeleton/i);
});

test("download routes keep stable and prerelease channels separate", async () => {
  const originalFetch = globalThis.fetch;
  const stableInstaller = "https://github.com/rschwabco/deck-threads/releases/download/v1.0.1/Deck-Threads-Installer.pkg";
  const stableCompanion = "https://github.com/rschwabco/deck-threads/releases/download/v1.0.1/Deck-Threads-Companion.pkg";
  const stablePlugin = "https://github.com/rschwabco/deck-threads/releases/download/v1.0.1/com.roie.deck-threads.streamDeckPlugin";
  const betaInstaller = "https://github.com/rschwabco/deck-threads/releases/download/v1.0.2-beta.1/Deck-Threads-Installer.pkg";
  const betaCompanion = "https://github.com/rschwabco/deck-threads/releases/download/v1.0.2-beta.1/Deck-Threads-Companion.pkg";
  const betaPlugin = "https://github.com/rschwabco/deck-threads/releases/download/v1.0.2-beta.1/com.roie.deck-threads.streamDeckPlugin";
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.github.com/repos/rschwabco/deck-threads/releases?per_page=20");
    assert.equal(init?.headers?.["User-Agent"], "deck-threads-website");
    return Response.json([
      {
        draft: true,
        prerelease: false,
        published_at: "2026-07-24T00:00:00Z",
        tag_name: "v1.0.3",
        assets: [
          { name: "Deck-Threads-Installer.pkg", browser_download_url: "https://github.com/rschwabco/deck-threads/releases/download/v1.0.3/Deck-Threads-Installer.pkg" },
          { name: "Deck-Threads-Companion.pkg", browser_download_url: "https://github.com/rschwabco/deck-threads/releases/download/v1.0.3/Deck-Threads-Companion.pkg" },
          { name: "com.roie.deck-threads.streamDeckPlugin", browser_download_url: "https://github.com/rschwabco/deck-threads/releases/download/v1.0.3/com.roie.deck-threads.streamDeckPlugin" },
          { name: "SHA256SUMS.txt", browser_download_url: "https://github.com/rschwabco/deck-threads/releases/download/v1.0.3/SHA256SUMS.txt" },
        ],
      },
      {
        draft: false,
        prerelease: false,
        published_at: "2026-07-23T12:00:00Z",
        tag_name: "v1.0.2",
        assets: [{ name: "Deck-Threads-Installer.pkg", browser_download_url: "https://example.com/incomplete" }],
      },
      {
        draft: false,
        prerelease: true,
        published_at: "2026-07-23T01:30:00Z",
        tag_name: "v1.0.2-beta.1",
        assets: [
          { name: "Deck-Threads-Installer.pkg", browser_download_url: betaInstaller },
          { name: "Deck-Threads-Companion.pkg", browser_download_url: betaCompanion },
          { name: "com.roie.deck-threads.streamDeckPlugin", browser_download_url: betaPlugin },
        ],
      },
      {
        draft: false,
        prerelease: false,
        published_at: "2026-07-23T01:26:41Z",
        tag_name: "v1.0.1",
        assets: [
          { name: "Deck-Threads-Installer.pkg", browser_download_url: stableInstaller },
          { name: "Deck-Threads-Companion.pkg", browser_download_url: stableCompanion },
          { name: "com.roie.deck-threads.streamDeckPlugin", browser_download_url: stablePlugin },
          { name: "SHA256SUMS.txt", browser_download_url: "https://github.com/rschwabco/deck-threads/releases/download/v1.0.1/SHA256SUMS.txt" },
        ],
      },
    ]);
  };

  try {
    const installer = await render("/download/installer");
    const companion = await render("/download/companion");
    const plugin = await render("/download/plugin");
    const beta = await render("/download/beta/installer");
    const betaPluginResponse = await render("/download/beta/plugin");
    assert.equal(installer.status, 302);
    assert.equal(installer.headers.get("location"), stableInstaller);
    assert.equal(companion.status, 302);
    assert.equal(companion.headers.get("location"), stableCompanion);
    assert.equal(plugin.status, 302);
    assert.equal(plugin.headers.get("location"), stablePlugin);
    assert.equal(beta.status, 302);
    assert.equal(beta.headers.get("location"), betaInstaller);
    assert.equal(betaPluginResponse.status, 302);
    assert.equal(betaPluginResponse.headers.get("location"), betaPlugin);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("download routes still resolve when the edge cache is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  const expectedInstaller = "https://github.com/rschwabco/deck-threads/releases/download/v1.0.1/Deck-Threads-Installer.pkg";
  globalThis.fetch = async () => Response.json([{
    draft: false,
    prerelease: false,
    published_at: "2026-07-23T01:26:41Z",
    tag_name: "v1.0.1",
    assets: [
      { name: "Deck-Threads-Installer.pkg", browser_download_url: expectedInstaller },
      { name: "Deck-Threads-Companion.pkg", browser_download_url: "https://github.com/rschwabco/deck-threads/releases/download/v1.0.1/Deck-Threads-Companion.pkg" },
      { name: "com.roie.deck-threads.streamDeckPlugin", browser_download_url: "https://github.com/rschwabco/deck-threads/releases/download/v1.0.1/com.roie.deck-threads.streamDeckPlugin" },
      { name: "SHA256SUMS.txt", browser_download_url: "https://github.com/rschwabco/deck-threads/releases/download/v1.0.1/SHA256SUMS.txt" },
    ],
  }]);
  globalThis.caches = {
    default: {
      async match() {
        throw new Error("cache is unavailable");
      },
    },
  };

  try {
    const response = await render("/download/installer");
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), expectedInstaller);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.caches = originalCaches;
  }
});

test("renders all eight stable task slots", async () => {
  const html = await (await render()).text();
  const taskKeyCount = (html.match(/class="task-key /g) ?? []).length;
  assert.equal(taskKeyCount, 8);
  assert.match(html, /DT1/);
  assert.match(html, /MP2/);
});
