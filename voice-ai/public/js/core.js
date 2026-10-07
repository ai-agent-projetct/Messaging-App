// Shared dashboard plumbing: state, API calls, escaping, layout and routing.

export const root = document.getElementById("root");
export const state = { token: localGet("vd_token"), user: null, org: null, usage: null, catalog: null, badges: {} };
const routes = {};
let cleanup = [];

export function localGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
export function localSet(key, value) { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch {} }

// Escapes text before it goes into HTML, so customer input can't inject markup.
export function h(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export async function api(method, path, body) {
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

export async function download(path, filename) {
  const res = await fetch(`/api${path}`, { headers: { authorization: `Bearer ${state.token}` } });
  if (!res.ok) return toast("Export failed");
  const url = URL.createObjectURL(await res.blob());
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toast(text) {
  const el = Object.assign(document.createElement("div"), { className: "toast", textContent: text });
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}

export const rupees = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");
export const fmtDuration = (s) => (s ? `${Math.floor(s / 60)}m ${s % 60}s` : "—");
export const icon = (d, size = 18) => `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
export const LOGO = `<span class="logo-mark"><svg width="18" height="18" viewBox="0 0 32 32" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M5 13v6M11 9v14M17 5v22M23 10v12M29 14v4"/></svg></span>VoiceDesk`;

export function pill(text, tone = "") {
  return `<span class="pill ${tone}">${h(text)}</span>`;
}

const TONES = { hot: "hot", warm: "warm", cold: "grey", none: "grey", negative: "bad", positive: "", neutral: "grey" };
export const tone = (v) => TONES[v] ?? "grey";

/** Run fn on an interval while the current page is shown. */
export function every(ms, fn) {
  const t = setInterval(fn, ms);
  cleanup.push(() => clearInterval(t));
}
export function onLeave(fn) {
  cleanup.push(fn);
}

// ---------- routing ----------
export function route(name, view) {
  routes[name] = view;
}

export async function router() {
  cleanup.forEach((fn) => fn());
  cleanup = [];
  const [name, param] = location.hash.slice(1).split("/");
  if (!state.token && !["login", "signup"].includes(name)) return (location.hash = "#login");
  if (state.token && (!name || ["login", "signup"].includes(name))) return (location.hash = "#overview");
  state.catalog ??= await api("GET", "/catalog");
  if (state.token && !state.user) {
    try { await refreshMe(); } catch { return; }
  }
  if (state.token) await refreshBadges();
  try {
    await (routes[name] || routes.overview)(param);
  } catch (err) {
    if (state.token) shell("", `<div class="panel error">${h(err.message)}</div>`);
  }
}

export async function refreshMe() {
  Object.assign(state, await api("GET", "/me"));
}

export function signOut() {
  if (state.token) fetch("/api/auth/logout", { method: "POST", headers: { authorization: `Bearer ${state.token}` } }).catch(() => {});
  Object.assign(state, { token: null, user: null, org: null });
  localSet("vd_token", null);
  location.hash = "#login";
}

const NAV = [
  ["overview", "Overview", "M3 12l9-8 9 8M5 10v10h14V10"],
  ["live", "Live calls", "M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14", "live"],
  ["agents", "Receptionists", "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3"],
  ["calls", "Calls", "M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"],
  ["questions", "Teach it", "M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.6V14M12 17h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18", "questions"],
  ["appointments", "Bookings", "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4"],
  ["leads", "Leads", "M3 3v18h18M7 14l4-4 3 3 5-6"],
  ["customers", "Customers", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c1-4 4-6 7-6s6 2 7 6M17 11a3 3 0 1 0 0-6M22 21c-.5-2.5-2-4-4-5"],
  ["campaigns", "Campaigns", "M3 11l15-6v14L3 13zM7 12v6a2 2 0 0 0 4 0v-5"],
  ["messages", "Messages", "M4 5h16v11H8l-4 4z"],
  ["settings", "Settings", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"],
];

export function shell(active, content) {
  const nav = state.user?.isAdmin ? [...NAV, ["admin", "Admin", "M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"]] : NAV;
  const badge = (key) => (key && state.badges[key] ? `<span class="badge">${state.badges[key]}</span>` : "");
  root.innerHTML = `
    <div class="shell">
      <aside class="side">
        <a class="logo" href="#overview">${LOGO}</a>
        <nav>${nav.map(([id, label, d, b]) => `<a class="nav ${active === id ? "active" : ""}" href="#${id}">${icon(d)}<span>${label}</span>${badge(b)}</a>`).join("")}</nav>
        <div class="org"><strong>${h(state.org?.name)}</strong><span>${h(state.usage?.planLabel ?? "")}</span><button id="signout">Sign out</button></div>
      </aside>
      <main id="main">${content}</main>
    </div>`;
  document.getElementById("signout").onclick = signOut;
}

/** Badge counts in the sidebar (live calls, questions to answer). */
export async function refreshBadges() {
  if (!state.token) return;
  try {
    const [live, questions] = await Promise.all([api("GET", "/calls?status=live"), api("GET", "/questions")]);
    state.badges = { live: live.length, questions: questions.length };
  } catch {}
}

export function bindRowLinks(scope = root) {
  scope.querySelectorAll("tr[data-href]").forEach((tr) => {
    tr.onclick = () => (location.hash = tr.dataset.href);
    tr.onkeydown = (e) => { if (e.key === "Enter") location.hash = tr.dataset.href; };
    tr.tabIndex = 0;
  });
}

export function emptyState(text) {
  return `<div class="empty">${text}</div>`;
}
