// End-to-end tests for the advanced features, in demo mode (no API key needed).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/db.js";
import { createApp } from "../server/index.js";
import { transport } from "../server/messaging.js";
import { dialer } from "../server/telephony.js";
import { runTool } from "../server/tools.js";
import { sendBriefs, sendReminders, tick } from "../server/scheduler.js";
import { addDays, todayIn } from "../server/util.js";

delete process.env.ANTHROPIC_API_KEY;
delete process.env.TWILIO_AUTH_TOKEN;
process.env.ADMIN_EMAILS = "founder@voicedesk.in";
process.env.SIGNUP_RATE_LIMIT = "1000";

const db = new Store(null);
let server, base;
const sent = [];
transport.send = async (msg) => {
  sent.push(msg);
  return { status: "sent", providerId: "SM1" };
};

before(async () => {
  server = createApp(db).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function api(token, method, path, body) {
  const res = await fetch(base + "/api" + path, {
    method,
    headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const type = res.headers.get("content-type") || "";
  return { status: res.status, headers: res.headers, body: type.includes("json") ? await res.json() : await res.text() };
}
const twilio = (path, params) => fetch(base + path, { method: "POST", body: new URLSearchParams(params) }).then((r) => r.text());
const waitFor = async (fn, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("timed out");
};

async function business(email, templateId = "salon") {
  const { body } = await api(null, "POST", "/auth/signup", { businessName: `Biz ${email}`, name: "Owner", email, password: "password123" });
  const token = body.token;
  const agent = (await api(token, "POST", "/agents", { templateId })).body;
  return { token, org: body.org, agent };
}

function nextOpenDay(tz = "Asia/Kolkata") {
  let d = addDays(todayIn(tz), 1);
  while (new Date(`${d}T12:00:00Z`).getUTCDay() === 0) d = addDays(d, 1);
  return d;
}

test("caller memory: returning callers are recognised and greeted by name", async () => {
  const { token, agent } = await business("memory@x.in");
  await api(token, "PUT", `/agents/${agent.id}`, { phoneNumber: "+918000000001" });

  const first = await twilio("/twilio/voice", { To: "+918000000001", From: "09876543210", CallSid: "M1" });
  const callId = first.match(/gather\/([\w-]+)/)[1];
  const call = db.get("calls", callId);
  assert.equal(call.callerNumber, "+919876543210");
  const date = nextOpenDay();
  runTool(db, db.get("agents", agent.id), call, "book_appointment", {
    customer_name: "Ravi Kumar", phone: "+91 98765 43210", date, time: "11:00", service: "Haircut", notes: "",
  });

  const second = await twilio("/twilio/voice", { To: "+918000000001", From: "+919876543210", CallSid: "M2" });
  assert.match(second, /Welcome back, Ravi!/);
  const customers = (await api(token, "GET", "/customers")).body;
  assert.equal(customers.length, 1);
  assert.equal(customers[0].calls, 2);
  assert.equal(customers[0].bookings, 1);
  assert.equal(customers[0].value, 450);
});

test("appointment self-service only touches the caller's own bookings", async () => {
  const { agent: a } = await business("selfserve@x.in");
  const agent = db.get("agents", a.id);
  const date = nextOpenDay();
  const ravi = { id: "c-ravi", channel: "phone", callerNumber: "+919811111111" };
  const priya = { id: "c-priya", channel: "phone", callerNumber: "+919822222222" };
  const booked = runTool(db, agent, ravi, "book_appointment", { customer_name: "Ravi", phone: "+919811111111", date, time: "10:00", service: "Facial", notes: "" });
  const ref = booked.result.match(/Reference (\w+)/)[1];

  assert.match(runTool(db, agent, priya, "find_appointments", { phone: "+919811111111", customer_name: "Ravi" }).result, /No upcoming/);
  assert.match(runTool(db, agent, priya, "cancel_appointment", { reference: ref }).result, /not found/);
  assert.match(runTool(db, agent, ravi, "find_appointments", { phone: "", customer_name: "" }).result, new RegExp(ref));
  assert.match(runTool(db, agent, ravi, "reschedule_appointment", { reference: ref, date, time: "15:00" }).result, /Moved/);
  assert.match(runTool(db, agent, ravi, "cancel_appointment", { reference: ref }).result, /Cancelled/);

  // Web chats must prove ownership with phone + name before changing anything.
  const appt2 = runTool(db, agent, ravi, "book_appointment", { customer_name: "Ravi", phone: "+919811111111", date, time: "12:00", service: "Facial", notes: "" });
  const ref2 = appt2.result.match(/Reference (\w+)/)[1];
  const web = { id: "c-web", channel: "web" };
  assert.match(runTool(db, agent, web, "cancel_appointment", { reference: ref2 }).result, /not found/);
  runTool(db, agent, web, "find_appointments", { phone: "9811111111", customer_name: "ravi" });
  assert.match(runTool(db, agent, web, "cancel_appointment", { reference: ref2 }).result, /Cancelled/);

  const kinds = sent.filter((m) => m.to === "+919811111111").map((m) => m.kind);
  assert.deepEqual(kinds, ["booking_confirmed", "booking_moved", "booking_cancelled", "booking_confirmed"]);
});

test("knowledge gaps: unanswered questions become answers the receptionist uses", async () => {
  const { token, agent } = await business("gaps@x.in");
  const { callId } = (await api(token, "POST", `/agents/${agent.id}/test`)).body;
  await api(token, "POST", `/calls/${callId}/say`, { text: "Do you have parking?" });
  await api(token, "POST", `/agents/${agent.id}/test`).then(async ({ body }) => api(token, "POST", `/calls/${body.callId}/say`, { text: "do you have parking?" }));

  const open = (await api(token, "GET", "/questions")).body;
  assert.equal(open.length, 1);
  assert.equal(open[0].count, 2);
  const answered = await api(token, "POST", `/questions/${open[0].id}/answer`, { answer: "Yes, free parking behind the salon." });
  assert.equal(answered.body.status, "answered");
  const updated = (await api(token, "GET", `/agents/${agent.id}`)).body;
  assert.deepEqual(updated.faqs.at(-1), { q: "Do you have parking?", a: "Yes, free parking behind the salon." });
  assert.equal((await api(token, "GET", "/questions")).body.length, 0);

  const { buildSystemPrompt } = await import("../server/agent.js");
  assert.match(buildSystemPrompt(db, db.get("agents", agent.id), { transcript: [] }), /free parking behind the salon/);
});

test("post-call analysis scores leads and alerts the owner", async () => {
  const { token, agent } = await business("analysis@x.in");
  await api(token, "PUT", "/settings", { ownerPhone: "98000 00099" });
  const { callId } = (await api(token, "POST", `/agents/${agent.id}/test`)).body;
  const call = db.get("calls", callId);
  runTool(db, db.get("agents", agent.id), call, "save_lead", { customer_name: "Asha", phone: "+919800000000", interest: "Bridal package", notes: "Wedding in March" });
  await api(token, "POST", `/calls/${callId}/say`, { text: "This is the worst service, I'm angry" });
  await api(token, "POST", `/calls/${callId}/end`);

  const analysed = await waitFor(async () => (await api(token, "GET", `/calls/${callId}`)).body.analysis);
  assert.equal(analysed.sentiment, "negative");
  assert.equal(analysed.leadScore, "warm");
  assert.equal((await api(token, "GET", "/leads")).body[0].score, "warm");
  const alerts = (await api(token, "GET", "/alerts")).body;
  assert.ok(alerts.some((a) => a.kind === "alert" && a.urgent)); // demo brain escalated "angry"
  assert.ok(alerts.some((a) => a.kind === "unhappy_caller"));
});

test("insights report revenue in rupees and the daily brief goes to the owner", async () => {
  const { token, org, agent } = await business("roi@x.in");
  await api(token, "PUT", "/settings", { ownerPhone: "+919800000077" });
  const fresh = db.get("agents", agent.id);
  const call = { id: "roi-call", channel: "phone", callerNumber: "+919800000001" };
  const date = nextOpenDay();
  runTool(db, fresh, call, "book_appointment", { customer_name: "A", phone: "+919800000001", date, time: "10:00", service: "Hair colour", notes: "" });
  runTool(db, fresh, call, "book_appointment", { customer_name: "B", phone: "+919800000002", date, time: "10:30", service: "facial", notes: "" });

  const ins = (await api(token, "GET", "/insights")).body;
  assert.equal(ins.bookings, 2);
  assert.equal(ins.estimatedRevenue, 2300);
  assert.equal(ins.perDay.length, 14);
  assert.equal(ins.perDay.at(-1).bookings, 2);

  // 20:30 India time = 15:00 UTC.
  const evening = new Date(`${todayIn("Asia/Kolkata")}T15:00:00Z`);
  sendBriefs(db, evening);
  sendBriefs(db, evening); // only once per day
  const briefs = db.find("messages", (m) => m.orgId === org.id && m.kind === "owner_brief");
  assert.equal(briefs.length, 1);
  assert.equal(briefs[0].to, "+919800000077");
});

test("reminders go out about a day before, once", async () => {
  const { agent } = await business("remind@x.in");
  const a = db.get("agents", agent.id);
  const date = nextOpenDay();
  runTool(db, a, { id: "r1", channel: "phone", callerNumber: "+919811100000" }, "book_appointment", { customer_name: "R", phone: "+919811100000", date, time: "17:00", service: "Haircut", notes: "" });
  // Two days before: nothing. 20 hours before: one reminder.
  sendReminders(db, new Date(Date.parse(`${date}T17:00:00+05:30`) - 48 * 3600e3));
  assert.equal(db.find("messages", (m) => m.kind === "reminder" && m.to === "+919811100000").length, 0);
  const near = new Date(Date.parse(`${date}T17:00:00+05:30`) - 20 * 3600e3);
  sendReminders(db, near);
  sendReminders(db, near);
  assert.equal(db.find("messages", (m) => m.kind === "reminder" && m.to === "+919811100000").length, 1);
});

test("live takeover transfers the caller to the owner", async () => {
  const { token, agent } = await business("live@x.in");
  await api(token, "PUT", `/agents/${agent.id}`, { phoneNumber: "+918000000002" });
  const xml = await twilio("/twilio/voice", { To: "+918000000002", From: "+919700000000", CallSid: "L1" });
  const callId = xml.match(/gather\/([\w-]+)/)[1];
  assert.equal((await api(token, "GET", "/calls?status=live")).body.length, 1);
  assert.equal((await api(token, "POST", `/calls/${callId}/takeover`)).status, 400); // no owner phone yet
  await api(token, "PUT", "/settings", { ownerPhone: "+919700000099" });
  assert.equal((await api(token, "POST", `/calls/${callId}/takeover`)).status, 200);
  const next = await twilio(`/twilio/gather/${callId}`, { SpeechResult: "hello" });
  assert.match(next, /<Dial>\+919700000099<\/Dial>/);
  assert.equal(db.get("calls", callId).outcome, "taken-over");
});

test("plans: agent limits, and callers are passed to a person when minutes run out", async () => {
  const { token, org, agent } = await business("limits@x.in");
  assert.equal((await api(token, "POST", "/agents", { templateId: "clinic" })).status, 403); // trial = 1 receptionist
  await api(token, "PUT", "/settings", { ownerPhone: "+919600000001" });
  await api(token, "PUT", `/agents/${agent.id}`, { phoneNumber: "+918000000003" });
  db.insert("calls", { orgId: org.id, agentId: agent.id, channel: "phone", status: "ended", durationSec: 61 * 60, transcript: [] });
  const xml = await twilio("/twilio/voice", { To: "+918000000003", From: "+919600000002", CallSid: "P1" });
  assert.match(xml, /<Dial>\+919600000001<\/Dial>/);
  assert.ok(db.find("alerts", (a) => a.orgId === org.id && a.kind === "limit").length);
});

test("campaigns: consent, calling hours, do-not-call and AI disclosure are enforced", async () => {
  const { token, org, agent } = await business("campaign@x.in");
  const draft = { agentId: agent.id, name: "Win-back", goal: "Invite lapsed customers back with 10% off", openingLine: "We miss you! Would you like to book a visit?", contacts: "Meena, 98111 22233\n+919811122234\nbad line\n98111 22233" };
  assert.equal((await api(token, "POST", "/campaigns", draft)).status, 400); // no consent
  assert.equal((await api(token, "POST", "/campaigns", { ...draft, consentConfirmed: true, windowStart: "07:00" })).status, 400);
  const created = await api(token, "POST", "/campaigns", { ...draft, consentConfirmed: true, maxConcurrent: 5 });
  assert.equal(created.status, 201);
  assert.equal(created.body.contacts.length, 2); // de-duplicated, junk dropped

  // Second contact previously asked not to be called.
  db.insert("customers", { orgId: org.id, phone: "+919811122234", name: "", calls: 1, doNotCall: true });

  const placed = [];
  dialer.call = async (args) => {
    placed.push(args);
    return { ok: true, sid: `CA-out-${placed.length}` };
  };
  await api(token, "POST", `/campaigns/${created.body.id}/start`);
  const night = new Date(`${addDays(todayIn("Asia/Kolkata"), 0)}T17:30:00Z`); // 23:00 IST
  await tick(db, night);
  assert.equal(placed.length, 0);

  let morning = new Date(`${todayIn("Asia/Kolkata")}T05:30:00Z`); // 11:00 IST
  while (morning.getUTCDay() === 0) morning = new Date(morning.getTime() + 864e5);
  await tick(db, morning);
  assert.equal(placed.length, 1);
  assert.equal(placed[0].to, "+919811122233");
  const c = (await api(token, "GET", `/campaigns/${created.body.id}`)).body;
  assert.deepEqual([c.stats.calling, c.stats.skipped], [1, 1]);

  const callId = c.contacts[0].callId;
  const opening = await twilio(`/twilio/outbound/${callId}`, { CallSid: "CA-out-1" });
  assert.match(opening, /Hello Meena, this is an AI assistant calling from Biz campaign@x.in/);
  const bye = await twilio(`/twilio/gather/${callId}`, { SpeechResult: "Please don't call me again" });
  assert.match(bye, /<Hangup\/>/);
  const done = (await api(token, "GET", `/campaigns/${created.body.id}`)).body;
  assert.equal(done.status, "completed");
  assert.equal(db.find("customers", (x) => x.orgId === org.id && x.phone === "+919811122233")[0].doNotCall, true);
});

test("website widget: public chat with secrets, CORS and rate limits", async () => {
  const { token, agent } = await business("widget@x.in");
  const pub = db.get("agents", agent.id).publicId;
  assert.equal((await api(null, "POST", `/public/agents/${pub}/sessions`)).status, 404); // widget off
  await api(token, "PUT", `/agents/${agent.id}`, { widgetEnabled: true });
  const s = await api(null, "POST", `/public/agents/${pub}/sessions`);
  assert.equal(s.status, 201);
  assert.equal(s.headers.get("access-control-allow-origin"), "*");
  assert.equal((await api(null, "POST", `/public/sessions/${s.body.sessionId}/say`, { secret: "wrong", text: "hi" })).status, 404);
  const reply = await api(null, "POST", `/public/sessions/${s.body.sessionId}/say`, { secret: s.body.secret, text: "What are your timings" });
  assert.match(reply.body.reply, /Demo mode/);
  assert.equal(db.get("calls", s.body.sessionId).channel, "widget");
  assert.equal(db.get("calls", s.body.sessionId).widgetSecretHash.length, 64);
  const asOwner = (await api(token, "GET", `/calls/${s.body.sessionId}`)).body;
  assert.equal(asOwner.channel, "widget");
  assert.equal(asOwner.widgetSecretHash, undefined); // the chat secret never leaves the server
});

test("Test Lab runs simulated callers, scores them and cleans up", async () => {
  const { token, agent } = await business("lab@x.in");
  const run = await api(token, "POST", `/agents/${agent.id}/simulations`, { personas: ["booker", "offscript", "angry"] });
  assert.equal(run.status, 202);
  const done = await waitFor(async () => {
    const [latest] = (await api(token, "GET", `/agents/${agent.id}/simulations`)).body;
    return latest.status === "done" && latest;
  });
  assert.equal(done.results.length, 3);
  assert.equal(done.score, 50);
  assert.ok(done.results[0].transcript.length >= 3);
  assert.equal(db.find("calls", (c) => c.channel === "simulation").length, 0);
  assert.equal(db.find("alerts", (a) => a.orgId === agent.orgId).length, 0);
  // Questions it uncovered are kept as real knowledge gaps.
  const qs = (await api(token, "GET", "/questions")).body;
  assert.ok(qs.some((q) => q.source === "test_lab" && /parking/i.test(q.question)));
});

test("AI setup assistant proposes services with prices from notes", async () => {
  const { token, agent } = await business("autofill@x.in");
  const bad = await api(token, "POST", `/agents/${agent.id}/autofill`, { url: "javascript:alert(1)" });
  assert.equal(bad.status, 400);
  const res = await api(token, "POST", `/agents/${agent.id}/autofill`, { notes: "Haircut ₹350\nBeard trim - Rs 150\nOpen 10 to 8" });
  assert.deepEqual(res.body.services, [{ name: "Haircut", price: 350 }, { name: "Beard trim", price: 150 }]);
  assert.match(res.body.greeting, /Biz autofill@x\.in/);
});

test("admin console, CSV export and customer erasure", async () => {
  const owner = await business("founder@voicedesk.in");
  const other = await business("someone@x.in");
  assert.equal((await api(other.token, "GET", "/admin/orgs")).status, 403);
  const orgs = (await api(owner.token, "GET", "/admin/orgs")).body;
  assert.ok(orgs.length >= 10);
  assert.equal((await api(owner.token, "PUT", `/admin/orgs/${other.org.id}`, { plan: "growth" })).body.plan, "growth");
  assert.equal((await api(other.token, "POST", "/agents", { templateId: "clinic" })).status, 201); // growth = 3 receptionists

  const agent = db.get("agents", other.agent.id);
  runTool(db, agent, { id: "x1", channel: "phone", callerNumber: "+919500000001" }, "save_lead", { customer_name: "=HYPERLINK(1)", phone: "+919500000001", interest: "Colour", notes: "" });
  const csv = (await api(other.token, "GET", "/export/leads")).body;
  assert.match(csv, /^createdAt,customerName/);
  assert.match(csv, /'=HYPERLINK/); // formula injection neutralised

  const cust = db.insert("customers", { orgId: other.org.id, phone: "+919500000001", name: "X", calls: 1 });
  db.insert("calls", { orgId: other.org.id, agentId: agent.id, channel: "phone", callerNumber: "+919500000001", transcript: [], status: "ended" });
  const erased = await api(other.token, "DELETE", `/customers/${cust.id}`);
  assert.deepEqual(erased.body.removed, { appointments: 0, leads: 1, messages: 0, calls: 1 });
  assert.equal((await api(other.token, "GET", "/leads")).body.length, 0);
  assert.equal((await api(owner.token, "DELETE", `/customers/${cust.id}`)).status, 404);
});

test("bookings made in browser tests never message real numbers or count as revenue", async () => {
  const { token, agent } = await business("testbook@x.in");
  const a = db.get("agents", agent.id);
  const date = nextOpenDay();
  runTool(db, a, { id: "t-web", channel: "web" }, "book_appointment", { customer_name: "Test", phone: "+919000011111", date, time: "16:00", service: "Hair colour", notes: "" });
  sendReminders(db, new Date(Date.parse(`${date}T16:00:00+05:30`) - 20 * 3600e3));
  assert.equal(db.find("messages", (m) => m.to === "+919000011111" && m.status !== "test").length, 0);
  assert.equal((await api(token, "GET", "/insights")).body.estimatedRevenue, 0);
  assert.equal((await api(token, "GET", "/appointments")).body.length, 1); // still visible to the owner
});
