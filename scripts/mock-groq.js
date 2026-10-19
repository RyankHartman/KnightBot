// Fake Groq API for local testing without a real key.
// Usage: node scripts/mock-groq.js   (listens on MOCK_PORT, default 4010)
// Then run the dev server with GROQ_API_URL=http://localhost:4010/v1/chat/completions
// and any GROQ_API_KEY value. Special prompts trigger error paths:
//   "mock:401"  -> rejected key      "mock:429" -> rate limit
//   "mock:slow" -> never replies (exercises the timeout)
import http from "node:http";

export function createMockGroq() {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const json = JSON.parse(body || "{}");
      requests.push({ headers: req.headers, body: json });
      const last = json.messages?.at(-1)?.content || "";
      const reply = (status, payload) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
      };

      if (last.includes("mock:401")) return reply(401, { error: { message: "Invalid API Key" } });
      if (last.includes("mock:429")) return reply(429, { error: { message: "Rate limit reached" } });
      if (last.includes("mock:slow")) return; // hang

      const turns = json.messages.filter((m) => m.role !== "system").length;
      const content =
        `**Mock reply** from \`${json.model}\` (${turns} message(s) of context).\n\n` +
        `You said: "${last.slice(0, 80)}"\n\n- First point\n- Second point\n\n` +
        "```js\nconsole.log('hello from knight');\n```";
      setTimeout(() => reply(200, { choices: [{ message: { role: "assistant", content } }] }), 600);
    });
  });
  return { server, requests };
}

if (process.argv[1]?.endsWith("mock-groq.js")) {
  const port = Number(process.env.MOCK_PORT) || 4010;
  createMockGroq().server.listen(port, () => console.log(`Mock Groq at http://localhost:${port}/v1/chat/completions`));
}
