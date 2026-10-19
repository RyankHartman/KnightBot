// Local development server: serves ./public and routes POST /api/chat to the
// same handler Vercel runs. No dependencies. Usage: npm run dev
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

// Load .env.local / .env (KEY=value lines) without overriding real env vars.
for (const file of [".env.local", ".env"]) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

const { default: chat } = await import("../api/chat.js");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/api/chat") {
    try {
      await chat(req, res);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) res.writeHead(500).end();
    }
    return;
  }

  const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).slice(1);
  const file = path.join(publicDir, rel);
  if (!file.startsWith(publicDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log(`Knight running at http://localhost:${port}`);
  if (!process.env.GROQ_API_KEY) {
    console.log("Note: GROQ_API_KEY is not set, so chat requests will return an error.");
  }
});
