// Sign-up, login and business settings.
import express from "express";
import { checkPassword, createSession, hashPassword, publicUser } from "../auth.js";
import { LANGUAGES, TEMPLATES } from "../catalog.js";
import { aiEnabled } from "../llm.js";
import { PLANS, usage } from "../plans.js";
import { PERSONAS } from "../simulator.js";
import { normalizePhone } from "../util.js";
import { isAdmin, rateLimiter } from "./helpers.js";

const TRIAL_DAYS = 14;

export function accountRouter(db, auth) {
  const r = express.Router();
  const loginLimit = rateLimiter({ limit: 5, windowMs: 15 * 60e3 });
  const signupLimit = rateLimiter({ limit: Number(process.env.SIGNUP_RATE_LIMIT) || 10, windowMs: 60 * 60e3 });

  r.get("/catalog", (req, res) => {
    res.json({
      languages: LANGUAGES,
      templates: TEMPLATES.map(({ id, label }) => ({ id, label })),
      personas: PERSONAS.map(({ id, label, brief }) => ({ id, label, brief })),
      plans: Object.entries(PLANS).map(([id, p]) => ({ id, ...p, minutes: Number.isFinite(p.minutes) ? p.minutes : null, agents: Number.isFinite(p.agents) ? p.agents : null })),
      aiEnabled: aiEnabled(),
    });
  });

  r.post("/auth/signup", (req, res) => {
    if (!signupLimit(req.ip)) return res.status(429).json({ error: "Too many sign-ups from this network. Try again later." });
    const { businessName, name, email, password } = req.body ?? {};
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!businessName || !name || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return res.status(400).json({ error: "Business name, your name and a valid email are required." });
    }
    if (String(password || "").length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
    if (db.find("users", (u) => u.email === cleanEmail).length) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    const org = db.insert("orgs", {
      name: String(businessName).trim().slice(0, 120),
      plan: "trial",
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 864e5).toISOString(),
      timeZone: "Asia/Kolkata",
      ownerPhone: "",
      followUpChannel: "whatsapp",
      alertsEnabled: true,
      briefEnabled: true,
      briefHour: 20,
    });
    const user = db.insert("users", { orgId: org.id, name: String(name).trim().slice(0, 120), email: cleanEmail, passwordHash: hashPassword(password), role: "owner" });
    res.status(201).json({ token: createSession(db, user.id), user: publicUser(user), org });
  });

  r.post("/auth/login", (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (loginLimit.blocked(email)) return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
    const user = db.find("users", (u) => u.email === email)[0];
    if (!user || !checkPassword(String(req.body?.password || ""), user.passwordHash)) {
      loginLimit(email);
      return res.status(401).json({ error: "Wrong email or password." });
    }
    res.json({ token: createSession(db, user.id), user: publicUser(user), org: db.get("orgs", user.orgId) });
  });

  r.post("/auth/logout", auth, (req, res) => {
    const session = db.find("sessions", (s) => s.token === req.sessionToken)[0];
    if (session) db.remove("sessions", session.id);
    res.json({ ok: true });
  });

  r.get("/me", auth, (req, res) => {
    res.json({ user: { ...publicUser(req.user), isAdmin: isAdmin(req.user) }, org: req.org, usage: usage(db, req.org) });
  });

  r.put("/settings", auth, (req, res) => {
    const b = req.body ?? {};
    const changes = {};
    if ("name" in b) {
      if (!String(b.name).trim()) return res.status(400).json({ error: "Business name is required." });
      changes.name = String(b.name).trim().slice(0, 120);
    }
    if ("ownerPhone" in b) changes.ownerPhone = b.ownerPhone ? normalizePhone(b.ownerPhone) : "";
    if ("followUpChannel" in b) {
      if (!["whatsapp", "sms", "off"].includes(b.followUpChannel)) return res.status(400).json({ error: "Follow-ups must be whatsapp, sms or off." });
      changes.followUpChannel = b.followUpChannel;
    }
    for (const key of ["alertsEnabled", "briefEnabled"]) if (key in b) changes[key] = Boolean(b[key]);
    if ("briefHour" in b) {
      const hour = Number(b.briefHour);
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) return res.status(400).json({ error: "Brief hour must be 0–23." });
      changes.briefHour = hour;
    }
    if ("timeZone" in b) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: b.timeZone });
      } catch {
        return res.status(400).json({ error: "Unknown time zone (use e.g. Asia/Kolkata)." });
      }
      changes.timeZone = b.timeZone;
    }
    res.json(db.update("orgs", req.org.id, changes));
  });

  return r;
}
