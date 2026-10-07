// Campaigns, Settings (business, notifications, plan, phone setup) and the
// platform admin console.
import { api, bindRowLinks, emptyState, fmtDate, h, pill, refreshMe, route, rupees, shell, state, toast } from "../core.js";

const STATUS_TONE = { running: "live", draft: "grey", paused: "warm", completed: "" };

route("campaigns", async (id) => {
  if (id === "new") return newCampaign();
  if (id) return campaignDetail(id);
  const rows = await api("GET", "/campaigns");
  shell("campaigns", `
    <div class="page-head"><div><h1>Campaigns</h1><p class="muted">Your receptionist calls customers for you: win-backs, reminders, feedback. Consent, calling hours and do-not-call are enforced automatically.</p></div>
      ${state.usage.campaigns ? `<a class="btn btn-primary" href="#campaigns/new">New campaign</a>` : ""}</div>
    ${state.usage.campaigns ? "" : `<div class="banner">Campaigns are part of the Growth plan. <a href="#settings">See plans</a></div>`}
    <div class="panel">${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Status</th><th>Progress</th><th>Created</th></tr></thead><tbody>
      ${rows.map((c) => `<tr class="click" data-href="#campaigns/${h(c.id)}"><td>${h(c.name)}</td><td>${pill(c.status, STATUS_TONE[c.status])}</td><td>${c.stats.done + c.stats.failed + c.stats.skipped} / ${c.stats.total} contacted</td><td>${fmtDate(c.createdAt)}</td></tr>`).join("")}
    </tbody></table></div>` : emptyState("No campaigns yet. Try a win-back campaign for customers you haven't heard from in a while.")}</div>`);
  bindRowLinks();
});

async function newCampaign() {
  const agents = await api("GET", "/agents");
  const org = state.org.name;
  shell("campaigns", `
    <div class="page-head"><div><a href="#campaigns">← Campaigns</a><h1>New campaign</h1></div></div>
    <form class="panel" id="camp">
      <div class="row">
        <label>Campaign name<input name="name" required placeholder="Win-back: October"></label>
        <label>Receptionist making the calls<select name="agentId">${agents.map((a) => `<option value="${h(a.id)}">${h(a.name)}</option>`).join("")}</select></label>
      </div>
      <label>Goal of the call <span class="hint">— what the receptionist should achieve</span><textarea name="goal" required placeholder="Invite customers who haven't visited in 2 months back with 10% off this week. Offer to book a slot."></textarea></label>
      <label>Opening line <span class="hint">— said after "Hello [name], this is an AI assistant calling from ${h(org)}." (added automatically)</span><input name="openingLine" required placeholder="We've missed you! We have a special offer this week. Do you have a minute?"></label>
      <label>Contacts <span class="hint">— one per line: name, phone</span><textarea name="contacts" required style="min-height:140px" placeholder="Meena, 98111 22233&#10;Arjun, +91 98111 22234"></textarea></label>
      <div class="row-between"><span class="muted small">Quick fill:</span><span><button type="button" class="btn small" data-lapsed="30">Not called in 30 days</button> <button type="button" class="btn small" data-lapsed="60">60 days</button> <button type="button" class="btn small" data-lapsed="90">90 days</button></span></div>
      <div class="row" style="margin-top:14px">
        <label>Call from<input type="time" name="windowStart" value="10:00" min="09:00" max="21:00"></label>
        <label>Until<input type="time" name="windowEnd" value="19:00" min="09:00" max="21:00"></label>
      </div>
      <label class="check consent"><input type="checkbox" name="consentConfirmed" required> I confirm every contact has agreed to receive calls from ${h(org)}, and I'm responsible for following telemarketing rules (TRAI / DND).</label>
      <p class="error" id="err" role="alert"></p>
      <div class="save-bar"><button class="btn btn-primary">Create campaign</button></div>
    </form>`);
  const form = document.getElementById("camp");
  form.querySelectorAll("[data-lapsed]").forEach((b) => {
    b.onclick = async () => {
      const people = await api("GET", `/campaigns/audience/lapsed?days=${b.dataset.lapsed}`);
      form.contacts.value = people.map((p) => `${p.name || ""}, ${p.phone}`).join("\n");
      toast(`${people.length} customer${people.length === 1 ? "" : "s"} added`);
    };
  });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    body.consentConfirmed = form.consentConfirmed.checked;
    try {
      const c = await api("POST", "/campaigns", body);
      location.hash = `#campaigns/${c.id}`;
    } catch (err) {
      document.getElementById("err").textContent = err.message;
    }
  };
}

async function campaignDetail(id) {
  const c = await api("GET", `/campaigns/${id}`);
  const s = c.stats;
  shell("campaigns", `
    <div class="page-head"><div><a href="#campaigns">← Campaigns</a><h1>${h(c.name)} ${pill(c.status, STATUS_TONE[c.status])}</h1><p class="muted">Calls ${h(c.window.start)}–${h(c.window.end)}, up to ${c.maxConcurrent} at a time. Consent confirmed by ${h(c.consentConfirmedBy)}.</p></div>
      <div>${c.status === "running" ? `<button class="btn" id="pause">Pause</button>` : c.status !== "completed" ? `<button class="btn btn-primary" id="start">Start calling</button>` : ""}</div></div>
    ${c.lastError ? `<div class="banner bad">${h(c.lastError)}</div>` : ""}
    <div class="stats"><div class="stat"><span>Contacts</span><b>${s.total}</b></div><div class="stat"><span>Reached</span><b>${s.done}</b></div><div class="stat"><span>No answer / failed</span><b>${s.failed}</b></div><div class="stat"><span>Skipped (do not call)</span><b>${s.skipped}</b></div></div>
    <div class="panel"><p><b>Goal:</b> ${h(c.goal)}</p><p><b>Opening:</b> "Hello [name], this is an AI assistant calling from ${h(state.org.name)}. ${h(c.openingLine)}"</p></div>
    <div class="panel"><div class="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Status</th><th>Result</th></tr></thead><tbody>
      ${c.contacts.map((x) => `<tr ${x.callId && x.status !== "pending" ? `class="click" data-href="#call/${h(x.callId)}"` : ""}><td>${h(x.name)}</td><td>${h(x.phone)}</td><td>${pill(x.status, x.status === "done" ? "" : x.status === "calling" ? "live" : "grey")}</td><td>${h(x.result)}</td></tr>`).join("")}
    </tbody></table></div></div>`);
  bindRowLinks();
  for (const action of ["start", "pause"]) {
    const b = document.getElementById(action);
    if (b) b.onclick = async () => { try { await api("POST", `/campaigns/${c.id}/${action}`); campaignDetail(id); } catch (e) { toast(e.message); } };
  }
}

// ---------- settings ----------
route("settings", async () => {
  await refreshMe();
  const o = state.org, u = state.usage;
  const base = location.origin;
  shell("settings", `
    <div class="page-head"><div><h1>Settings</h1></div></div>
    <div class="grid-2">
      <form class="panel" id="settings">
        <h2>Business & notifications</h2>
        <label>Business name<input name="name" value="${h(o.name)}"></label>
        <label>Your mobile <span class="hint">— for urgent alerts, call takeovers and the daily brief</span><input name="ownerPhone" value="${h(o.ownerPhone)}" placeholder="+91…"></label>
        <label>Send customers follow-ups by<select name="followUpChannel">${[["whatsapp", "WhatsApp"], ["sms", "SMS"], ["off", "Don't send follow-ups"]].map(([v, l]) => `<option value="${v}" ${o.followUpChannel === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="check"><input type="checkbox" name="alertsEnabled" ${o.alertsEnabled !== false ? "checked" : ""}> Message me about urgent calls, hot leads and unhappy callers</label>
        <label class="check"><input type="checkbox" name="briefEnabled" ${o.briefEnabled !== false ? "checked" : ""}> Send me a daily brief at <input type="number" name="briefHour" min="0" max="23" value="${o.briefHour ?? 20}" style="width:70px;display:inline-block;margin:0 4px"> :00</label>
        <label>Time zone<input name="timeZone" value="${h(o.timeZone || "Asia/Kolkata")}"></label>
        <p class="error" id="err" role="alert"></p>
        <div class="save-bar"><button class="btn btn-primary">Save settings</button></div>
      </form>
      <div class="panel">
        <h2>Plan & usage</h2>
        <p><b>${h(u.planLabel)}</b> · ${Math.round(u.minutesUsed)} ${u.minutesIncluded ? `of ${u.minutesIncluded}` : ""} minutes used this month${o.plan === "trial" && o.trialEndsAt ? ` · trial ends ${fmtDate(o.trialEndsAt)}` : ""}</p>
        <div class="plans">${state.catalog.plans.filter((p) => p.id !== "trial").map((p) => `
          <div class="plan ${o.plan === p.id ? "current" : ""}"><b>${h(p.label)}</b><span class="price">${p.priceInr ? `${rupees(p.priceInr)}/mo` : "Custom"}</span>
          <small>${p.minutes ? `${p.minutes} min` : "Volume minutes"} · ${p.agents ? `${p.agents} receptionist${p.agents > 1 ? "s" : ""}` : "Unlimited receptionists"}${p.campaigns ? " · campaigns" : ""}</small>
          ${o.plan === p.id ? pill("Current", "") : `<a class="btn small" href="mailto:sales@example.com?subject=Upgrade%20${encodeURIComponent(o.name)}%20to%20${p.label}">Upgrade</a>`}</div>`).join("")}</div>
      </div>
    </div>
    <div class="panel">
      <h2>Phone setup</h2>
      <ol class="steps">
        <li>Create a <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener">Twilio</a> account and buy a phone number with <b>Voice</b> enabled.</li>
        <li>In Twilio, open the number. Under <b>A call comes in</b>, choose <b>Webhook</b> → <code>${h(base)}/twilio/voice</code> (HTTP POST).</li>
        <li>Set <b>Call status changes</b> to <code>${h(base)}/twilio/status</code>.</li>
        <li>Enter the number in your receptionist's <b>Phone & website</b> tab, then call it from your mobile.</li>
        <li><b>Keep your existing number:</b> forward it to the Twilio number when busy, unanswered or after hours.</li>
      </ol>
    </div>`);
  const form = document.getElementById("settings");
  form.onsubmit = async (e) => {
    e.preventDefault();
    try {
      state.org = await api("PUT", "/settings", {
        name: form.name.value, ownerPhone: form.ownerPhone.value, followUpChannel: form.followUpChannel.value,
        alertsEnabled: form.alertsEnabled.checked, briefEnabled: form.briefEnabled.checked, briefHour: Number(form.briefHour.value), timeZone: form.timeZone.value.trim(),
      });
      toast("Saved");
    } catch (err) {
      document.getElementById("err").textContent = err.message;
    }
  };
});

// ---------- platform admin ----------
route("admin", async () => {
  const orgs = await api("GET", "/admin/orgs");
  const plans = state.catalog.plans;
  shell("admin", `
    <div class="page-head"><div><h1>Platform admin</h1><p class="muted">${orgs.length} businesses on VoiceDesk.</p></div></div>
    <div class="panel"><div class="table-wrap"><table><thead><tr><th>Business</th><th>Owner</th><th>Joined</th><th>Receptionists</th><th>Calls</th><th>Bookings</th><th>Minutes (month)</th><th>Plan</th></tr></thead><tbody>
      ${orgs.map((o) => `<tr><td>${h(o.name)}</td><td>${h(o.owner)}</td><td>${fmtDate(o.createdAt)}</td><td>${o.agents}</td><td>${o.calls}</td><td>${o.bookings}</td><td>${Math.round(o.usage.minutesUsed)}${o.usage.minutesIncluded ? ` / ${o.usage.minutesIncluded}` : ""}</td>
        <td><select data-org="${h(o.id)}" aria-label="Plan">${plans.map((p) => `<option value="${p.id}" ${p.id === o.plan ? "selected" : ""}>${h(p.label)}</option>`).join("")}</select></td></tr>`).join("")}
    </tbody></table></div></div>`);
  document.querySelectorAll("select[data-org]").forEach((s) => {
    s.onchange = async () => { await api("PUT", `/admin/orgs/${s.dataset.org}`, { plan: s.value }); toast("Plan updated"); };
  });
});
