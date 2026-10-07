// Receptionists: create, edit, browser test calls, AI setup assistant, Test Lab.
import crypto from "node:crypto";
import express from "express";
import { DEFAULT_HOURS, LANGUAGES, TEMPLATES, normalizeServices } from "../catalog.js";
import { startCall } from "../calls.js";
import { planOf } from "../plans.js";
import { autofill } from "../setup-assistant.js";
import { PERSONAS, startSimulation } from "../simulator.js";
import { normalizePhone } from "../util.js";
import { owned, rateLimiter, wrap } from "./helpers.js";

const AGENT_FIELDS = [
  "name", "language", "voice", "greeting", "businessInfo", "instructions", "services", "faqs",
  "bookingEnabled", "transferNumber", "phoneNumber", "hours", "timeZone", "active", "widgetEnabled",
];

export function agentsRouter(db, auth) {
  const r = express.Router();
  r.use(auth);
  const aiLimit = rateLimiter({ limit: 20, windowMs: 60 * 60e3 }); // AI-heavy actions per business per hour

  r.get("/", (req, res) => res.json(db.find("agents", (a) => a.orgId === req.org.id)));

  r.post("/", (req, res) => {
    const limit = planOf(req.org).agents;
    if (db.find("agents", (a) => a.orgId === req.org.id).length >= limit) {
      return res.status(403).json({ error: `Your plan includes ${limit} receptionist${limit === 1 ? "" : "s"}. Upgrade to add more.` });
    }
    const template = TEMPLATES.find((t) => t.id === req.body?.templateId) ?? TEMPLATES.at(-1);
    const agent = db.insert("agents", {
      orgId: req.org.id,
      language: "en-IN",
      voice: LANGUAGES[0].voice,
      transferNumber: "",
      phoneNumber: "",
      hours: structuredClone(DEFAULT_HOURS),
      timeZone: req.org.timeZone || "Asia/Kolkata",
      active: true,
      faqs: [],
      widgetEnabled: false,
      publicId: crypto.randomBytes(12).toString("base64url"),
      ...structuredClone(template.agent),
    });
    res.status(201).json(agent);
  });

  r.get("/:id", (req, res) => {
    const agent = owned(db, "agents", req, res, "Receptionist not found.");
    if (agent) res.json({ ...agent, services: normalizeServices(agent.services) });
  });

  r.put("/:id", (req, res) => {
    const agent = owned(db, "agents", req, res, "Receptionist not found.");
    if (!agent) return;
    const changes = {};
    for (const key of AGENT_FIELDS) if (key in (req.body ?? {})) changes[key] = req.body[key];
    const problem = validateAgent(changes);
    if (problem) return res.status(400).json({ error: problem });
    if (changes.phoneNumber) {
      const clash = db.find("agents", (a) => a.id !== agent.id && a.phoneNumber === changes.phoneNumber);
      if (clash.length) return res.status(409).json({ error: "That phone number is already used by another receptionist." });
    }
    if (changes.widgetEnabled && !agent.publicId) changes.publicId = crypto.randomBytes(12).toString("base64url");
    res.json(db.update("agents", agent.id, changes));
  });

  r.delete("/:id", (req, res) => {
    const agent = owned(db, "agents", req, res, "Receptionist not found.");
    if (agent) res.json({ ok: db.remove("agents", agent.id) });
  });

  // Browser test call (dashboard "Test call" panel).
  r.post("/:id/test", (req, res) => {
    const agent = owned(db, "agents", req, res, "Receptionist not found.");
    if (!agent) return;
    const call = startCall(db, agent, { channel: "web" });
    res.status(201).json({ callId: call.id, greeting: call.greeting });
  });

  // AI setup assistant: returns a proposal, nothing is saved until the owner saves.
  r.post("/:id/autofill", wrap(async (req, res) => {
    const agent = owned(db, "agents", req, res, "Receptionist not found.");
    if (!agent) return;
    if (!aiLimit(`autofill:${req.org.id}`)) return res.status(429).json({ error: "Too many requests. Try again in an hour." });
    try {
      res.json(await autofill({ agent, org: req.org, notes: String(req.body?.notes || ""), url: req.body?.url }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }));

  // Readiness Test Lab.
  r.post("/:id/simulations", (req, res) => {
    const agent = owned(db, "agents", req, res, "Receptionist not found.");
    if (!agent) return;
    if (db.find("simulations", (s) => s.agentId === agent.id && s.status === "running").length) {
      return res.status(409).json({ error: "A test is already running for this receptionist." });
    }
    if (!aiLimit(`lab:${req.org.id}`)) return res.status(429).json({ error: "Too many test runs. Try again in an hour." });
    const ids = Array.isArray(req.body?.personas) && req.body.personas.length ? req.body.personas : PERSONAS.map((p) => p.id);
    const valid = ids.filter((id) => PERSONAS.some((p) => p.id === id));
    if (!valid.length) return res.status(400).json({ error: "Choose at least one test scenario." });
    res.status(202).json(startSimulation(db, agent, valid));
  });

  r.get("/:id/simulations", (req, res) => {
    const agent = owned(db, "agents", req, res, "Receptionist not found.");
    if (agent) res.json(db.find("simulations", (s) => s.agentId === agent.id).reverse().slice(0, 10));
  });

  return r;
}

function validateAgent(c) {
  for (const key of ["name", "voice", "greeting", "businessInfo", "instructions", "transferNumber", "phoneNumber", "timeZone"]) {
    if (key in c && typeof c[key] !== "string") return `${key} must be text.`;
  }
  if ("name" in c && !c.name.trim()) return "Name is required.";
  if ("businessInfo" in c && c.businessInfo.length > 30000) return "Business information is too long (30,000 characters max).";
  if ("language" in c && !LANGUAGES.some((l) => l.code === c.language)) return "Unknown language.";
  for (const key of ["bookingEnabled", "active", "widgetEnabled"]) if (key in c && typeof c[key] !== "boolean") return `${key} must be true or false.`;
  for (const key of ["phoneNumber", "transferNumber"]) if (c[key]) c[key] = normalizePhone(c[key]);
  if ("services" in c) {
    if (!Array.isArray(c.services) || c.services.length > 100) return "Services must be a list (100 max).";
    if (!c.services.every((s) => typeof s === "string" || (s && typeof s.name === "string"))) return "Each service needs a name.";
    c.services = normalizeServices(c.services).filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim().slice(0, 80), price: Math.max(0, Math.round(s.price)) }));
  }
  if ("faqs" in c) {
    if (!Array.isArray(c.faqs) || c.faqs.length > 200) return "FAQs must be a list (200 max).";
    if (!c.faqs.every((f) => f && typeof f.q === "string" && typeof f.a === "string")) return "Each FAQ needs a question and an answer.";
    c.faqs = c.faqs.filter((f) => f.q.trim() && f.a.trim()).map((f) => ({ q: f.q.trim().slice(0, 300), a: f.a.trim().slice(0, 1500) }));
  }
  if ("timeZone" in c) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: c.timeZone });
    } catch {
      return "Unknown time zone (use e.g. Asia/Kolkata).";
    }
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
