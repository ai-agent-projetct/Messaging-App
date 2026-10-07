/*
 * VoiceDesk "Talk to us" widget. Businesses add one line to their website:
 *   <script src="https://YOUR-VOICEDESK-DOMAIN/widget.js" data-agent="PUBLIC_ID" async></script>
 * It shows a floating button that opens a voice + chat panel connected to
 * the business's AI receptionist. Self-contained: no dependencies, and its
 * styles live in a shadow root so they can't clash with the host page.
 */
(function () {
  const script = document.currentScript;
  const agentId = script && script.dataset.agent;
  if (!agentId) return console.warn("VoiceDesk widget: missing data-agent");
  const origin = new URL(script.src).origin;
  const color = script.dataset.color || "#0e7c66";
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483000";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
      .fab { width: 60px; height: 60px; border-radius: 50%; border: 0; background: ${color}; color: #fff; cursor: pointer; box-shadow: 0 6px 24px rgba(0,0,0,.25); display: grid; place-items: center; margin-left: auto; }
      .panel { width: min(360px, calc(100vw - 40px)); height: 480px; max-height: calc(100vh - 110px); background: #fff; color: #10201c; border-radius: 18px; box-shadow: 0 12px 48px rgba(0,0,0,.25); display: none; flex-direction: column; overflow: hidden; margin-bottom: 12px; }
      .panel.open { display: flex; }
      header { background: ${color}; color: #fff; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; }
      header b { display: block; font-size: 15px; } header small { opacity: .85; font-size: 12px; }
      header button { background: none; border: 0; color: #fff; font-size: 22px; cursor: pointer; line-height: 1; }
      .log { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 8px; background: #f7f6f2; }
      .m { max-width: 85%; padding: 8px 12px; border-radius: 14px; font-size: 14px; line-height: 1.4; }
      .a { background: #fff; border: 1px solid #e6e2d8; } .u { background: ${color}; color: #fff; align-self: flex-end; } .s { align-self: center; font-size: 12px; color: #6b7c77; }
      form { display: flex; gap: 6px; padding: 10px; border-top: 1px solid #e6e2d8; }
      input { flex: 1; border: 1px solid #e6e2d8; border-radius: 10px; padding: 10px; font-size: 14px; }
      .mic, .send { border: 0; border-radius: 10px; background: ${color}; color: #fff; padding: 0 12px; cursor: pointer; font-weight: 700; }
      .mic.on { background: #ff9f1c; }
      .foot { text-align: center; font-size: 11px; color: #6b7c77; padding: 0 0 8px; }
    </style>
    <div class="panel" role="dialog" aria-label="Chat with us">
      <header><div><b class="title">Talk to us</b><small>AI assistant · usually replies instantly</small></div><button class="close" aria-label="Close">×</button></header>
      <div class="log" aria-live="polite"></div>
      <form><input placeholder="Type or tap the mic…" aria-label="Message" maxlength="1000">${Recognition ? '<button type="button" class="mic" aria-label="Speak">🎤</button>' : ""}<button class="send">Send</button></form>
      <div class="foot">Powered by VoiceDesk</div>
    </div>
    <button class="fab" aria-label="Talk to us"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>`;
  document.body.appendChild(host);

  const $ = (s) => root.querySelector(s);
  const log = $(".log");
  let session = null;
  let busy = false;
  let lang = "en-IN";
  let voice = false;

  function add(cls, text) {
    const el = document.createElement("div");
    el.className = `m ${cls}`;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function speak(text) {
    if (!voice || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    speechSynthesis.speak(u);
  }

  async function post(path, body) {
    const res = await fetch(origin + "/api/public" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    return data;
  }

  async function open() {
    $(".panel").classList.add("open");
    if (session) return;
    try {
      const info = await fetch(`${origin}/api/public/agents/${encodeURIComponent(agentId)}`).then((r) => r.json());
      if (info.business) $(".title").textContent = info.business;
      session = await post(`/agents/${encodeURIComponent(agentId)}/sessions`);
      lang = session.language || lang;
      add("a", session.greeting);
    } catch (e) {
      add("s", e.message);
    }
  }

  async function send(text) {
    if (!text || busy) return;
    if (!session) await open();
    if (!session) return;
    busy = true;
    add("u", text);
    const typing = add("s", "…");
    try {
      const r = await post(`/sessions/${session.sessionId}/say`, { secret: session.secret, text });
      typing.remove();
      add("a", r.reply);
      speak(r.reply);
      if (r.transfer) add("s", `Call us: ${r.transfer}`);
      if (r.ended) {
        add("s", "Chat ended. Open again any time.");
        session = null;
      }
    } catch (e) {
      typing.remove();
      add("s", e.message);
    }
    busy = false;
  }

  $(".fab").onclick = () => ($(".panel").classList.contains("open") ? $(".panel").classList.remove("open") : open());
  $(".close").onclick = () => $(".panel").classList.remove("open");
  $("form").onsubmit = (e) => {
    e.preventDefault();
    const input = $("input");
    send(input.value.trim());
    input.value = "";
  };
  const mic = $(".mic");
  if (mic) {
    mic.onclick = () => {
      voice = true; // once someone talks, the assistant talks back
      const rec = new Recognition();
      rec.lang = lang;
      mic.classList.add("on");
      rec.onresult = (e) => send(e.results[0][0].transcript);
      rec.onend = () => mic.classList.remove("on");
      rec.start();
    };
  }
})();
