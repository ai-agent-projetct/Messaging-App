// Calls, call detail, "Teach it" (knowledge gaps), bookings, leads,
// customers and the message outbox.
import { api, bindRowLinks, download, emptyState, fmtDate, fmtDuration, h, pill, refreshBadges, route, rupees, shell, state, toast, tone } from "../core.js";

const CHANNEL = { phone: "Phone", web: "Test", widget: "Website" };

export function callsTable(calls) {
  if (!calls.length) return emptyState("No calls yet. Make a test call from a receptionist's page.");
  return `<div class="table-wrap"><table><thead><tr><th>When</th><th>Caller</th><th>Receptionist</th><th>Summary</th><th>Lead</th><th>Mood</th><th>Length</th></tr></thead><tbody>
    ${calls.map((c) => `<tr class="click" data-href="#call/${h(c.id)}">
      <td>${fmtDate(c.createdAt)}</td>
      <td>${c.callerNumber ? h(c.callerNumber) : pill(CHANNEL[c.channel] || c.channel, "grey")}${c.direction === "outbound" ? ` ${pill("Outbound", "grey")}` : ""}</td>
      <td>${h(c.agentName)}</td>
      <td class="wrap">${h(c.analysis?.summary || c.summary || c.lastLine)}</td>
      <td>${c.analysis?.leadScore && c.analysis.leadScore !== "none" ? pill(c.analysis.leadScore, tone(c.analysis.leadScore)) : ""}</td>
      <td>${c.analysis ? pill(c.analysis.sentiment, tone(c.analysis.sentiment)) : c.status === "live" ? pill("Live", "live") : ""}</td>
      <td>${fmtDuration(c.durationSec)}</td></tr>`).join("")}
    </tbody></table></div>`;
}

const exportBtn = (table) => `<button class="btn small" data-export="${table}">Export CSV</button>`;
function bindExports() {
  document.querySelectorAll("[data-export]").forEach((b) => (b.onclick = () => download(`/export/${b.dataset.export}`, `voicedesk-${b.dataset.export}.csv`)));
}

route("calls", async () => {
  const calls = await api("GET", "/calls");
  shell("calls", `<div class="page-head"><div><h1>Calls</h1><p class="muted">Every conversation with a transcript, AI summary, lead score and mood.</p></div>${exportBtn("calls")}</div><div class="panel">${callsTable(calls)}</div>`);
  bindRowLinks();
  bindExports();
});

route("call", async (id) => {
  const c = await api("GET", `/calls/${id}`);
  const a = c.analysis;
  shell("calls", `
    <div class="page-head"><div><a href="#calls">← Calls</a><h1>Call with ${h(c.agentName)}</h1>
      <p class="muted">${fmtDate(c.createdAt)} · ${c.callerNumber ? h(c.callerNumber) : CHANNEL[c.channel]} · ${fmtDuration(c.durationSec)} · ${h(c.outcome || c.status)}</p></div>
      ${c.customer ? `<a class="btn" href="#customer/${h(c.customer.id)}">Customer profile</a>` : ""}</div>
    ${a ? `<div class="panel analysis">
      <h2>AI analysis</h2><p>${h(a.summary)}</p>
      <div class="chips">${pill(`Intent: ${a.intent.replace(/_/g, " ")}`, "grey")} ${pill(`Mood: ${a.sentiment}`, tone(a.sentiment))} ${a.leadScore !== "none" ? pill(`Lead: ${a.leadScore}`, tone(a.leadScore)) : ""} ${pill(a.language, "grey")}</div>
      ${a.followUpNeeded && a.followUpNote ? `<p class="follow">👉 ${h(a.followUpNote)}</p>` : ""}
    </div>` : c.status === "ended" ? `<div class="banner">Analysis is being prepared…</div>` : ""}
    ${c.appointments.length ? `<div class="banner ok">📅 Booked: ${c.appointments.map((x) => `${h(x.service)} on ${h(x.date)} at ${h(x.time)} (${h(x.status)})`).join("; ")}</div>` : ""}
    <div class="panel transcript">${c.transcript.map((t) => `<div class="line ${t.role}"><span class="who">${t.role === "agent" ? "Receptionist" : "Caller"}</span><span>${h(t.text)}</span></div>`).join("")}</div>`);
});

// ---------- Teach it: questions the receptionist couldn't answer ----------
route("questions", async () => {
  const [open, answered] = await Promise.all([api("GET", "/questions"), api("GET", "/questions?status=answered")]);
  shell("questions", `
    <div class="page-head"><div><h1>Teach your receptionist</h1><p class="muted">Questions callers asked that it couldn't answer. Answer once, and every future caller gets it.</p></div></div>
    <div class="panel">${open.length ? open.map((q) => `
      <form class="teach" data-id="${h(q.id)}">
        <div class="row-between"><input name="question" value="${h(q.question)}" aria-label="Question"> ${q.count > 1 ? pill(`asked ${q.count}×`, "warm") : ""} ${q.source === "test_lab" ? pill("found by Test Lab", "grey") : ""}</div>
        <textarea name="answer" placeholder="Type the answer your receptionist should give…" style="min-height:60px"></textarea>
        <div class="save-bar"><button class="btn btn-primary">Teach this answer</button><button type="button" class="btn" data-dismiss>Not relevant</button></div>
      </form>`).join("") : emptyState("🎉 Nothing to teach right now. New questions appear here automatically.")}</div>
    ${answered.length ? `<div class="panel"><h2>Recently taught</h2><ul class="taught">${answered.slice(0, 10).map((q) => `<li><b>${h(q.question)}</b><br><span class="muted">${h(q.answer)}</span></li>`).join("")}</ul></div>` : ""}`);
  document.querySelectorAll("form.teach").forEach((f) => {
    f.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api("POST", `/questions/${f.dataset.id}/answer`, { question: f.question.value, answer: f.answer.value });
        toast("Taught! Your receptionist now knows this.");
        await refreshBadges();
        location.reload();
      } catch (err) { toast(err.message); }
    };
    f.querySelector("[data-dismiss]").onclick = async () => { await api("POST", `/questions/${f.dataset.id}/dismiss`); f.remove(); };
  });
});

// ---------- bookings & leads ----------
async function tableView(kind) {
  const rows = await api("GET", `/${kind}`);
  const bookings = kind === "appointments";
  const statuses = bookings ? ["confirmed", "completed", "cancelled", "no-show"] : ["new", "contacted", "won", "lost"];
  const head = bookings ? ["Date", "Time", "Customer", "Phone", "Service", "Value", "Ref", "Status"] : ["Received", "Customer", "Phone", "Interested in", "Notes", "Score", "Status"];
  const cells = (r) => bookings
    ? [h(r.date), h(r.time), h(r.customerName), h(r.phone), h(r.service), r.price ? rupees(r.price) : "—", h(r.ref)]
    : [fmtDate(r.createdAt), h(r.customerName), h(r.phone), h(r.interest), h(r.notes), r.score && r.score !== "none" ? pill(r.score, tone(r.score)) : ""];
  shell(kind, `
    <div class="page-head"><div><h1>${bookings ? "Bookings" : "Leads"}</h1><p class="muted">${bookings ? "Appointments booked by your receptionist. Customers get a confirmation and a reminder the day before." : "Callers to follow up with, scored hot / warm / cold by AI."}</p></div>${exportBtn(kind)}</div>
    <div class="panel">${rows.length ? `<div class="table-wrap"><table><thead><tr>${head.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>
      ${rows.map((r) => `<tr>${cells(r).map((x) => `<td>${x}</td>`).join("")}<td><select data-id="${h(r.id)}" aria-label="Status">${statuses.map((s) => `<option ${s === r.status ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`).join("")}
    </tbody></table></div>` : emptyState(bookings ? "Bookings appear here when callers book." : "Leads appear here when callers leave their details.")}</div>`);
  document.querySelectorAll("select[data-id]").forEach((sel) => {
    sel.onchange = async () => { await api("PATCH", `/${kind}/${sel.dataset.id}`, { status: sel.value }); toast("Updated"); };
  });
  bindExports();
}
route("appointments", () => tableView("appointments"));
route("leads", () => tableView("leads"));

// ---------- customers (caller memory) ----------
route("customers", async () => {
  const rows = await api("GET", "/customers");
  shell("customers", `
    <div class="page-head"><div><h1>Customers</h1><p class="muted">Everyone who has called. Your receptionist remembers them and greets returning callers by name.</p></div>${exportBtn("customers")}</div>
    <div class="panel">${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Calls</th><th>Bookings</th><th>Value</th><th>Last call</th><th></th></tr></thead><tbody>
      ${rows.map((c) => `<tr class="click" data-href="#customer/${h(c.id)}"><td>${h(c.name || "Unknown")}</td><td>${h(c.phone)}</td><td>${c.calls}</td><td>${c.bookings}</td><td>${rupees(c.value)}</td><td>${fmtDate(c.lastCallAt)}</td><td>${c.doNotCall ? pill("Do not call", "bad") : ""}</td></tr>`).join("")}
    </tbody></table></div>` : emptyState("Customers appear here after their first phone call.")}</div>`);
  bindRowLinks();
  bindExports();
});

route("customer", async (id) => {
  const c = await api("GET", `/customers/${id}`);
  shell("customers", `
    <div class="page-head"><div><a href="#customers">← Customers</a><h1>${h(c.name || c.phone)}</h1><p class="muted">${h(c.phone)} · ${c.calls} calls · first seen ${fmtDate(c.createdAt)}</p></div></div>
    <div class="grid-2">
      <form class="panel" id="cust">
        <h2>Profile</h2>
        <label>Name<input name="name" value="${h(c.name)}"></label>
        <label>Notes <span class="hint">— your receptionist sees these on their next call</span><textarea name="notes">${h(c.notes)}</textarea></label>
        <label class="check"><input type="checkbox" name="doNotCall" ${c.doNotCall ? "checked" : ""}> Do not call (excluded from all campaigns)</label>
        <div class="save-bar"><button class="btn btn-primary">Save</button><button type="button" class="btn btn-danger" id="erase">Erase all data</button></div>
      </form>
      <div class="panel"><h2>Bookings</h2>${c.appointments.length ? `<ul class="taught">${c.appointments.map((a) => `<li><b>${h(a.service)}</b> · ${h(a.date)} ${h(a.time)} ${pill(a.status, a.status === "confirmed" ? "" : "grey")}</li>`).join("")}</ul>` : `<p class="muted">No bookings yet.</p>`}</div>
    </div>
    <div class="panel"><h2>Calls</h2>${callsTable(c.calls)}</div>`);
  bindRowLinks();
  const form = document.getElementById("cust");
  form.onsubmit = async (e) => {
    e.preventDefault();
    await api("PATCH", `/customers/${c.id}`, { name: form.name.value, notes: form.notes.value, doNotCall: form.doNotCall.checked });
    toast("Saved");
  };
  document.getElementById("erase").onclick = async () => {
    if (!confirm("Permanently erase this customer and all their calls, bookings, leads and messages? This cannot be undone.")) return;
    await api("DELETE", `/customers/${c.id}`);
    toast("Customer data erased");
    location.hash = "#customers";
  };
});

// ---------- messages outbox ----------
route("messages", async () => {
  const rows = await api("GET", "/messages");
  const KIND = { booking_confirmed: "Booking confirmation", booking_moved: "Booking moved", booking_cancelled: "Booking cancelled", reminder: "Reminder", info: "Info sent on request", owner_brief: "Your daily brief", owner_alert: "Alert to you", owner_hot_lead: "Hot lead alert", owner_unhappy_caller: "Unhappy caller alert", owner_limit: "Plan limit alert" };
  const STATUS = { sent: "", queued: "grey", test: "grey", not_configured: "warm", failed: "bad" };
  shell("messages", `
    <div class="page-head"><div><h1>Messages</h1><p class="muted">WhatsApp and SMS sent automatically to customers and to you. Channel: <b>${h(state.org.followUpChannel)}</b> (<a href="#settings">change</a>).</p></div></div>
    ${rows.some((m) => m.status === "not_configured") ? `<div class="banner">Some messages weren't sent because WhatsApp/SMS isn't connected on the server yet. See <code>docs/LEARN.md</code> → Messaging.</div>` : ""}
    <div class="panel">${rows.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>To</th><th>Type</th><th>Message</th><th>Status</th></tr></thead><tbody>
      ${rows.map((m) => `<tr><td>${fmtDate(m.createdAt)}</td><td>${h(m.to)}<br><small class="muted">${h(m.channel)}</small></td><td>${h(KIND[m.kind] || m.kind)}</td><td class="wrap">${h(m.body)}</td><td>${pill(m.status.replace("_", " "), STATUS[m.status] ?? "grey")}${m.error ? `<br><small class="muted">${h(m.error)}</small>` : ""}</td></tr>`).join("")}
    </tbody></table></div>` : emptyState("No messages yet. Booking confirmations, reminders and alerts appear here.")}</div>`);
});
