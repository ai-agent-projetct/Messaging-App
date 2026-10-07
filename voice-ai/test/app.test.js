import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/db.js";
import { createApp } from "../server/index.js";
import { twilioSignature } from "../server/routes/twilio.js";
import { runTool, todayIn } from "../server/tools.js";

delete process.env.ANTHROPIC_API_KEY; // always demo mode in tests
delete process.env.TWILIO_AUTH_TOKEN;

const db = new Store(null);
let server, base, token;

before(async () => {
  server = createApp(db).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const api = async (method, path, body, headers = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }), ...headers },
    body: body && JSON.stringify(body),
  });
  const type = res.headers.get("content-type") || "";
  return { status: res.status, body: type.includes("json") ? await res.json() : await res.text() };
};

const twilio = (path, params) =>
  fetch(base + path, { method: "POST", body: new URLSearchParams(params) }).then((r) => r.text());

test("signup, login and auth protection", async () => {
  assert.equal((await api("GET", "/api/agents")).status, 401);
  const weak = await api("POST", "/api/auth/signup", { businessName: "Glow", name: "Asha", email: "a@glow.in", password: "short" });
  assert.equal(weak.status, 400);
  const signup = await api("POST", "/api/auth/signup", { businessName: "Glow", name: "Asha", email: "A@glow.in", password: "password123" });
  assert.equal(signup.status, 201);
  assert.equal(signup.body.user.passwordHash, undefined);
  const bad = await api("POST", "/api/auth/login", { email: "a@glow.in", password: "nope" });
  assert.equal(bad.status, 401);
  const login = await api("POST", "/api/auth/login", { email: "a@glow.in", password: "password123" });
  assert.equal(login.status, 200);
  token = login.body.token;
});

test("agents are created from templates and scoped to the business", async () => {
  const created = await api("POST", "/api/agents", { templateId: "salon" });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, "Salon Front Desk");
  const updated = await api("PUT", `/api/agents/${created.body.id}`, { phoneNumber: "+91 98765 43210", orgId: "hijack" });
  assert.equal(updated.body.phoneNumber, "+919876543210");
  assert.notEqual(updated.body.orgId, "hijack");

  const mine = token;
  token = (await api("POST", "/api/auth/signup", { businessName: "Other", name: "B", email: "b@x.in", password: "password123" })).body.token;
  assert.equal((await api("GET", `/api/agents/${created.body.id}`)).status, 404);
  assert.equal((await api("PUT", `/api/agents/${created.body.id}`, { name: "x" })).status, 404);
  token = mine;
});

test("browser test call runs a conversation and logs the transcript", async () => {
  const [agent] = (await api("GET", "/api/agents")).body;
  const start = await api("POST", `/api/agents/${agent.id}/test`);
  assert.equal(start.body.greeting, agent.greeting);
  const turn = await api("POST", `/api/calls/${start.body.callId}/say`, { text: "Do you do facials?" });
  assert.match(turn.body.reply, /Demo mode/);
  const bye = await api("POST", `/api/calls/${start.body.callId}/say`, { text: "ok thanks bye" });
  assert.equal(bye.body.action.type, "hangup");
  const log = await api("GET", `/api/calls/${start.body.callId}`);
  assert.equal(log.body.status, "ended");
  assert.equal(log.body.transcript.length, 5);
  assert.equal(log.body.messages, undefined);
});

test("phone call webhooks speak, listen and hang up", async () => {
  const unknown = await twilio("/twilio/voice", { To: "+910000000000", From: "+911", CallSid: "CA0" });
  assert.match(unknown, /not set up yet/);

  const first = await twilio("/twilio/voice", { To: "+919876543210", From: "+919000000001", CallSid: "CA1" });
  assert.match(first, /<Gather input="speech" action="\/twilio\/gather\/[\w-]+"/);
  assert.match(first, /language="en-IN"/);
  const callId = first.match(/gather\/([\w-]+)/)[1];

  assert.match(await twilio(`/twilio/gather/${callId}`, { SpeechResult: "" }), /didn&apos;t catch that/);
  assert.match(await twilio(`/twilio/gather/${callId}`, { SpeechResult: "what are your prices & timings?" }), /&amp;/);
  assert.match(await twilio(`/twilio/gather/${callId}`, { SpeechResult: "thank you, bye" }), /<Hangup\/>/);

  await twilio("/twilio/status", { CallSid: "CA1", CallStatus: "completed", CallDuration: "42" });
  const call = db.get("calls", callId);
  assert.equal(call.status, "ended");
  assert.equal(call.durationSec, 42);
  assert.equal(call.callerNumber, "+919000000001");
});

test("twilio signature check rejects forged requests", async () => {
  process.env.TWILIO_AUTH_TOKEN = "secret";
  process.env.PUBLIC_URL = "https://example.com";
  try {
    assert.equal((await fetch(base + "/twilio/voice", { method: "POST", body: new URLSearchParams({ To: "1" }) })).status, 403);
    const params = { To: "+919876543210", From: "+91", CallSid: "CA2" };
    const sig = twilioSignature("secret", "https://example.com/twilio/voice", params);
    const ok = await fetch(base + "/twilio/voice", { method: "POST", body: new URLSearchParams(params), headers: { "x-twilio-signature": sig } });
    assert.equal(ok.status, 200);
  } finally {
    delete process.env.TWILIO_AUTH_TOKEN;
  }
});

test("booking tool refuses double bookings and closed days", () => {
  const agent = db.find("agents", () => true)[0];
  const call = { id: "c1" };
  // Find the next open day (Mon-Sat) after today.
  let d = new Date(`${todayIn(agent.timeZone)}T12:00:00Z`);
  do d = new Date(d.getTime() + 864e5); while (d.getUTCDay() === 0);
  const date = d.toISOString().slice(0, 10);

  assert.match(runTool(db, agent, call, "check_availability", { date }).result, /09:00/);
  const input = { customer_name: "Ravi", phone: "+91", date, time: "09:00", service: "Haircut", notes: "" };
  assert.match(runTool(db, agent, call, "book_appointment", input).result, /Booked/);
  assert.match(runTool(db, agent, call, "book_appointment", input).result, /not available/);
  assert.doesNotMatch(runTool(db, agent, call, "check_availability", { date }).result, /09:00,/);
  assert.match(runTool(db, agent, call, "book_appointment", { ...input, time: "07:00" }).result, /not available/);
  assert.match(runTool(db, agent, call, "check_availability", { date: "2000-01-01" }).result, /past/);

  let sunday = new Date(d);
  while (sunday.getUTCDay() !== 0) sunday = new Date(sunday.getTime() + 864e5);
  assert.match(runTool(db, agent, call, "check_availability", { date: sunday.toISOString().slice(0, 10) }).result, /closed/);
});
