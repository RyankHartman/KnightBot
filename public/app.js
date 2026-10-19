(() => {
  "use strict";

  const MAX_CHARS = 4000; // matches the server limit
  const HISTORY_LIMIT = 12; // recent messages sent as context
  const CLIENT_TIMEOUT_MS = 30000; // slightly above the server's Groq timeout
  const GREETING = "Hey, I’m Knight, Ryan’s super-smart Shih Tzu. What’s on your mind?";

  const $ = (id) => document.getElementById(id);
  const log = $("log");
  const empty = $("empty");
  const form = $("composer");
  const input = $("composer-input");
  const sendBtn = $("send");
  const charCount = $("char-count");
  const statusEl = $("status");
  const scene = document.querySelector(".scene");
  const bubbleText = $("bubble-text");
  const themeBtn = $("theme-toggle");

  /** @type {{role: "user"|"assistant", content: string}[]} */
  let history = [];
  let pending = null; // AbortController for the in-flight request

  // ---------- Theme ----------
  function applyThemeLabel() {
    const isLight = document.documentElement.dataset.theme === "light";
    themeBtn.setAttribute("aria-label", isLight ? "Switch to dark theme" : "Switch to light theme");
    document.querySelector('meta[name="theme-color"]').setAttribute("content", isLight ? "#f2f1ec" : "#16181c");
  }
  themeBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("knight-theme", next); } catch (e) { /* storage unavailable */ }
    applyThemeLabel();
  });
  applyThemeLabel();

  // ---------- Minimal, safe Markdown ----------
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function inline(s) {
    // s is already escaped
    return s
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  function renderMarkdown(text) {
    const parts = text.split(/```/);
    let html = "";
    parts.forEach((part, i) => {
      if (i % 2 === 1) {
        const code = part.replace(/^[\w+-]*\n/, "");
        html += `<pre><code>${escapeHtml(code.replace(/\n$/, ""))}</code></pre>`;
        return;
      }
      const lines = escapeHtml(part).split("\n");
      let list = null; // "ul" | "ol"
      let para = [];
      const flushPara = () => {
        if (para.length) html += `<p>${inline(para.join("<br>"))}</p>`;
        para = [];
      };
      const closeList = () => { if (list) { html += `</${list}>`; list = null; } };

      for (const line of lines) {
        const ul = line.match(/^\s*[-*•]\s+(.*)/);
        const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
        const h = line.match(/^\s*#{1,6}\s+(.*)/);
        if (ul || ol) {
          flushPara();
          const type = ul ? "ul" : "ol";
          if (list !== type) { closeList(); html += `<${type}>`; list = type; }
          html += `<li>${inline((ul || ol)[1])}</li>`;
        } else if (h) {
          flushPara(); closeList();
          html += `<h3>${inline(h[1])}</h3>`;
        } else if (!line.trim()) {
          flushPara(); closeList();
        } else {
          closeList();
          para.push(line);
        }
      }
      flushPara(); closeList();
    });
    return html;
  }

  // ---------- Rendering ----------
  function scrollToEnd() {
    log.scrollTop = log.scrollHeight;
  }

  function addMessage(role, content, opts = {}) {
    empty.hidden = true;
    const wrap = document.createElement("div");
    wrap.className = `msg ${role === "user" ? "msg-user" : "msg-bot"}${opts.error ? " msg-error" : ""}`;

    const label = document.createElement("span");
    label.className = "msg-label";
    label.textContent = role === "user" ? "you" : opts.error ? "knight · error" : "knight";

    const body = document.createElement("div");
    body.className = "msg-body";
    if (role === "user" || opts.error) body.textContent = content;
    else body.innerHTML = renderMarkdown(content);

    wrap.append(label, body);
    log.append(wrap);
    scrollToEnd();
    return { wrap, body };
  }

  function showTyping() {
    const wrap = document.createElement("div");
    wrap.className = "msg msg-bot";
    wrap.id = "typing";
    wrap.innerHTML =
      '<span class="msg-label">knight</span>' +
      '<div class="msg-body typing"><span class="dots" aria-hidden="true"><span></span><span></span><span></span></span>' +
      '<span class="typing-text">sniffing out an answer…</span></div>';
    log.append(wrap);
    scrollToEnd();
  }

  function hideTyping() {
    const t = $("typing");
    if (t) t.remove();
  }

  function setBusy(busy) {
    scene.classList.toggle("is-thinking", busy);
    log.setAttribute("aria-busy", String(busy));
    bubbleText.textContent = busy
      ? "On the scent… thinking it through."
      : log.querySelector(".msg-error")
        ? "Ruh-roh, that didn’t work. Want to try again?"
        : history.length
          ? "Fetched it! Anything else? I’m all ears."
          : GREETING;
    updateComposer();
  }

  function updateComposer() {
    const len = input.value.length;
    charCount.textContent = `${len} / ${MAX_CHARS}`;
    charCount.classList.toggle("over", len >= MAX_CHARS);
    sendBtn.disabled = !!pending || !input.value.trim();
    input.style.height = "0px"; // min-height keeps it usable while measuring
    input.style.height = Math.min(input.scrollHeight + 2, 180) + "px";
  }

  // ---------- Networking ----------
  async function requestReply() {
    const controller = new AbortController();
    pending = controller;
    const timer = setTimeout(() => controller.abort("timeout"), CLIENT_TIMEOUT_MS);
    setBusy(true);
    showTyping();
    statusEl.textContent = "Knight is thinking.";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-HISTORY_LIMIT) }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      if (pending !== controller) return; // superseded by New chat

      if (!res.ok || !data || typeof data.reply !== "string") {
        const msg = data?.error?.message || `Something went wrong (HTTP ${res.status}).`;
        throw new Error(msg);
      }

      hideTyping();
      history.push({ role: "assistant", content: data.reply });
      addMessage("assistant", data.reply);
      statusEl.textContent = "Knight replied.";
    } catch (err) {
      if (pending !== controller) return;
      hideTyping();
      const message = controller.signal.aborted
        ? "That took too long. Check your connection and try again."
        : err instanceof TypeError
          ? "Couldn’t reach the server. Check your connection and try again."
          : err.message;
      showError(message);
      statusEl.textContent = "Error: " + message;
    } finally {
      clearTimeout(timer);
      if (pending === controller) {
        pending = null;
        setBusy(false);
      }
    }
  }

  function showError(message) {
    const { wrap, body } = addMessage("assistant", message, { error: true });
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "retry";
    retry.textContent = "Try again";
    retry.addEventListener("click", () => {
      wrap.remove();
      requestReply();
      input.focus();
    });
    body.append(document.createElement("br"), retry);
  }

  function send(text) {
    const content = text.trim().slice(0, MAX_CHARS);
    if (!content || pending) return;
    // Drop any stale error bubbles before a new turn.
    log.querySelectorAll(".msg-error").forEach((el) => el.remove());
    history.push({ role: "user", content });
    if (history.length > 50) history = history.slice(-50); // bound memory use
    addMessage("user", content);
    input.value = "";
    updateComposer();
    requestReply();
  }

  // ---------- Events ----------
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    send(input.value);
  });

  input.addEventListener("input", updateComposer);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send(input.value);
    }
  });

  $("suggestions").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (chip) send(chip.textContent);
  });

  $("new-chat").addEventListener("click", () => {
    if (pending) pending.abort();
    pending = null;
    history = [];
    log.querySelectorAll(".msg").forEach((el) => el.remove());
    empty.hidden = false;
    input.value = "";
    setBusy(false);
    statusEl.textContent = "Started a new chat.";
    input.focus();
  });

  updateComposer();
})();
