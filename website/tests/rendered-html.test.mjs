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
  assert.match(html, /Download for macOS/);
  assert.match(html, /Get the Stream Deck plugin/);
  assert.match(html, /Needs input/);
  assert.match(html, /Your task data stays on your Mac/);
  assert.match(html, /Deck-Threads-1\.0\.0-universal\.dmg/);
  assert.match(html, /com\.roie\.deck-threads\.streamDeckPlugin/);
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
