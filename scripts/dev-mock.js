// Runs the dev server against the mock Groq API, so the UI can be tried
// without a real key. Usage: npm run dev:mock
import { createMockGroq } from "./mock-groq.js";

const { server } = createMockGroq();
await new Promise((r) => server.listen(0, r));

process.env.GROQ_API_URL = `http://127.0.0.1:${server.address().port}/v1/chat/completions`;
process.env.GROQ_API_KEY = "mock-key-not-real";
console.log("Using mock Groq (no real API calls).");

await import("./dev-server.js");
