# Knight

A super-smart, general-purpose AI chatbot powered by [Groq](https://groq.com), starring Knight: Ryan's super-smart Shih Tzu, reimagined as a shaggy robot dog. Built by Ryan. Plain HTML, CSS and JavaScript on the front end, and one Vercel serverless function (`api/chat.js`) that talks to Groq. No framework, no build step, no dependencies.

## Knight's personality

The persona lives in `SYSTEM_PROMPT` in `api/chat.js`. Knight introduces itself as Ryan's super-smart Shih Tzu and credits Ryan as its builder when asked. It is loyal, curious and sharp: it leads with the answer, reasons through multi-step problems, asks a clarifying question only when a request is truly ambiguous, and admits uncertainty instead of guessing. It adds at most one light dog touch per reply, and none on serious topics or inside code and formal writing. Edit that prompt to change Knight's voice.

## Project layout

```
api/chat.js            Serverless endpoint (POST /api/chat) → Groq
public/index.html      Page
public/styles.css      Styles (dark/light themes, responsive, reduced motion)
public/app.js          Chat logic
public/assets/robot.png
public/widget.js       Embeddable floating Knight button + pop-up chat
public/widget-demo.html  Sample page showing the widget
scripts/dev-server.js  Local server (static files + /api/chat)
scripts/dev-mock.js    Local server wired to a fake Groq (no key needed)
scripts/mock-groq.js   Fake Groq API used by tests and dev:mock
scripts/test-api.js    API tests
.env.example           Environment variable template
```

## Environment variables

| Name | Required | Default | Notes |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | yes | none | Server-side only. Never put it in browser code or Git. |
| `GROQ_MODEL` | no | `llama-3.3-70b-versatile` | Any chat model id from your Groq console. |

## Run locally (Node 18+)

```bash
cp .env.example .env.local      # then paste your key into .env.local
npm run dev                     # http://localhost:3000
```

Without a key you can still try the UI against a fake Groq:

```bash
npm run dev:mock
```

In mock mode, messages containing `mock:401`, `mock:429` or `mock:slow` trigger the error and timeout paths.

Run the API tests:

```bash
npm test
```

## Add Knight to another website

Paste one tag before the closing `</body>` of any site, using your Vercel URL:

```html
<script src="https://YOUR-KNIGHT-APP.vercel.app/widget.js" defer></script>
```

A floating Knight dog appears in the bottom-right corner. Clicking it opens the chat in a pop-up panel (full screen on phones). The chat runs inside an iframe from your Knight deployment, so the host site never sees your Groq key and its styles can't clash with Knight's.

Optional attributes on the tag:

- `data-position="left"` puts the button in the bottom-left corner.
- `data-theme="light"` gives the panel a light theme.
- `data-nudge="off"` hides the "Woof! Ask Knight anything." hint.

Preview it locally at http://localhost:3000/widget-demo.html.

## Limits and safeguards

- Each message can be up to 4,000 characters (enforced in the browser and on the server).
- At most the 12 most recent messages are sent to Groq, capped at 16,000 characters in total.
- The request body is capped at 100 KB.
- The Groq request times out after 25 seconds, and the browser request after 30 seconds.
- Replies are capped at 1,024 tokens.
- Groq errors are mapped to friendly messages, and the key is never returned to the client.

## Deploy to Vercel

1. Push this folder to a GitHub repo, then **Add New → Project** in Vercel and import the repo.
2. Leave **Framework Preset** as *Other*. There is no build command, and Vercel serves `public/` automatically.
3. Under **Environment Variables**, add `GROQ_API_KEY` (and optionally `GROQ_MODEL`).
4. Deploy. If you change an environment variable later, redeploy.
