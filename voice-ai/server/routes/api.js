// JSON API used by the dashboard (public/app.html).
import express from "express";
import { checkPassword, createSession, hashPassword, publicUser, requireAuth } from "../auth.js";
import { DEFAULT_HOURS, LANGUAGES, TEMPLATES } from "../catalog.js";
import { aiEnabled, respond } from "../agent.js";

const AGENT_FIELDS = [
  "name", "language", "voice", "greeting", "businessInfo", "instructions", "services",
  "bookingEnabled", "transferNumber", "phoneNumber", "hours", "timeZone", "active",
];

export function apiRouter(db) {
  const r = express.Router();
  const auth = requireAuth(db);
  const loginAttempts = new Map(); // email -> { count, until }

  r.get("/catalog", (req, res) => {
    res.json({ languages: LANGUAGES, templates: TEMPLATES.map(({ id, label }) => ({ id, label })), aiEnabled: aiEnabled() });
  });

  // ---- Accounts ----
  r.post("/auth/signup", (req, res) => {
    const { businessName, name, email, password } = req.body ?? {};
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!businessName || !name || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return res.status(400).json({ error: "Business name, your name and a valid email are required." });
    }
    if (String(password || "").length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
    if (db.find("users", (u) => u.email === cleanEmail).length) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    const org = db.insert("orgs", { name: String(businessName).trim(), plan: "trial" });
    const user = db.insert("users", { orgId: org.id, name: String(name).trim(), email: cleanEmail, passwordHash: hashPassword(password), role: "owner" });
    res.status(201).json({ token: createSession(db, user.id), user: publicUser(user), org });
  });

  r.post("/auth/login", (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const attempt = loginAttempts.get(email);
    if (attempt && attempt.count >= 5 && attempt.until > Date.now()) {
      return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
    }
    const user = db.find("users", (u) => u.email === email)[0];
    if (!user || !checkPassword(String(req.body?.password || ""), user.passwordHash)) {
      const count = (attempt && attempt.until > Date.now() ? attempt.count : 0) + 1;
      loginAttempts.set(email, { count, until: Date.now() + 15 * 60e3 });
      return res.status(401).json({ error: "Wrong email or password." });
    }
    loginAttempts.delete(email);
    res.json({ token: createSession(db, user.id), user: publicUser(user), org: db.get("orgs", user.orgId) });
  });

  r.post("/auth/logout", auth, (req, res) => {
    const session = db.find("sessions", (s) => s.token === req.sessionToken)[0];
    if (session) db.remove("sessions", session.id);
    res.json({ ok: true });
  });

  r.get("/me", auth, (req, res) => res.json({ user: publicUser(req.user), org: req.org }));

  // ---- Agents ----
  const ownAgent = (req, res) => {
    const agent = db.get("agents", req.params.id);
    if (!agent || agent.orgId !== req.org.id) {
      res.status(404).json({ error: "Agent not found." });
      return null;
    }
    return agent;
  };

  r.get("/agents", auth, (req, res) => res.json(db.find("agents", (a) => a.orgId === req.org.id)));

  r.post("/agents", auth, (req, res) => {
    const template = TEMPLATES.find((t) => t.id === req.body?.templateId) ?? TEMPLATES.at(-1);
    const agent = db.insert("agents", {
      orgId: req.org.id,
      language: "en-IN",
      voice: LANGUAGES[0].voice,
      transferNumber: "",
      phoneNumber: "",
      hours: structuredClone(DEFAULT_HOURS),
      timeZone: "Asia/Kolkata",
      active: true,
      ...structuredClone(template.agent),
    });
    res.status(201).json(agent);
  });

  r.get("/agents/:id", auth, (req, res) => {
    const agent = ownAgent(req, res);
    if (agent) res.json(agent);
  });

  r.put("/agents/:id", auth, (req, res) => {
    const agent = ownAgent(req, res);
    if (!agent) return;
    const changes = {};
    for (const key of AGENT_FIELDS) if (key in (req.body ?? {})) changes[key] = req.body[key];
    const problem = validateAgent(changes);
    if (problem) return res.status(400).json({ error: problem });
    if (changes.phoneNumber) {
      changes.phoneNumber = normalizePhone(changes.phoneNumber);
      const clash = db.find("agents", (a) => a.id !== agent.id && a.phoneNumber === changes.phoneNumber);
      if (clash.length) return res.status(409).json({ error: "That phone number is already used by another agent." });
    }
    res.json(db.update("agents", agent.id, changes));
  });

  r.delete("/agents/:id", auth, (req, res) => {
    const agent = ownAgent(req, res);
    if (agent) res.json({ ok: db.remove("agents", agent.id) });
  });

  // ---- Browser test calls ----
  r.post("/agents/:id/test", auth, (req, res) => {
    const agent = ownAgent(req, res);
    if (!agent) return;
    const call = startCall(db, agent, { channel: "web" });
    res.status(201).json({ callId: call.id, greeting: agent.greeting });
  });

  r.post("/calls/:id/say", auth, async (req, res) => {
    const call = db.get("calls", req.params.id);
    if (!call || call.orgId !== req.org.id || call.channel !== "web") return res.status(404).json({ error: "Call not found." });
    if (call.status === "ended") return res.status(409).json({ error: "This call has ended." });
    const text = String(req.body?.text || "").trim().slice(0, 2000);
    if (!text) return res.status(400).json({ error: "Say something first." });
    const agent = db.get("agents", call.agentId);
    const { reply, action } = await respond(db, agent, call, text);
    if (action) endCall(db, call, action.type === "transfer" ? "transferred" : "completed");
    res.json({ reply, action });
  });

  r.post("/calls/:id/end", auth, (req, res) => {
    const call = db.get("calls", req.params.id);
    if (!call || call.orgId !== req.org.id) return res.status(404).json({ error: "Call not found." });
    if (call.status !== "ended") endCall(db, call, "completed");
    res.json({ ok: true });
  });

  // ---- Call logs, bookings, leads ----
  r.get("/calls", auth, (req, res) => {
    const calls = db
      .find("calls", (c) => c.orgId === req.org.id)
      .map(({ messages, transcript, ...c }) => ({ ...c, turns: transcript.length }))
      .reverse();
    res.json(calls);
  });

  r.get("/calls/:id", auth, (req, res) => {
    const call = db.get("calls", req.params.id);
    if (!call || call.orgId !== req.org.id) return res.status(404).json({ error: "Call not found." });
    const { messages, ...rest } = call;
    res.json(rest);
  });

  for (const table of ["appointments", "leads"]) {
    r.get(`/${table}`, auth, (req, res) => res.json(db.find(table, (x) => x.orgId === req.org.id).reverse()));
    r.patch(`/${table}/:id`, auth, (req, res) => {
      const row = db.get(table, req.params.id);
      if (!row || row.orgId !== req.org.id) return res.status(404).json({ error: "Not found." });
      const status = String(req.body?.status || "");
      const allowed = table === "appointments" ? ["confirmed", "completed", "cancelled", "no-show"] : ["new", "contacted", "won", "lost"];
      if (!allowed.includes(status)) return res.status(400).json({ error: `Status must be one of ${allowed.join(", ")}.` });
      res.json(db.update(table, row.id, { status }));
    });
  }

  r.get("/stats", auth, (req, res) => {
    const mine = (t) => db.find(t, (x) => x.orgId === req.org.id);
    const calls = mine("calls");
    const minutes = calls.reduce((sum, c) => sum + (c.durationSec || 0), 0) / 60;
    res.json({
      calls: calls.length,
      phoneCalls: calls.filter((c) => c.channel === "phone").length,
      minutes: Math.round(minutes * 10) / 10,
      appointments: mine("appointments").filter((a) => a.status !== "cancelled").length,
      leads: mine("leads").length,
      agents: mine("agents").length,
    });
  });

  return r;
}

export function startCall(db, agent, extra) {
  return db.insert("calls", {
    orgId: agent.orgId,
    agentId: agent.id,
    agentName: agent.name,
    status: "live",
    transcript: [{ role: "agent", text: agent.greeting, at: new Date().toISOString() }],
    messages: [],
    summary: "",
    durationSec: 0,
    ...extra,
  });
}

export function endCall(db, call, outcome, durationSec) {
  const started = new Date(call.createdAt).getTime();
  db.update("calls", call.id, {
    status: "ended",
    outcome,
    durationSec: durationSec ?? Math.round((Date.now() - started) / 1000),
  });
}

function validateAgent(c) {
  for (const key of ["name", "voice", "greeting", "businessInfo", "instructions", "transferNumber", "phoneNumber", "timeZone"]) {
    if (key in c && typeof c[key] !== "string") return `${key} must be text.`;
  }
  if ("name" in c && !c.name.trim()) return "Name is required.";
  if ("businessInfo" in c && c.businessInfo.length > 20000) return "Business information is too long (20,000 characters max).";
  if ("language" in c && !LANGUAGES.some((l) => l.code === c.language)) return "Unknown language.";
  if ("services" in c && !(Array.isArray(c.services) && c.services.every((s) => typeof s === "string"))) return "Services must be a list.";
  for (const key of ["bookingEnabled", "active"]) if (key in c && typeof c[key] !== "boolean") return `${key} must be true or false.`;
  if ("timeZone" in c) {
    try { new Intl.DateTimeFormat("en", { timeZone: c.timeZone }); } catch { return "Unknown time zone (use e.g. Asia/Kolkata)."; }
  }
  if ("hours" in c) {
    const h = c.hours;
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    const ok =
      h && Array.isArray(h.days) && h.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
      time.test(h.open) && time.test(h.close) && h.open < h.close &&
      Number.isInteger(h.slotMinutes) && h.slotMinutes >= 5 && h.slotMinutes <= 480;
    if (!ok) return "Opening hours are invalid: closing time must be after opening time.";
    c.hours = { days: [...new Set(h.days)].sort(), open: h.open, close: h.close, slotMinutes: h.slotMinutes };
  }
  return null;
}

export function normalizePhone(number) {
  return String(number).replace(/[^\d+]/g, "");
}
