// Sign-in, Overview (ROI + brief + alerts) and Live calls.
import { LOGO, api, bindRowLinks, emptyState, every, fmtDate, h, localSet, pill, refreshBadges, root, route, rupees, shell, state, toast, tone } from "../core.js";
import { callsTable } from "./records.js";

// ---------- auth ----------
function authView(mode) {
  const signup = mode === "signup";
  root.innerHTML = `
    <div class="auth"><form class="auth-box" id="auth">
      <a class="logo" href="/">${LOGO}</a>
      <h1>${signup ? "Start your free trial" : "Welcome back"}</h1>
      <p class="muted">${signup ? "Your AI receptionist will be ready in minutes. No card needed." : "Sign in to your dashboard."}</p>
      ${signup ? `<label>Business name<input name="businessName" required placeholder="e.g. Glow Salon"></label><label>Your name<input name="name" required autocomplete="name"></label>` : ""}
      <label>Email<input name="email" type="email" required autocomplete="email"></label>
      <label>Password<input name="password" type="password" required minlength="${signup ? 8 : 1}" autocomplete="${signup ? "new-password" : "current-password"}"></label>
      <p class="error" id="err" role="alert"></p>
      <button class="btn btn-primary">${signup ? "Create account" : "Sign in"}</button>
      <p class="muted" style="text-align:center">${signup ? `Have an account? <a href="#login">Sign in</a>` : `New here? <a href="#signup">Create an account</a>`}</p>
    </form></div>`;
  document.getElementById("auth").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      const data = await api("POST", `/auth/${mode}`, Object.fromEntries(new FormData(e.target)));
      state.token = data.token;
      state.user = null;
      localSet("vd_token", data.token);
      location.hash = signup ? "#agents" : "#overview";
    } catch (err) {
      document.getElementById("err").textContent = err.message;
      btn.disabled = false;
    }
  };
}
route("login", () => authView("login"));
route("signup", () => authView("signup"));

// ---------- overview ----------
function barChart(perDay) {
  // Single series (calls per day), so no legend: the panel title names it.
  const W = 640, H = 180, pad = { l: 28, r: 8, t: 14, b: 26 };
  const max = Math.max(4, ...perDay.map((d) => d.calls));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const bw = Math.min(24, (W - pad.l - pad.r) / perDay.length - 6);
  const x = (i) => pad.l + ((W - pad.l - pad.r) / perDay.length) * (i + 0.5);
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / top);
  const peak = perDay.reduce((m, d, i) => (d.calls > perDay[m].calls ? i : m), 0);
  const bar = (d, i) => {
    if (!d.calls) return "";
    const x0 = x(i) - bw / 2, y0 = y(d.calls), hgt = y(0) - y0, r = Math.min(4, hgt);
    return `<path class="bar" d="M${x0},${y(0)} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + bw - r} Q${x0 + bw},${y0} ${x0 + bw},${y0 + r} V${y(0)} Z"/>`;
  };
  return `
    <div class="chart" id="chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calls per day for the last 14 days">
        ${[0, 1, 2, 3, 4].map((k) => `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(k * step)}" y2="${y(k * step)}"/><text class="tick" x="${pad.l - 6}" y="${y(k * step) + 4}" text-anchor="end">${k * step}</text>`).join("")}
        ${perDay.map(bar).join("")}
        ${perDay[peak].calls ? `<text class="val" x="${x(peak)}" y="${y(perDay[peak].calls) - 5}" text-anchor="middle">${perDay[peak].calls}</text>` : ""}
        ${perDay.map((d, i) => (i % 2 === 1 || i === perDay.length - 1 ? `<text class="tick" x="${x(i)}" y="${H - 8}" text-anchor="middle">${d.date.slice(8)}/${d.date.slice(5, 7)}</text>` : "")).join("")}
        ${perDay.map((d, i) => `<rect class="hit" data-i="${i}" x="${x(i) - (W - pad.l - pad.r) / perDay.length / 2}" y="${pad.t}" width="${(W - pad.l - pad.r) / perDay.length}" height="${H - pad.t - pad.b}"/>`).join("")}
      </svg>
      <div class="tip" id="tip" hidden></div>
    </div>
    <details class="table-view"><summary>Show as table</summary><table><thead><tr><th>Date</th><th>Calls</th><th>Bookings</th></tr></thead><tbody>${perDay.map((d) => `<tr><td>${d.date}</td><td>${d.calls}</td><td>${d.bookings}</td></tr>`).join("")}</tbody></table></details>`;
}

function bindChart(perDay) {
  const tip = document.getElementById("tip");
  const chart = document.getElementById("chart");
  chart.querySelectorAll(".hit").forEach((rect) => {
    rect.onmouseenter = () => {
      const d = perDay[rect.dataset.i];
      tip.innerHTML = `<b>${new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</b><br>${d.calls} call${d.calls === 1 ? "" : "s"} · ${d.bookings} booking${d.bookings === 1 ? "" : "s"}`;
      tip.hidden = false;
      const box = rect.getBoundingClientRect(), host = chart.getBoundingClientRect();
      tip.style.left = `${Math.min(host.width - 150, Math.max(0, box.left - host.left + box.width / 2 - 70))}px`;
    };
    rect.onmouseleave = () => (tip.hidden = true);
  });
}

route("overview", async () => {
  const [ins, brief, alerts, calls] = await Promise.all([api("GET", "/insights"), api("GET", "/brief"), api("GET", "/alerts"), api("GET", "/calls")]);
  await refreshBadges();
  const u = ins.usage;
  const pct = u.minutesIncluded ? Math.min(100, Math.round((u.minutesUsed / u.minutesIncluded) * 100)) : 0;
  const scores = ["hot", "warm", "cold"].map((s) => `${pill(`${ins.leadScores[s] || 0} ${s}`, tone(s))}`).join(" ");
  shell("overview", `
    <div class="page-head"><div><h1>Hello, ${h(state.user.name.split(" ")[0])}</h1><p class="muted">What your AI receptionist did in the last 30 days.</p></div>
      <a class="btn btn-primary" href="#agents">Receptionists</a></div>
    ${state.catalog.aiEnabled ? "" : `<div class="banner"><b>Demo mode.</b> The server has no Anthropic API key, so replies are placeholders. Everything else works. Add <code>ANTHROPIC_API_KEY</code> to turn on real AI (see docs/LEARN.md).</div>`}
    ${u.overLimit ? `<div class="banner bad"><b>Your plan's minutes are used up.</b> Calls are being passed to your phone. <a href="#settings">Upgrade</a></div>` : ""}
    <div class="stats">
      <div class="stat hero"><span>Estimated revenue from bookings</span><b>${rupees(ins.estimatedRevenue)}</b><small>${ins.bookings} bookings × your service prices</small></div>
      <div class="stat"><span>Calls answered</span><b>${ins.calls}</b><small>${ins.minutes} minutes talked</small></div>
      <div class="stat"><span>After-hours calls caught</span><b>${ins.afterHoursCalls}</b><small>would have been missed</small></div>
      <div class="stat"><span>Leads captured</span><b>${ins.leads}</b><small>${scores}</small></div>
    </div>
    <div class="grid-2">
      <div class="panel"><h2>Calls per day</h2>${barChart(ins.perDay)}</div>
      <div class="panel brief"><h2>Today's brief</h2>
        <ul>${brief.lines.map((l) => `<li>${h(l)}</li>`).join("")}</ul>
        <p class="muted small">${state.org.ownerPhone ? `Sent to ${h(state.org.ownerPhone)} every evening at ${state.org.briefHour ?? 20}:00.` : `<a href="#settings">Add your mobile number</a> to get this on WhatsApp every evening.`}</p>
        ${ins.openQuestions ? `<a class="btn" href="#questions">Answer ${ins.openQuestions} question${ins.openQuestions === 1 ? "" : "s"} →</a>` : ""}
      </div>
    </div>
    <div class="grid-2">
      <div class="panel"><div class="panel-head"><h2>Alerts</h2>${alerts.some((a) => !a.seen) ? `<button class="btn small" id="seen">Mark all read</button>` : ""}</div>
        ${alerts.length ? `<ul class="alerts">${alerts.slice(0, 8).map((a) => `<li class="${a.seen ? "" : "unseen"}">${a.urgent ? pill("Urgent", "bad") : ""} <b>${h(a.title)}</b><br><span class="muted">${h(a.body)}</span><br><small class="muted">${fmtDate(a.createdAt)}${a.callId ? ` · <a href="#call/${h(a.callId)}">View call</a>` : ""}</small></li>`).join("")}</ul>` : emptyState("No alerts. Urgent calls, hot leads and unhappy callers will show up here.")}
      </div>
      <div class="panel"><h2>Plan usage</h2>
        <p><b>${h(u.planLabel)}</b> · ${Math.round(u.minutesUsed)} ${u.minutesIncluded ? `of ${u.minutesIncluded}` : ""} minutes this month</p>
        ${u.minutesIncluded ? `<div class="meter" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>` : ""}
        <h2 style="margin-top:18px">What callers wanted</h2>
        ${Object.keys(ins.intents).length ? `<div class="chips">${Object.entries(ins.intents).sort((a, b) => b[1] - a[1]).map(([k, v]) => pill(`${k.replace(/_/g, " ")} · ${v}`, "grey")).join(" ")}</div>` : `<p class="muted">Appears after your first analysed calls.</p>`}
      </div>
    </div>
    <div class="panel"><h2>Recent calls</h2>${callsTable(calls.slice(0, 6))}</div>`);
  bindChart(ins.perDay);
  bindRowLinks();
  const seen = document.getElementById("seen");
  if (seen) seen.onclick = async () => { await api("POST", "/alerts/seen"); toast("Marked as read"); location.reload(); };
});

// ---------- live calls ----------
route("live", async () => {
  const render = async () => {
    const calls = await api("GET", "/calls?status=live");
    state.badges.live = calls.length;
    const main = document.getElementById("live-list");
    if (!main) return;
    main.innerHTML = calls.length
      ? calls.map((c) => `
        <div class="panel live-call">
          <div class="panel-head"><div><b>${h(c.agentName)}</b> ${pill(c.channel === "phone" ? (c.direction === "outbound" ? "Campaign call" : "Phone") : c.channel === "widget" ? "Website" : "Test", c.channel === "phone" ? "live" : "grey")}<br><span class="muted">${h(c.callerNumber || "Visitor")} · started ${fmtDate(c.createdAt)}</span></div>
          ${c.channel === "phone" ? (c.takeover ? pill("Transferring to you…", "warm") : `<button class="btn btn-primary" data-takeover="${h(c.id)}">Take over call</button>`) : ""}</div>
          <div class="transcript compact">${c.transcript.slice(-6).map((t) => `<div class="line ${t.role}"><span class="who">${t.role === "agent" ? "AI" : "Caller"}</span><span>${h(t.text)}</span></div>`).join("")}</div>
        </div>`).join("")
      : emptyState("No calls right now. This page updates by itself every few seconds.");
    main.querySelectorAll("[data-takeover]").forEach((b) => {
      b.onclick = async () => {
        try { await api("POST", `/calls/${b.dataset.takeover}/takeover`); toast("You'll be connected when the caller next finishes speaking"); render(); } catch (e) { toast(e.message); }
      };
    });
  };
  shell("live", `<div class="page-head"><div><h1>Live calls <span class="pulse"></span></h1><p class="muted">Watch conversations as they happen. Tap "Take over" to have the call transferred to your phone.</p></div></div><div id="live-list"></div>`);
  await render();
  every(3000, render);
});
