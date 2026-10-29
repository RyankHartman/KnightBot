# Knight 🐾 · an AI chatbot that answers questions about me

<p align="center"><img src="public/assets/robot.png" alt="Knight, a shaggy robot Shih Tzu" width="180"></p>

**Live demo:** [knightbot-pi.vercel.app](https://knightbot-pi.vercel.app) · **Portfolio:** [ryan-builds-stories.lovable.app](https://ryan-builds-stories.lovable.app)

Knight is my real Shih Tzu, reimagined as a robot dog. On my portfolio site, he answers recruiters' and visitors' questions about my background, and politely declines anything else. On his own page, he is a general-purpose assistant.

## Why I built it

A résumé answers the questions I expect. Knight answers the ones I don't. I wanted visitors to be able to ask "What did Ryan do at LAX?" or "Why the MBA?" and get a straight answer in seconds, and I wanted hands-on experience shipping an LLM product end to end rather than just talking about one.

## Product decisions

- **Grounded answers only.** In "about Ryan" mode, Knight answers only from one curated profile file and says when he doesn't know, instead of guessing.
- **Personality with guardrails.** One light dog touch per reply at most, none on serious topics, and answers lead with the point.
- **Zero-friction distribution.** One `<script>` tag adds Knight to any website as a floating button and pop-up chat, isolated in an iframe so the host site's styles can't break it and the API key never reaches the browser.
- **Cost and abuse limits.** Message length, history and reply size are capped, requests time out, and errors map to friendly messages.
- **Testable without a key.** A mock API lets anyone run the UI and the test suite locally.

## How I built it

I scoped the product, wrote the persona and guardrails, and shipped it end to end with Claude Code. Stack: plain HTML/CSS/JavaScript, one Vercel serverless function, and Groq for fast LLM inference (Llama 3.3 70B). No framework, no build step, no dependencies.

---

## Technical details

A super-smart, general-purpose AI chatbot powered by [Groq](https://groq.com), starring Knight: Ryan's super-smart Shih Tzu, reimagined as a shaggy robot dog. Built by Ryan. Plain HTML, CSS and JavaScript on the front end, and one Vercel serverless function (`api/chat.js`) that talks to Groq. No framework, no build step, no dependencies.

## Knight's personality

The persona lives in `SYSTEM_PROMPT` in `api/chat.js`. Knight introduces itself as Ryan's super-smart Shih Tzu and credits Ryan as its builder when asked. It is loyal, curious and sharp: it leads with the answer, reasons through multi-step problems, asks a clarifying question only when a request is truly ambiguous, and admits uncertainty instead of guessing. It adds at most one light dog touch per reply, and none on serious topics or inside code and formal writing. Edit that prompt to change Knight's voice.

## Project layout

```
api/chat.js            Serverless endpoint (POST /api/chat) → Groq
knowledge/ryan.md      Ryan's profile: the only source for "about Ryan" mode
vercel.json            Bundles knowledge/ with the API function
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
- `data-nudge="off"` hides the speech bubble above Knight ("Hi, I’m Knight, Ryan’s AI pup! Ask me anything about Ryan."). The bubble stays up until the visitor opens the chat or dismisses it, then stays hidden for that browser session.
- `data-mode="general"` lets Knight answer anything. By default the widget uses **about mode**: Knight only answers questions about Ryan (background, education, work, interests), using `knowledge/ryan.md` as its only source, and politely declines everything else. The standalone app stays general-purpose.

To change what Knight knows about Ryan, edit `knowledge/ryan.md`, then push and redeploy.

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
