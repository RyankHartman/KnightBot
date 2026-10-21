// Tests api/chat.js against a mock Groq server (no real key or network needed).
// Usage: npm test
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createMockGroq } from "./mock-groq.js";

const mock = createMockGroq();
await new Promise((r) => mock.server.listen(0, r));
const port = mock.server.address().port;

process.env.GROQ_API_URL = `http://127.0.0.1:${port}/v1/chat/completions`;
process.env.GROQ_API_KEY = "test-key-not-real";
delete process.env.GROQ_MODEL;

const { default: handler, LIMITS } = await import("../api/chat.js");

function call(method, body, { raw } = {}) {
  const payload = raw ?? (body === undefined ? "" : JSON.stringify(body));
  const req = Readable.from([payload]);
  req.method = method;
  return new Promise((resolve) => {
    const headers = {};
    const res = {
      statusCode: 200,
      headersSent: false,
      setHeader: (k, v) => (headers[k.toLowerCase()] = v),
      end: (data) => resolve({ status: res.statusCode, headers, json: data ? JSON.parse(data) : null }),
    };
    handler(req, res);
  });
}

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push(["PASS", name]);
  } catch (err) {
    results.push(["FAIL", name, err.message]);
  }
}

const user = (content) => ({ role: "user", content });
const bot = (content) => ({ role: "assistant", content });

await test("rejects GET with 405", async () => {
  const r = await call("GET");
  assert.equal(r.status, 405);
});

await test("rejects invalid JSON with 400", async () => {
  const r = await call("POST", undefined, { raw: "{nope" });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, "bad_json");
});

await test("rejects empty / malformed messages", async () => {
  assert.equal((await call("POST", { messages: [] })).status, 400);
  assert.equal((await call("POST", { messages: [{ role: "system", content: "hi" }] })).status, 400);
  assert.equal((await call("POST", { messages: [user("   ")] })).status, 400);
  assert.equal((await call("POST", { messages: [user("hi"), bot("yo")] })).status, 400);
});

await test("rejects a message over the character limit", async () => {
  const r = await call("POST", { messages: [user("x".repeat(LIMITS.maxMessageChars + 1))] });
  assert.equal(r.status, 400);
});

await test("rejects an oversized body with 413", async () => {
  const r = await call("POST", undefined, { raw: JSON.stringify({ messages: [user("a")], pad: "x".repeat(LIMITS.maxBodyBytes) }) });
  assert.equal(r.status, 413);
});

await test("returns a reply, sends system prompt + key + default model", async () => {
  mock.requests.length = 0;
  const r = await call("POST", { messages: [user("Hello Knight")] });
  assert.equal(r.status, 200);
  assert.match(r.json.reply, /Mock reply/);
  const sent = mock.requests[0];
  assert.equal(sent.headers.authorization, "Bearer test-key-not-real");
  assert.equal(sent.body.model, "llama-3.3-70b-versatile");
  assert.equal(sent.body.messages[0].role, "system");
  assert.match(sent.body.messages[0].content, /Knight/);
  assert.match(sent.body.messages[0].content, /Ryan built you/);
  assert.equal(sent.body.max_tokens, LIMITS.maxOutputTokens);
  assert.ok(!JSON.stringify(r.json).includes("test-key-not-real"), "key must not leak to client");
});

await test("honours GROQ_MODEL", async () => {
  process.env.GROQ_MODEL = "custom-model-x";
  mock.requests.length = 0;
  const r = await call("POST", { messages: [user("hi")] });
  delete process.env.GROQ_MODEL;
  assert.equal(r.json.model, "custom-model-x");
  assert.equal(mock.requests[0].body.model, "custom-model-x");
});

await test("bounds history to the most recent messages", async () => {
  const msgs = [];
  for (let i = 0; i < 30; i++) msgs.push(i % 2 ? bot(`a${i}`) : user(`u${i}`));
  msgs.push(user("latest"));
  mock.requests.length = 0;
  await call("POST", { messages: msgs });
  const sent = mock.requests[0].body.messages.filter((m) => m.role !== "system");
  assert.ok(sent.length <= LIMITS.maxHistoryMessages, `sent ${sent.length}`);
  assert.equal(sent.at(-1).content, "latest");
  assert.equal(sent[0].role, "user");
});

await test("bounds history by total characters", async () => {
  const big = "y".repeat(3900);
  const msgs = [user(big), bot(big), user(big), bot(big), user(big), bot(big), user("latest")];
  mock.requests.length = 0;
  await call("POST", { messages: msgs });
  const sent = mock.requests[0].body.messages.filter((m) => m.role !== "system");
  const total = sent.reduce((n, m) => n + m.content.length, 0);
  assert.ok(total <= LIMITS.maxTotalChars, `total ${total}`);
  assert.equal(sent.at(-1).content, "latest");
});

await test("maps Groq 401 to a clear error", async () => {
  const r = await call("POST", { messages: [user("mock:401")] });
  assert.equal(r.status, 502);
  assert.equal(r.json.error.code, "upstream_auth");
});

await test("maps Groq 429 to rate_limited", async () => {
  const r = await call("POST", { messages: [user("mock:429")] });
  assert.equal(r.status, 429);
});

await test("times out slow upstream with 504", async () => {
  const original = LIMITS.timeoutMs;
  LIMITS.timeoutMs = 300;
  const r = await call("POST", { messages: [user("mock:slow")] });
  LIMITS.timeoutMs = original;
  assert.equal(r.status, 504);
  assert.equal(r.json.error.code, "timeout");
});

await test("about mode sends Ryan's profile and scope rules", async () => {
  mock.requests.length = 0;
  const r = await call("POST", { messages: [user("Where did Ryan go to school?")], mode: "about" });
  assert.equal(r.status, 200);
  const system = mock.requests[0].body.messages[0].content;
  assert.match(system, /YOUR SCOPE: RYAN ONLY/);
  assert.match(system, /Cornell SC Johnson College of Business/);
  assert.match(system, /politely decline/);
  assert.ok(!system.includes("<!--"), "editor comments are stripped");
  assert.ok(!/\b727\b/.test(system), "no phone number in the profile");
  assert.equal(mock.requests[0].body.temperature, 0.4);
});

await test("general mode (default) does not include the profile", async () => {
  mock.requests.length = 0;
  await call("POST", { messages: [user("hi")], mode: "something-else" });
  const system = mock.requests[0].body.messages[0].content;
  assert.match(system, /general-purpose assistant/);
  assert.ok(!system.includes("RYAN'S PROFILE"));
});

await test("reports a missing GROQ_API_KEY", async () => {
  const key = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  const r = await call("POST", { messages: [user("hi")] });
  process.env.GROQ_API_KEY = key;
  assert.equal(r.status, 500);
  assert.equal(r.json.error.code, "missing_key");
});

mock.server.closeAllConnections?.();
mock.server.close();

for (const [status, name, err] of results) console.log(`${status}  ${name}${err ? `\n      ${err}` : ""}`);
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
