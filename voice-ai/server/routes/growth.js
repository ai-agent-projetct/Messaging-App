// Insights (ROI dashboard, daily brief) and outbound campaigns.
import express from "express";
import { MAX_CONTACTS, campaignStats, parseContacts } from "../campaigns.js";
import { lapsedCustomers } from "../customers.js";
import { dailyBrief, insights } from "../insights.js";
import { planOf } from "../plans.js";
import { owned } from "./helpers.js";

export function growthRouter(db, auth) {
  const r = express.Router();
  r.use(auth);

  r.get("/insights", (req, res) => {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    res.json(insights(db, req.org, { days }));
  });

  r.get("/brief", (req, res) => res.json(dailyBrief(db, req.org)));

  // ---- Campaigns ----
  r.get("/campaigns", (req, res) => {
    res.json(db.find("campaigns", (c) => c.orgId === req.org.id).reverse().map(({ contacts, ...c }) => ({ ...c, stats: campaignStats({ contacts }) })));
  });

  r.get("/campaigns/audience/lapsed", (req, res) => {
    const days = Math.min(365, Math.max(7, Number(req.query.days) || 60));
    res.json(lapsedCustomers(db, req.org.id, days).map((c) => ({ name: c.name, phone: c.phone, lastCallAt: c.lastCallAt })));
  });

  r.post("/campaigns", (req, res) => {
    if (!planOf(req.org).campaigns) return res.status(403).json({ error: "Campaigns are included in the Growth plan. Upgrade to use them." });
    const b = req.body ?? {};
    const agent = db.get("agents", b.agentId);
    if (!agent || agent.orgId !== req.org.id) return res.status(400).json({ error: "Choose a receptionist to make the calls." });
    if (!String(b.name || "").trim() || !String(b.goal || "").trim() || !String(b.openingLine || "").trim()) {
      return res.status(400).json({ error: "Name, goal and opening line are required." });
    }
    if (b.consentConfirmed !== true) {
      return res.status(400).json({ error: "Confirm that every contact agreed to be called by your business." });
    }
    const window = {
      start: /^\d{2}:\d{2}$/.test(b.windowStart) ? b.windowStart : "09:00",
      end: /^\d{2}:\d{2}$/.test(b.windowEnd) ? b.windowEnd : "21:00",
      days: Array.isArray(b.days) && b.days.length ? b.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [1, 2, 3, 4, 5, 6],
    };
    // Regulatory guard rail: never earlier than 9am or later than 9pm.
    if (window.start < "09:00" || window.end > "21:00" || window.start >= window.end) {
      return res.status(400).json({ error: "Calling hours must be within 9:00–21:00." });
    }
    const contacts = parseContacts(b.contacts).map((c) => ({ ...c, status: "pending", callId: null, result: "" }));
    if (!contacts.length) return res.status(400).json({ error: "Add at least one contact (one per line: name, phone)." });
    if (contacts.length > MAX_CONTACTS) return res.status(400).json({ error: `At most ${MAX_CONTACTS} contacts per campaign.` });
    const campaign = db.insert("campaigns", {
      orgId: req.org.id,
      agentId: agent.id,
      name: String(b.name).trim().slice(0, 100),
      goal: String(b.goal).trim().slice(0, 1500),
      openingLine: String(b.openingLine).trim().slice(0, 300),
      window,
      maxConcurrent: Math.min(5, Math.max(1, Number(b.maxConcurrent) || 2)),
      consentConfirmed: true,
      consentConfirmedBy: req.user.email,
      consentConfirmedAt: new Date().toISOString(),
      contacts,
      status: "draft",
      lastError: "",
    });
    res.status(201).json(campaign);
  });

  r.get("/campaigns/:id", (req, res) => {
    const c = owned(db, "campaigns", req, res, "Campaign not found.");
    if (c) res.json({ ...c, stats: campaignStats(c) });
  });

  for (const action of ["start", "pause"]) {
    r.post(`/campaigns/:id/${action}`, (req, res) => {
      const c = owned(db, "campaigns", req, res, "Campaign not found.");
      if (!c) return;
      if (c.status === "completed") return res.status(400).json({ error: "This campaign has finished." });
      if (action === "start" && !planOf(req.org).campaigns) {
        return res.status(403).json({ error: "Campaigns are included in the Growth plan." });
      }
      res.json(db.update("campaigns", c.id, { status: action === "start" ? "running" : "paused", lastError: "" }));
    });
  }

  r.delete("/campaigns/:id", (req, res) => {
    const c = owned(db, "campaigns", req, res, "Campaign not found.");
    if (!c) return;
    if (c.status === "running") return res.status(400).json({ error: "Pause the campaign first." });
    res.json({ ok: db.remove("campaigns", c.id) });
  });

  return r;
}
