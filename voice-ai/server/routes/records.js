// Calls, live monitoring, bookings, leads, customers, knowledge gaps,
// messages, alerts and CSV exports.
import express from "express";
import { respond } from "../agent.js";
import { endCall } from "../calls.js";
import { eraseCustomer } from "../customers.js";
import { csv, samePhone } from "../util.js";
import { owned, wrap } from "./helpers.js";

const STATUSES = {
  appointments: ["confirmed", "completed", "cancelled", "no-show"],
  leads: ["new", "contacted", "won", "lost"],
};

const EXPORTS = {
  appointments: ["date", "time", "customerName", "phone", "service", "price", "status", "ref", "notes", "createdAt"],
  leads: ["createdAt", "customerName", "phone", "interest", "notes", "score", "status"],
  customers: ["name", "phone", "calls", "lastCallAt", "notes", "doNotCall", "createdAt"],
  calls: ["createdAt", "agentName", "channel", "direction", "callerNumber", "durationSec", "outcome", "summary", "intent", "sentiment", "leadScore"],
};

export function recordsRouter(db, auth) {
  const r = express.Router();
  r.use(auth);
  const mine = (table, req, extra = () => true) => db.find(table, (x) => x.orgId === req.org.id && extra(x));

  // ---- Calls ----
  const callSummary = ({ messages, transcript, system, widgetSecretHash, ...c }) => ({ ...c, turns: transcript.length, lastLine: transcript.at(-1)?.text ?? "" });

  r.get("/calls", (req, res) => {
    const live = req.query.status === "live";
    const rows = mine("calls", req, (c) => c.channel !== "simulation" && (!live || c.status === "live")).reverse();
    res.json(live ? rows.map(({ messages, system, widgetSecretHash, ...c }) => c) : rows.map(callSummary));
  });

  r.get("/calls/:id", (req, res) => {
    const call = owned(db, "calls", req, res, "Call not found.");
    if (!call) return;
    const { messages, system, widgetSecretHash, ...rest } = call;
    res.json({
      ...rest,
      appointments: db.find("appointments", (a) => a.callId === call.id),
      leads: db.find("leads", (l) => l.callId === call.id),
      customer: call.customerId ? db.get("customers", call.customerId) : null,
    });
  });

  r.post("/calls/:id/say", wrap(async (req, res) => {
    const call = owned(db, "calls", req, res, "Call not found.");
    if (!call) return;
    if (call.channel !== "web") return res.status(400).json({ error: "Only browser test calls accept typed messages." });
    if (call.status === "ended") return res.status(409).json({ error: "This call has ended." });
    const text = String(req.body?.text || "").trim().slice(0, 2000);
    if (!text) return res.status(400).json({ error: "Say something first." });
    const agent = db.get("agents", call.agentId);
    if (!agent) return res.status(404).json({ error: "Receptionist not found." });
    const { reply, action } = await respond(db, agent, call, text);
    if (action) endCall(db, call, action.type === "transfer" ? "transferred" : "completed");
    res.json({ reply, action });
  }));

  r.post("/calls/:id/end", (req, res) => {
    const call = owned(db, "calls", req, res, "Call not found.");
    if (!call) return;
    endCall(db, call, "completed");
    res.json({ ok: true });
  });

  // Live takeover: the next time the caller finishes speaking, the call is
  // transferred to the owner (or the receptionist's transfer number).
  r.post("/calls/:id/takeover", (req, res) => {
    const call = owned(db, "calls", req, res, "Call not found.");
    if (!call) return;
    if (call.status !== "live" || call.channel !== "phone") return res.status(400).json({ error: "Only live phone calls can be taken over." });
    const agent = db.get("agents", call.agentId);
    if (!req.org.ownerPhone && !agent?.transferNumber) {
      return res.status(400).json({ error: "Add your mobile number in Settings (or a transfer number on the receptionist) first." });
    }
    db.update("calls", call.id, { takeover: true });
    res.json({ ok: true });
  });

  // ---- Bookings & leads ----
  for (const table of ["appointments", "leads"]) {
    r.get(`/${table}`, (req, res) => res.json(mine(table, req, (x) => x.source !== "simulation").reverse()));
    r.patch(`/${table}/:id`, (req, res) => {
      const row = owned(db, table, req, res);
      if (!row) return;
      const status = String(req.body?.status || "");
      if (!STATUSES[table].includes(status)) return res.status(400).json({ error: `Status must be one of ${STATUSES[table].join(", ")}.` });
      res.json(db.update(table, row.id, { status }));
    });
  }

  // ---- Customers (caller memory) ----
  r.get("/customers", (req, res) => {
    const appts = mine("appointments", req, (a) => a.status !== "cancelled");
    res.json(
      mine("customers", req)
        .map((c) => {
          const theirs = appts.filter((a) => samePhone(a.phone, c.phone));
          return { ...c, bookings: theirs.length, value: theirs.reduce((s, a) => s + (a.price || 0), 0) };
        })
        .sort((a, b) => ((a.lastCallAt || "") < (b.lastCallAt || "") ? 1 : -1)),
    );
  });

  r.get("/customers/:id", (req, res) => {
    const c = owned(db, "customers", req, res, "Customer not found.");
    if (!c) return;
    const match = (x) => samePhone(x.phone ?? x.callerNumber, c.phone);
    res.json({
      ...c,
      calls: mine("calls", req, (x) => x.customerId === c.id || match(x)).map(callSummary).reverse(),
      appointments: mine("appointments", req, match).reverse(),
      leads: mine("leads", req, match).reverse(),
    });
  });

  r.patch("/customers/:id", (req, res) => {
    const c = owned(db, "customers", req, res, "Customer not found.");
    if (!c) return;
    const changes = {};
    if ("name" in (req.body ?? {})) changes.name = String(req.body.name).slice(0, 120);
    if ("notes" in (req.body ?? {})) changes.notes = String(req.body.notes).slice(0, 2000);
    if ("doNotCall" in (req.body ?? {})) changes.doNotCall = Boolean(req.body.doNotCall);
    res.json(db.update("customers", c.id, changes));
  });

  // Right to erasure: removes the customer and every record tied to their number.
  r.delete("/customers/:id", (req, res) => {
    const c = owned(db, "customers", req, res, "Customer not found.");
    if (c) res.json({ ok: true, removed: eraseCustomer(db, c) });
  });

  // ---- Knowledge gaps: questions the receptionist couldn't answer ----
  r.get("/questions", (req, res) => {
    const status = req.query.status || "open";
    res.json(mine("questions", req, (q) => q.status === status).sort((a, b) => (b.count || 1) - (a.count || 1)));
  });

  r.post("/questions/:id/answer", (req, res) => {
    const q = owned(db, "questions", req, res, "Question not found.");
    if (!q) return;
    const answer = String(req.body?.answer || "").trim().slice(0, 1500);
    if (!answer) return res.status(400).json({ error: "Write the answer first." });
    const agent = db.get("agents", q.agentId);
    if (!agent) return res.status(404).json({ error: "Receptionist not found." });
    const question = String(req.body?.question || q.question).trim().slice(0, 300);
    db.update("agents", agent.id, { faqs: [...(agent.faqs || []), { q: question, a: answer }] });
    res.json(db.update("questions", q.id, { status: "answered", answer, answeredAt: new Date().toISOString() }));
  });

  r.post("/questions/:id/dismiss", (req, res) => {
    const q = owned(db, "questions", req, res, "Question not found.");
    if (q) res.json(db.update("questions", q.id, { status: "dismissed" }));
  });

  // ---- Messages & alerts ----
  r.get("/messages", (req, res) => res.json(mine("messages", req).reverse().slice(0, 300)));

  r.get("/alerts", (req, res) => res.json(mine("alerts", req).reverse().slice(0, 100)));
  r.post("/alerts/seen", (req, res) => {
    mine("alerts", req, (a) => !a.seen).forEach((a) => db.update("alerts", a.id, { seen: true }));
    res.json({ ok: true });
  });

  // ---- CSV export ----
  r.get("/export/:table", (req, res) => {
    const columns = EXPORTS[req.params.table];
    if (!columns) return res.status(404).json({ error: "Unknown export." });
    let rows = mine(req.params.table, req, (x) => x.source !== "simulation" && x.channel !== "simulation");
    if (req.params.table === "calls") {
      rows = rows.map((c) => ({ ...c, intent: c.analysis?.intent, sentiment: c.analysis?.sentiment, leadScore: c.analysis?.leadScore }));
    }
    res.type("text/csv").attachment(`voicedesk-${req.params.table}.csv`).send(csv(rows, columns));
  });

  return r;
}
