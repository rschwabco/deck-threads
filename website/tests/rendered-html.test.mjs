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
  assert.match(html, /Apple notarized/);
  assert.doesNotMatch(html, /releases\/download\/v|\.dmg|notarization pending/i);
  assert.doesNotMatch(html, /signal-strip|attention-section|state-stack|feature-grid|class="orbit/);
  assert.match(html, /property="og:image"/);
  assert.match(html, /https:\/\/deck-threads\.cognitive-dynamics\.io\/og\.png/);
  assert.doesNotMatch(html, /codex|openai|Your site is taking shape|react-loading-skeleton/i);
});

test("download routes select the newest complete published release, including prereleases", async () => {
  const originalFetch = globalThis.fetch;
  const expectedInstaller = "https://github.com/rschwabco/deck-threads/releases/download/v1.0.1-beta.2/Deck-Threads-Installer.pkg";
  const expectedCompanion = "https://github.com/rschwabco/deck-threads/releases/download/v1.0.1-beta.2/Deck-Threads-Companion.pkg";
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.github.com/repos/rschwabco/deck-threads/releases?per_page=20");
    assert.equal(init?.headers?.["User-Agent"], "deck-threads-website");
    return Response.json([
      {
        draft: true,
        published_at: "2026-07-24T00:00:00Z",
        assets: [
          { name: "Deck-Threads-Installer.pkg", browser_download_url: "https://example.com/draft-installer" },
          { name: "Deck-Threads-Companion.pkg", browser_download_url: "https://example.com/draft-companion" },
        ],
      },
      {
        draft: false,
        published_at: "2026-07-23T12:00:00Z",
        assets: [{ name: "Deck-Threads-Installer.pkg", browser_download_url: "https://example.com/incomplete" }],
      },
      {
        draft: false,
        published_at: "2026-07-23T01:26:41Z",
        assets: [
          { name: "Deck-Threads-Installer.pkg", browser_download_url: expectedInstaller },
          { name: "Deck-Threads-Companion.pkg", browser_download_url: expectedCompanion },
        ],
      },
    ]);
  };

  try {
    const installer = await render("/download/installer");
    const companion = await render("/download/companion");
    assert.equal(installer.status, 302);
    assert.equal(installer.headers.get("location"), expectedInstaller);
    assert.equal(companion.status, 302);
    assert.equal(companion.headers.get("location"), expectedCompanion);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("download routes still resolve when the edge cache is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  const expectedInstaller = "https://github.com/rschwabco/deck-threads/releases/download/v1.0.1-beta.2/Deck-Threads-Installer.pkg";
  globalThis.fetch = async () => Response.json([{
    draft: false,
    published_at: "2026-07-23T01:26:41Z",
    assets: [
      { name: "Deck-Threads-Installer.pkg", browser_download_url: expectedInstaller },
      { name: "Deck-Threads-Companion.pkg", browser_download_url: "https://github.com/rschwabco/deck-threads/releases/download/v1.0.1-beta.2/Deck-Threads-Companion.pkg" },
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
