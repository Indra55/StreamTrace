import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.ts";
import { maxAudioBytes, maxAudioRequestBytes } from "../transcribe.ts";
import { fixture, config } from "./helpers.ts";

function audio(size = 32) {
  const body = new FormData();
  body.set("file", new Blob([new Uint8Array(size)], { type: "audio/webm;codecs=opus" }), "private-name.webm");
  return { method: "POST", body };
}
test("anonymous transcription forwards bounded audio and no supplied filename, without DB access or logs", async () => {
  const f = await fixture();
  const spies = ["log", "warn", "error", "info", "debug"].map(name => mock.method(console, name as "log", () => {}));
  try {
    const app = await createApp(f.pool, { ...config, SARVAM_API_KEY: "private-test-key" }, { fetcher: async (url, options) => {
      assert.equal(url, "https://api.sarvam.ai/speech-to-text");
      assert.equal(new Headers(options?.headers).get("api-subscription-key"), "private-test-key");
      const form = options?.body as FormData;
      assert.equal(form.get("model"), "saaras:v3");
      const file = form.get("file") as File;
      assert.equal(file.name, "recording.webm"); assert.equal(file.type, "audio/webm"); assert.equal(file.size, 32);
      return Response.json({ transcript: " I see foam. ", request_id: "discarded", review_state: "approved" });
    } });
    const response = await app.request("/api/transcribe", audio());
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { transcript: "I see foam." });
    assert.equal(f.calls.length, 0);
    assert.ok(spies.every(spy => spy.mock.callCount() === 0));
  } finally { spies.forEach(spy => spy.mock.restore()); }
});
test("oversize audio and multipart envelopes never reach the provider", async () => {
  const f = await fixture(); let calls = 0;
  const app = await createApp(f.pool, { ...config, SARVAM_API_KEY: "mock" }, { fetcher: async () => { calls++; return Response.json({ transcript: "Unexpected" }); } });
  for (const size of [maxAudioBytes + 1, maxAudioRequestBytes + 1]) {
    const response = await app.request("/api/transcribe", audio(size));
    assert.equal(response.status, 502); assert.deepEqual(await response.json(), { error: "fallback" });
  }
  assert.equal(calls, 0); assert.equal(f.calls.length, 0);
});
test("missing key, provider 403, network timeout and malformed responses return only fallback without logs", async () => {
  const f = await fixture();
  const spies = ["log", "warn", "error", "info", "debug"].map(name => mock.method(console, name as "log", () => {}));
  try {
    for (const fetcher of [
      async () => new Response("private-test-key private-audio", { status: 403 }),
      async () => { throw new DOMException("private-test-key private-audio", "TimeoutError"); },
      async () => Response.json({ transcript: 123 }),
      async () => new Response("malformed JSON"),
    ]) {
      const app = await createApp(f.pool, { ...config, SARVAM_API_KEY: "private-test-key" }, { fetcher });
      const response = await app.request("/api/transcribe", audio());
      assert.equal(response.status, 502); assert.deepEqual(await response.json(), { error: "fallback" });
    }
    const response = await f.app.request("/api/transcribe", audio());
    assert.equal(response.status, 502); assert.deepEqual(await response.json(), { error: "fallback" });
    assert.ok(spies.every(spy => spy.mock.callCount() === 0)); assert.equal(f.calls.length, 0);
  } finally { spies.forEach(spy => spy.mock.restore()); }
});
test("voice requests are rate limited by peer and reset after one minute", async () => {
  const f = await fixture(); let calls = 0, now = 1000;
  const app = await createApp(f.pool, { ...config, SARVAM_API_KEY: "mock", AI_RATE_LIMIT: 1 }, { now: () => now, getIp: () => "peer", fetcher: async () => { calls++; return Response.json({ transcript: "I see foam." }); } });
  assert.equal((await app.request("/api/transcribe", audio())).status, 200);
  const response = await app.request("/api/transcribe", audio());
  assert.equal(response.status, 502); assert.deepEqual(await response.json(), { error: "fallback" }); assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(calls, 1); now += 60_000;
  assert.equal((await app.request("/api/transcribe", audio())).status, 200);
});
