// VoiceDesk dashboard: a small single-page app with hash-based routes
// (#overview, #agents, #agent/<id>, #calls, ...). No framework, no build step.

const root = document.getElementById("root");
const state = { token: localGet("vd_token"), user: null, org: null, catalog: null };

// ---------- helpers ----------
function localGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function localSet(key, value) { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch {} }

// Escapes text before it goes into HTML, so customer input can't inject markup.
function h(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

async function api(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "content-type": "application/json", ...(state.token && { authorization: `Bearer ${state.token}` }) },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && state.token) { signOut(); throw new Error("Session expired"); }
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function toast(text) {
  const el = Object.assign(document.createElement("div"), { className: "toast", textContent: text });
  document.body.append(el);
  setTimeout(() => el.remove(), 2400);
}

const fmtDate = (iso) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const fmtDuration = (s) => (s ? `${Math.floor(s / 60)}m ${s % 60}s` : "—");
const LOGO = `<span class="logo-mark"><svg width="18" height="18" viewBox="0 0 32 32" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M5 13v6M11 9v14M17 5v22M23 10v12M29 14v4"/></svg></span>VoiceDesk`;

// ---------- routing ----------
const routes = {
  login: () => authView("login"),
  signup: () => authView("signup"),
  overview: overviewView,
  agents: agentsView,
  agent: agentEditorView,
  calls: callsView,
  call: callDetailView,
  appointments: () => tableView("appointments"),
  leads: () => tableView("leads"),
  setup: setupView,
};

async function router() {
  stopTestCall();
  const [name, param] = location.hash.slice(1).split("/");
  if (!state.token && !["login", "signup"].includes(name)) return (location.hash = "#login");
  if (state.token && (!name || ["login", "signup"].includes(name))) return (location.hash = "#overview");
  state.catalog ??= await api("GET", "/catalog");
  if (state.token && !state.user) {
    try { Object.assign(state, await api("GET", "/me")); } catch { return; }
  }
  try {
    await (routes[name] || overviewView)(param);
  } catch (err) {
    if (state.token) shell("", `<div class="panel error">${h(err.message)}</div>`);
  }
}
window.addEventListener("hashchange", router);

function signOut() {
  if (state.token) fetch("/api/auth/logout", { method: "POST", headers: { authorization: `Bearer ${state.token}` } }).catch(() => {});
  Object.assign(state, { token: null, user: null, org: null });
  localSet("vd_token", null);
  location.hash = "#login";
}

function shell(active, content) {
  const nav = [
    ["overview", "Overview", "M3 12l9-8 9 8M5 10v10h14V10"],
    ["agents", "Receptionists", "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3"],
    ["calls", "Calls", "M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"],
    ["appointments", "Bookings", "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4"],
    ["leads", "Leads", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6"],
    ["setup", "Phone setup", "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"],
  ];
  root.innerHTML = `
    <div class="shell">
      <aside class="side">
        <a class="logo" href="#overview">${LOGO}</a>
        ${nav.map(([id, label, d]) => `<a class="nav ${active === id ? "active" : ""}" href="#${id}"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="${d}"/></svg>${label}</a>`).join("")}
        <div class="org"><strong>${h(state.org?.name)}</strong><span>${h(state.user?.email)}</span><br><button id="signout">Sign out</button></div>
      </aside>
      <main>${content}</main>
    </div>`;
  document.getElementById("signout").onclick = signOut;
}

// ---------- auth ----------
function authView(mode) {
  const signup = mode === "signup";
  root.innerHTML = `
    <div class="auth"><form class="auth-box" id="auth">
      <a class="logo" href="/">${LOGO}</a>
      <h1>${signup ? "Create your account" : "Welcome back"}</h1>
      <p class="muted">${signup ? "Set up an AI receptionist for your business." : "Sign in to your dashboard."}</p>
      ${signup ? `<label>Business name<input name="businessName" required placeholder="e.g. Glow Salon"></label><label>Your name<input name="name" required autocomplete="name"></label>` : ""}
      <label>Email<input name="email" type="email" required autocomplete="email"></label>
      <label>Password<input name="password" type="password" required minlength="${signup ? 8 : 1}" autocomplete="${signup ? "new-password" : "current-password"}"></label>
      <p class="error" id="err"></p>
      <button class="btn btn-primary">${signup ? "Create account" : "Sign in"}</button>
      <p class="muted" style="text-align:center">${signup ? `Have an account? <a href="#login">Sign in</a>` : `New here? <a href="#signup">Create an account</a>`}</p>
    </form></div>`;
  document.getElementById("auth").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      const data = await api("POST", `/auth/${mode}`, Object.fromEntries(new FormData(e.target)));
      Object.assign(state, data);
      localSet("vd_token", data.token);
      location.hash = signup ? "#agents" : "#overview";
    } catch (err) {
      document.getElementById("err").textContent = err.message;
      btn.disabled = false;
    }
  };
}

// ---------- overview ----------
async function overviewView() {
  const [stats, calls] = await Promise.all([api("GET", "/stats"), api("GET", "/calls")]);
  shell("overview", `
    <div class="page-head"><div><h1>Hello, ${h(state.user.name.split(" ")[0])}</h1><p class="muted">Here's how your AI receptionist is doing.</p></div>
      <a class="btn btn-primary" href="#agents">${stats.agents ? "Manage receptionists" : "Create your receptionist"}</a></div>
    ${state.catalog.aiEnabled ? "" : `<div class="banner"><b>Demo mode.</b> The server has no Anthropic API key yet, so the receptionist gives placeholder answers. Add <code>ANTHROPIC_API_KEY</code> to the server's settings to turn on real AI (see docs/LEARN.md).</div>`}
    <div class="stats">
      <div class="stat"><b>${stats.calls}</b><span>Total calls</span></div>
      <div class="stat"><b>${stats.minutes}</b><span>Minutes talked</span></div>
      <div class="stat"><b>${stats.appointments}</b><span>Bookings made</span></div>
      <div class="stat"><b>${stats.leads}</b><span>Leads captured</span></div>
    </div>
    <div class="panel"><h2>Recent calls</h2>${callsTable(calls.slice(0, 8))}</div>`);
  bindRowLinks();
}

// ---------- agents ----------
async function agentsView() {
  const agents = await api("GET", "/agents");
  shell("agents", `
    <div class="page-head"><div><h1>Receptionists</h1><p class="muted">Each receptionist answers one phone number.</p></div></div>
    ${agents.length ? `<div class="agent-cards">${agents.map((a) => `
      <div class="agent-card">
        <div style="display:flex;justify-content:space-between;gap:8px"><strong>${h(a.name)}</strong><span class="pill ${a.active ? "" : "grey"}">${a.active ? "Active" : "Paused"}</span></div>
        <span class="muted">${h(state.catalog.languages.find((l) => l.code === a.language)?.name)} · ${a.phoneNumber ? h(a.phoneNumber) : "No number yet"}</span>
        <div class="actions"><a class="btn btn-primary" href="#agent/${h(a.id)}">Edit & test</a></div>
      </div>`).join("")}</div>` : ""}
    <div class="panel" style="margin-top:18px"><h2>${agents.length ? "Add another receptionist" : "Create your first receptionist"}</h2>
      <p class="muted">Start from a template for your type of business. You can change everything afterwards.</p>
      <div class="templates">${state.catalog.templates.map((t) => `<button data-template="${h(t.id)}">${h(t.label)}</button>`).join("")}</div>
    </div>`);
  root.querySelectorAll("[data-template]").forEach((btn) => {
    btn.onclick = async () => {
      const agent = await api("POST", "/agents", { templateId: btn.dataset.template });
      location.hash = `#agent/${agent.id}`;
    };
  });
}

async function agentEditorView(id) {
  const a = await api("GET", `/agents/${id}`);
  const { languages } = state.catalog;
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  shell("agents", `
    <div class="page-head"><div><a href="#agents">← Receptionists</a><h1>${h(a.name)}</h1></div></div>
    <div class="editor">
      <form class="panel" id="agent-form">
        <div class="tabs">${["Basics", "Knowledge", "Bookings", "Phone"].map((t, i) => `<button type="button" data-tab="${i}" class="${i ? "" : "active"}">${t}</button>`).join("")}</div>
        <div data-pane="0">
          <label>Name<input name="name" value="${h(a.name)}" required></label>
          <div class="row">
            <label>Main language<select name="language">${languages.map((l) => `<option value="${l.code}" ${l.code === a.language ? "selected" : ""}>${h(l.name)}</option>`).join("")}</select></label>
            <label>Phone voice <span class="hint">(Twilio voice name)</span><input name="voice" value="${h(a.voice)}"></label>
          </div>
          <label>Greeting <span class="hint">— the first thing callers hear</span><textarea name="greeting" style="min-height:70px">${h(a.greeting)}</textarea></label>
          <label class="check"><input type="checkbox" name="active" ${a.active ? "checked" : ""}> Answer calls (turn off to pause)</label>
        </div>
        <div data-pane="1" class="hidden">
          <label>About your business <span class="hint">— address, services, prices, timings, offers, FAQs. Write it like you'd brief a new employee.</span><textarea name="businessInfo" style="min-height:200px">${h(a.businessInfo)}</textarea></label>
          <label>Special instructions <span class="hint">— how it should behave, what it must never say</span><textarea name="instructions">${h(a.instructions)}</textarea></label>
        </div>
        <div data-pane="2" class="hidden">
          <label class="check"><input type="checkbox" name="bookingEnabled" ${a.bookingEnabled ? "checked" : ""}> Let the receptionist book appointments</label>
          <label>Services that can be booked <span class="hint">(comma separated)</span><input name="services" value="${h((a.services || []).join(", "))}"></label>
          <label>Open days<div class="days">${dayNames.map((d, i) => `<label><input type="checkbox" name="day" value="${i}" ${a.hours.days.includes(i) ? "checked" : ""}>${d}</label>`).join("")}</div></label>
          <div class="row">
            <label>Opens<input type="time" name="open" value="${h(a.hours.open)}"></label>
            <label>Closes<input type="time" name="close" value="${h(a.hours.close)}"></label>
          </div>
          <div class="row">
            <label>Appointment length (minutes)<input type="number" name="slotMinutes" min="5" max="480" step="5" value="${a.hours.slotMinutes}"></label>
            <label>Time zone<input name="timeZone" value="${h(a.timeZone)}"></label>
          </div>
        </div>
        <div data-pane="3" class="hidden">
          <label>Phone number that rings this receptionist <span class="hint">— your Twilio number, e.g. +918045671234</span><input name="phoneNumber" value="${h(a.phoneNumber)}" placeholder="+91…"></label>
          <label>Transfer calls to <span class="hint">— a staff mobile for "speak to a person" (optional)</span><input name="transferNumber" value="${h(a.transferNumber)}" placeholder="+91…"></label>
          <p class="muted">See <a href="#setup">Phone setup</a> for how to get a number and connect it.</p>
        </div>
        <p class="error" id="err"></p>
        <div class="save-bar"><button class="btn btn-primary">Save changes</button><button type="button" class="btn btn-danger" id="delete">Delete</button></div>
      </form>
      <div class="phone">
        <h2>Test call</h2>
        <p class="muted">Talk to your receptionist like a customer would. Uses your microphone (Chrome works best), or type instead.</p>
        <div class="chat" id="chat"><div class="msg system">Press "Start test call" to begin.</div></div>
        <div class="phone-controls" id="controls">
          <button class="btn btn-primary" id="start" style="width:100%">Start test call</button>
        </div>
      </div>
    </div>`);

  const form = document.getElementById("agent-form");
  form.querySelectorAll("[data-tab]").forEach((tab) => {
    tab.onclick = () => {
      form.querySelectorAll("[data-tab]").forEach((t) => t.classList.toggle("active", t === tab));
      form.querySelectorAll("[data-pane]").forEach((p) => p.classList.toggle("hidden", p.dataset.pane !== tab.dataset.tab));
    };
  });
  form.language.onchange = () => { form.voice.value = languages.find((l) => l.code === form.language.value).voice; };

  const collect = () => ({
    name: form.name.value.trim(),
    language: form.language.value,
    voice: form.voice.value.trim(),
    greeting: form.greeting.value.trim(),
    active: form.active.checked,
    businessInfo: form.businessInfo.value,
    instructions: form.instructions.value,
    bookingEnabled: form.bookingEnabled.checked,
    services: form.services.value.split(",").map((s) => s.trim()).filter(Boolean),
    hours: {
      days: [...form.querySelectorAll("[name=day]:checked")].map((c) => Number(c.value)),
      open: form.open.value,
      close: form.close.value,
      slotMinutes: Number(form.slotMinutes.value) || 30,
    },
    timeZone: form.timeZone.value.trim() || "Asia/Kolkata",
    phoneNumber: form.phoneNumber.value.trim(),
    transferNumber: form.transferNumber.value.trim(),
  });
  const save = async () => {
    document.getElementById("err").textContent = "";
    try {
      Object.assign(a, await api("PUT", `/agents/${a.id}`, collect()));
      return true;
    } catch (err) {
      document.getElementById("err").textContent = err.message;
      return false;
    }
  };
  form.onsubmit = async (e) => { e.preventDefault(); if (await save()) toast("Saved"); };
  document.getElementById("delete").onclick = async () => {
    if (!confirm(`Delete ${a.name}? Its call history stays in Calls.`)) return;
    await api("DELETE", `/agents/${a.id}`);
    location.hash = "#agents";
  };
  document.getElementById("start").onclick = async () => { if (await save()) startTestCall(a); };
}

// ---------- browser test call (Web Speech API) ----------
let test = null;
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

async function startTestCall(agent) {
  const chat = document.getElementById("chat");
  const controls = document.getElementById("controls");
  chat.innerHTML = "";
  const { callId, greeting } = await api("POST", `/agents/${agent.id}/test`);
  test = { callId, lang: agent.language, busy: false, ended: false, recognizer: null };

  controls.innerHTML = `
    ${Recognition ? `<button class="mic" id="mic" title="Speak"><svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>` : ""}
    <form id="say" style="display:flex;gap:8px;flex:1"><input name="text" placeholder="Type what a caller would say…" autocomplete="off"><button class="btn btn-primary">Send</button></form>
    <button class="btn" id="hangup" title="End call">End</button>`;

  addMsg("agent", greeting);
  speak(greeting, () => listen());

  document.getElementById("say").onsubmit = (e) => {
    e.preventDefault();
    const text = e.target.text.value.trim();
    e.target.text.value = "";
    if (text) send(text);
  };
  document.getElementById("hangup").onclick = () => finish("You ended the call.");
  const mic = document.getElementById("mic");
  if (mic) mic.onclick = () => (test?.recognizer ? test.recognizer.stop() : listen());
}

function addMsg(role, text) {
  const chat = document.getElementById("chat");
  if (!chat) return;
  chat.insertAdjacentHTML("beforeend", `<div class="msg ${role}">${h(text)}</div>`);
  chat.scrollTop = chat.scrollHeight;
}

async function send(text) {
  if (!test || test.ended || test.busy) return;
  test.busy = true;
  addMsg("caller", text);
  addMsg("system", "…");
  try {
    const { reply, action } = await api("POST", `/calls/${test.callId}/say`, { text });
    document.querySelector("#chat .msg.system:last-child")?.remove();
    addMsg("agent", reply);
    test.busy = false;
    if (action) {
      speak(reply, () => finish(action.type === "transfer" ? "The call would now be transferred to your staff number." : "The receptionist ended the call."));
    } else {
      speak(reply, () => listen());
    }
  } catch (err) {
    document.querySelector("#chat .msg.system:last-child")?.remove();
    addMsg("system", err.message);
    if (test) test.busy = false;
  }
}

function speak(text, done) {
  if (!("speechSynthesis" in window)) return done?.();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = test?.lang || "en-IN";
  const voice = speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-") === u.lang);
  if (voice) u.voice = voice;
  u.onend = () => done?.();
  u.onerror = () => done?.();
  speechSynthesis.speak(u);
}

function listen() {
  if (!Recognition || !test || test.ended || test.recognizer) return;
  const rec = new Recognition();
  rec.lang = test.lang;
  rec.interimResults = false;
  rec.onresult = (e) => send(e.results[0][0].transcript);
  rec.onend = () => {
    if (test) test.recognizer = null;
    document.getElementById("mic")?.classList.remove("listening");
  };
  rec.onerror = (e) => { if (e.error === "not-allowed") addMsg("system", "Microphone blocked. Allow it in the browser, or type instead."); };
  test.recognizer = rec;
  document.getElementById("mic")?.classList.add("listening");
  rec.start();
}

function finish(message) {
  if (!test) return;
  const { callId } = test;
  stopTestCall();
  api("POST", `/calls/${callId}/end`).catch(() => {});
  addMsg("system", `${message} It's saved under Calls.`);
  const controls = document.getElementById("controls");
  if (controls) controls.innerHTML = `<a class="btn" href="#call/${h(callId)}" style="flex:1">View transcript</a>`;
}

function stopTestCall() {
  if (!test) return;
  test.ended = true;
  test.recognizer?.abort();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  test = null;
}

// ---------- calls ----------
function callsTable(calls) {
  if (!calls.length) return `<div class="empty">No calls yet. Make a test call from a receptionist's page.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>When</th><th>Receptionist</th><th>Caller</th><th>Duration</th><th>Summary</th><th>Status</th></tr></thead><tbody>
    ${calls.map((c) => `<tr class="click" data-href="#call/${h(c.id)}">
      <td>${fmtDate(c.createdAt)}</td><td>${h(c.agentName)}</td>
      <td>${c.channel === "web" ? `<span class="pill grey">Test</span>` : h(c.callerNumber)}</td>
      <td>${fmtDuration(c.durationSec)}</td><td>${h(c.summary || `${c.turns} messages`)}</td>
      <td><span class="pill ${c.status === "live" ? "live" : "grey"}">${h(c.status === "live" ? "Live" : c.outcome || "Ended")}</span></td></tr>`).join("")}
    </tbody></table></div>`;
}

function bindRowLinks() {
  root.querySelectorAll("tr[data-href]").forEach((tr) => (tr.onclick = () => (location.hash = tr.dataset.href)));
}

async function callsView() {
  const calls = await api("GET", "/calls");
  shell("calls", `<div class="page-head"><div><h1>Calls</h1><p class="muted">Every conversation, with a full transcript.</p></div></div><div class="panel">${callsTable(calls)}</div>`);
  bindRowLinks();
}

async function callDetailView(id) {
  const c = await api("GET", `/calls/${id}`);
  shell("calls", `
    <div class="page-head"><div><a href="#calls">← Calls</a><h1>Call with ${h(c.agentName)}</h1>
      <p class="muted">${fmtDate(c.createdAt)} · ${c.channel === "web" ? "Browser test" : h(c.callerNumber)} · ${fmtDuration(c.durationSec)}</p></div></div>
    ${c.summary ? `<div class="banner"><b>Summary:</b> ${h(c.summary)}</div>` : ""}
    <div class="panel transcript">${c.transcript.map((t) => `<div class="line ${t.role}"><span class="who">${t.role === "agent" ? "Receptionist" : "Caller"}</span><span>${h(t.text)}</span></div>`).join("")}</div>`);
}

// ---------- bookings & leads ----------
async function tableView(kind) {
  const rows = await api("GET", `/${kind}`);
  const bookings = kind === "appointments";
  const statuses = bookings ? ["confirmed", "completed", "cancelled", "no-show"] : ["new", "contacted", "won", "lost"];
  const head = bookings ? ["Date", "Time", "Customer", "Phone", "Service", "Notes", "Status"] : ["Received", "Customer", "Phone", "Interested in", "Notes", "Status"];
  const cells = (r) => bookings
    ? [h(r.date), h(r.time), h(r.customerName), h(r.phone), h(r.service), h(r.notes)]
    : [fmtDate(r.createdAt), h(r.customerName), h(r.phone), h(r.interest), h(r.notes)];
  shell(kind, `
    <div class="page-head"><div><h1>${bookings ? "Bookings" : "Leads"}</h1><p class="muted">${bookings ? "Appointments your receptionist booked." : "Callers to follow up with."}</p></div></div>
    <div class="panel">${rows.length ? `<div class="table-wrap"><table><thead><tr>${head.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>
      ${rows.map((r) => `<tr>${cells(r).map((x) => `<td>${x}</td>`).join("")}<td><select data-id="${h(r.id)}">${statuses.map((s) => `<option ${s === r.status ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty">Nothing yet. ${bookings ? "Bookings appear here when callers book." : "Leads appear here when callers leave their details."}</div>`}</div>`);
  root.querySelectorAll("select[data-id]").forEach((sel) => {
    sel.onchange = async () => { await api("PATCH", `/${kind}/${sel.dataset.id}`, { status: sel.value }); toast("Updated"); };
  });
}

// ---------- phone setup ----------
function setupView() {
  const base = location.origin;
  shell("setup", `
    <div class="page-head"><div><h1>Phone setup</h1><p class="muted">Connect a real phone number so customers can call your receptionist.</p></div></div>
    <div class="panel">
      <ol class="steps">
        <li>Create a <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener">Twilio</a> account and buy a phone number with <b>Voice</b> enabled.</li>
        <li>In Twilio, open the number. Under <b>Voice configuration → A call comes in</b>, choose <b>Webhook</b>, set it to <code>${h(base)}/twilio/voice</code> and the method to <b>HTTP POST</b>.</li>
        <li>Set <b>Call status changes</b> to <code>${h(base)}/twilio/status</code> to record accurate call durations.</li>
        <li>Open your receptionist, go to the <b>Phone</b> tab and enter the number exactly as Twilio shows it (for example <code>+918045671234</code>).</li>
        <li>Call the number from your mobile.</li>
        <li><b>Keep your existing number:</b> turn on call forwarding from your shop's current number to the Twilio number (for example "forward when busy or unanswered").</li>
      </ol>
      <p class="muted">The server must be reachable on the internet over HTTPS for Twilio to call it. See <code>docs/LEARN.md</code> for hosting options.</p>
    </div>`);
}

router();
