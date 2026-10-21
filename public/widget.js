/*
 * Knight chat widget: a floating Knight dog button that opens the Knight chat
 * in a pop-up panel on any website.
 *
 * Add one tag to your site (replace the URL with your Vercel URL):
 *   <script src="https://YOUR-KNIGHT-APP.vercel.app/widget.js" defer></script>
 *
 * Optional attributes on the script tag:
 *   data-position="left"   put the button bottom-left (default: right)
 *   data-theme="light"     light chat panel (default: dark)
 *   data-nudge="off"       hide the "Ask Knight anything!" hint
 *   data-mode="general"    let Knight answer anything (default: "about", where
 *                          Knight only answers questions about Ryan)
 */
(() => {
  "use strict";
  if (window.__knightWidgetLoaded) return;
  window.__knightWidgetLoaded = true;

  const script =
    document.currentScript || document.querySelector('script[src*="widget.js"]');
  if (!script) return;

  const origin = new URL(script.src, location.href).origin;
  const side = script.dataset.position === "left" ? "left" : "right";
  const theme = script.dataset.theme === "light" ? "light" : "dark";
  const showNudge = script.dataset.nudge !== "off";
  const mode = script.dataset.mode === "general" ? "general" : "about";
  const chatUrl = `${origin}/?embed=1&theme=${theme}&mode=${mode}`;
  const iconUrl = `${origin}/assets/robot.png`;

  const host = document.createElement("div");
  host.id = "knight-chat-widget";
  const root = host.attachShadow({ mode: "open" });

  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }
      .launcher {
        position: fixed;
        ${side}: 18px;
        bottom: 18px;
        z-index: 2147483000;
        width: 84px;
        height: 84px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: transparent;
        cursor: pointer;
        filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.35));
        transition: transform 0.2s ease;
        animation: knight-hop 3.2s ease-in-out 1.2s infinite;
      }
      .launcher img { display: block; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
      .launcher:hover { transform: translateY(-3px) rotate(-4deg); animation-play-state: paused; }
      .launcher:focus-visible { outline: 3px solid #2fa8ff; outline-offset: 2px; }
      .launcher[aria-expanded="true"] { animation: none; }
      .badge {
        position: absolute;
        top: 2px;
        ${side === "right" ? "left" : "right"}: 0;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: #16181c;
        color: #c6f432;
        border: 2px solid #c6f432;
        display: none;
        align-items: center;
        justify-content: center;
      }
      .launcher[aria-expanded="true"] .badge { display: flex; }

      .nudge {
        position: fixed;
        ${side}: 108px;
        bottom: 46px;
        z-index: 2147483000;
        max-width: 220px;
        padding: 10px 14px;
        border-radius: 14px;
        background: #c6f432;
        color: #16181c;
        font: 700 14px/1.3 "Space Grotesk", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
        opacity: 0;
        transform: translateY(6px);
        transition: opacity 0.3s ease, transform 0.3s ease;
        pointer-events: none;
      }
      .nudge.show { opacity: 1; transform: none; }

      .panel {
        position: fixed;
        ${side}: 18px;
        bottom: 112px;
        z-index: 2147483001;
        width: 390px;
        height: min(640px, calc(100vh - 140px));
        border-radius: 18px;
        overflow: hidden;
        background: ${theme === "light" ? "#ffffff" : "#1f2228"};
        border: 1px solid ${theme === "light" ? "#dddcd5" : "#33373f"};
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
        transform-origin: bottom ${side};
        animation: knight-open 0.22s ease-out;
      }
      .panel[hidden] { display: none; }
      .panel iframe { display: block; width: 100%; height: 100%; border: 0; }

      @media (max-width: 520px), (max-height: 560px) {
        .panel {
          inset: 0;
          width: 100%;
          height: 100%;
          height: 100dvh;
          border-radius: 0;
          border: 0;
        }
        .panel:not([hidden]) ~ .launcher { display: none; }
        .launcher { width: 72px; height: 72px; }
        .nudge { ${side}: 94px; bottom: 38px; }
      }

      @keyframes knight-hop {
        0%, 86%, 100% { transform: translateY(0); }
        90% { transform: translateY(-8px); }
        94% { transform: translateY(0); }
        97% { transform: translateY(-4px); }
      }
      @keyframes knight-open {
        from { opacity: 0; transform: translateY(12px) scale(0.97); }
        to { opacity: 1; transform: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        .launcher, .panel { animation: none !important; }
        .launcher, .nudge { transition: none; }
      }
    </style>
    <div class="nudge" aria-hidden="true">${mode === "about" ? "Woof! Ask me about Ryan." : "Woof! Ask Knight anything."}</div>
    <div class="panel" id="knight-panel" role="dialog" aria-label="Chat with Knight" hidden></div>
    <button class="launcher" type="button" aria-label="Chat with Knight, Ryan’s AI Shih Tzu"
            aria-expanded="false" aria-controls="knight-panel" title="Chat with Knight">
      <img src="${iconUrl}" alt="" width="84" height="84" />
      <span class="badge" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="12" height="12"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/></svg>
      </span>
    </button>
  `;

  const launcher = root.querySelector(".launcher");
  const panel = root.querySelector(".panel");
  const nudge = root.querySelector(".nudge");
  let iframe = null;

  function hideNudge() {
    nudge.classList.remove("show");
  }

  function open() {
    hideNudge();
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.title = "Knight chat";
      iframe.src = chatUrl;
      iframe.allow = "clipboard-write";
      iframe.addEventListener("load", () => focusChat());
      panel.append(iframe);
    }
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    launcher.setAttribute("aria-label", "Close Knight chat");
    focusChat();
  }

  function close() {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Chat with Knight, Ryan’s AI Shih Tzu");
    launcher.focus();
  }

  function focusChat() {
    if (!iframe || panel.hidden) return;
    iframe.focus();
    // Skip auto-focusing the text box on touch screens so the keyboard doesn't jump up.
    if (!window.matchMedia("(pointer: coarse)").matches) {
      iframe.contentWindow?.postMessage({ source: "knight-widget", type: "focus" }, origin);
    }
  }

  launcher.addEventListener("click", () => (panel.hidden ? open() : close()));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) close();
  });

  window.addEventListener("message", (e) => {
    if (e.origin !== origin || !iframe || e.source !== iframe.contentWindow) return;
    if (e.data?.source === "knight-widget" && e.data.type === "close") close();
  });

  if (showNudge) {
    let seen = false;
    try { seen = sessionStorage.getItem("knight-nudge") === "1"; } catch (e) { /* storage unavailable */ }
    if (!seen) {
      setTimeout(() => {
        if (!panel.hidden) return;
        nudge.classList.add("show");
        try { sessionStorage.setItem("knight-nudge", "1"); } catch (e) { /* storage unavailable */ }
        setTimeout(hideNudge, 7000);
      }, 2500);
    }
  }

  const mount = () => document.body.append(host);
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
