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
  assert.match(html, /Download app \+ plugin \(\.dmg\)/);
  assert.match(html, /Companion app only \(\.dmg\)/);
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
  assert.match(html, /releases\/download\/v1\.0\.1-beta\.1\/Deck-Threads-Installer\.dmg/);
  assert.match(html, /releases\/download\/v1\.0\.1-beta\.1\/Deck-Threads-Companion\.dmg/);
  assert.doesNotMatch(html, /macOS installer status|releases\/latest\/download\/Deck-Threads-(?:Installer|Companion)\.pkg/i);
  assert.doesNotMatch(html, /signal-strip|attention-section|state-stack|feature-grid|class="orbit/);
  assert.match(html, /property="og:image"/);
  assert.match(html, /https:\/\/deck-threads\.cognitive-dynamics\.io\/og\.png/);
  assert.doesNotMatch(html, /codex|openai|Your site is taking shape|react-loading-skeleton/i);
});

test("renders all eight stable task slots", async () => {
  const html = await (await render()).text();
  const taskKeyCount = (html.match(/class="task-key /g) ?? []).length;
  assert.equal(taskKeyCount, 8);
  assert.match(html, /DT1/);
  assert.match(html, /MP2/);
});
