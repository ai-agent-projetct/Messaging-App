// Runs the real Claude code path against a fake Anthropic API, to check the
// request we send and the tool loop (check slots -> book -> reply).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Store } from "../server/db.js";
import { respond } from "../server/agent.js";
import { DEFAULT_HOURS } from "../server/catalog.js";
import { todayIn } from "../server/tools.js";

const requests = [];
let replies = [];
let fake;

before(async () => {
  fake = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      requests.push({ url: req.url, headers: req.headers, body: JSON.parse(body) });
      const content = replies.shift();
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        id: `msg_${requests.length}`, type: "message", role: "assistant", model: "claude-opus-5-5",
        content, stop_reason: content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      }));
    });
  }).listen(0);
  await new Promise((r) => fake.once("listening", r));
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${fake.address().port}`;
});
after(() => fake.close());

test("Claude tool loop books an appointment and speaks the reply", async () => {
  const db = new Store(null);
  const agent = db.insert("agents", {
    orgId: "o1", name: "Salon", language: "en-IN", greeting: "Hi!", businessInfo: "Haircut 300",
    instructions: "", services: ["Haircut"], bookingEnabled: true, transferNumber: "",
    hours: DEFAULT_HOURS, timeZone: "Asia/Kolkata",
  });
  const call = db.insert("calls", { orgId: "o1", agentId: agent.id, transcript: [], messages: [], callerNumber: "+919000000001" });

  let d = new Date(`${todayIn(agent.timeZone)}T12:00:00Z`);
  do d = new Date(d.getTime() + 864e5); while (d.getUTCDay() === 0);
  const date = d.toISOString().slice(0, 10);

  replies = [
    [{ type: "text", text: "Let me check." }, { type: "tool_use", id: "t1", name: "check_availability", input: { date } }],
    [{ type: "tool_use", id: "t2", name: "book_appointment", input: { customer_name: "Ravi", phone: "+919000000001", date, time: "10:00", service: "Haircut", notes: "" } }],
    [{ type: "text", text: "**Done!** You're booked for 10 am." }],
  ];
  const { reply, action } = await respond(db, agent, call, "Book a haircut tomorrow at 10");

  assert.equal(reply, "Let me check. Done! You're booked for 10 am.");
  assert.equal(action, null);
  assert.equal(db.find("appointments", () => true).length, 1);

  const first = requests[0];
  assert.equal(first.url, "/v1/messages?beta=true");
  assert.match(first.headers["anthropic-beta"], /server-side-fallback-2026-07-01/);
  assert.equal(first.body.model, "claude-opus-5-5");
  assert.equal(first.body.fallbacks, "default");
  assert.deepEqual(first.body.output_config, { effort: "low" });
  assert.match(first.body.system, /\+919000000001/);
  assert.ok(first.body.tools.every((t) => t.strict === true));

  // The second request carries Claude's turn plus our tool result.
  const second = requests[1].body.messages;
  assert.equal(second.at(-1).content[0].type, "tool_result");
  assert.match(second.at(-1).content[0].content, /free slots 09:00/);
  assert.equal(call.messages.length, 6); // user, assistant, results, assistant, results, assistant
});
