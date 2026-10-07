// Platform admin console for the VoiceDesk team (emails in ADMIN_EMAILS):
// every business, its usage, and plan changes.
import express from "express";
import { PLANS, usage } from "../plans.js";
import { isAdmin } from "./helpers.js";

export function adminRouter(db, auth) {
  const r = express.Router();
  r.use(auth, (req, res, next) => (isAdmin(req.user) ? next() : res.status(403).json({ error: "Admins only." })));

  r.get("/orgs", (req, res) => {
    const count = (table, orgId) => db.find(table, (x) => x.orgId === orgId).length;
    res.json(
      db.data.orgs
        .map((org) => ({
          id: org.id,
          name: org.name,
          plan: org.plan,
          createdAt: org.createdAt,
          trialEndsAt: org.trialEndsAt,
          owner: db.find("users", (u) => u.orgId === org.id && u.role === "owner")[0]?.email ?? "",
          agents: count("agents", org.id),
          calls: count("calls", org.id),
          bookings: count("appointments", org.id),
          usage: usage(db, org),
        }))
        .reverse(),
    );
  });

  r.put("/orgs/:id", (req, res) => {
    const org = db.get("orgs", req.params.id);
    if (!org) return res.status(404).json({ error: "Business not found." });
    if (!(req.body?.plan in PLANS)) return res.status(400).json({ error: `Plan must be one of ${Object.keys(PLANS).join(", ")}.` });
    res.json(db.update("orgs", org.id, { plan: req.body.plan }));
  });

  return r;
}
