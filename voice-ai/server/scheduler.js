// Background jobs, run every 20 seconds by server/index.js:
//   - appointment reminders (about a day before) to cut no-shows
//   - the owner's evening brief
//   - closing calls that were left open (closed browser tab, lost webhook)
//   - placing the next campaign calls
import { dialCampaigns } from "./campaigns.js";
import { endCall } from "./calls.js";
import { dailyBrief } from "./insights.js";
import { queueMessage } from "./messaging.js";
import { localParts, minutesBetween } from "./util.js";

const STALE_MINUTES = 45;
// Bookings made in browser tests or the Test Lab never trigger real messages.
const TEST_SOURCES = ["web", "simulation"];
const REMIND_WITHIN_MINUTES = 24 * 60;

export async function tick(db, now = new Date()) {
  sendReminders(db, now);
  sendBriefs(db, now);
  closeStaleCalls(db, now);
  await dialCampaigns(db, now);
}

export function sendReminders(db, now = new Date()) {
  for (const appt of db.find("appointments", (a) => a.status === "confirmed" && !a.reminded && !TEST_SOURCES.includes(a.source))) {
    const agent = db.get("agents", appt.agentId);
    const org = db.get("orgs", appt.orgId);
    if (!agent || !org) continue;
    const local = localParts(agent.timeZone, now);
    const until = minutesBetween(local.date, local.time, appt.date, appt.time);
    if (until <= 60 || until > REMIND_WITHIN_MINUTES) continue; // too late, or not yet
    db.update("appointments", appt.id, { reminded: true });
    queueMessage(db, {
      orgId: org.id,
      to: appt.phone,
      kind: "reminder",
      body: `${org.name}: reminder of your ${appt.service} booking on ${appt.date} at ${appt.time} (ref ${appt.ref}). Need to change it? Just call us.`,
    });
  }
}

export function sendBriefs(db, now = new Date()) {
  for (const org of db.find("orgs", (o) => o.ownerPhone && o.briefEnabled !== false)) {
    const local = localParts(org.timeZone || "Asia/Kolkata", now);
    const hour = Number(local.time.slice(0, 2));
    if (hour !== (org.briefHour ?? 20) || org.lastBriefDate === local.date) continue;
    db.update("orgs", org.id, { lastBriefDate: local.date });
    const brief = dailyBrief(db, org, now);
    queueMessage(db, {
      orgId: org.id,
      to: org.ownerPhone,
      kind: "owner_brief",
      channel: org.followUpChannel === "sms" ? "sms" : "whatsapp",
      body: `${brief.title}\n${brief.lines.join("\n")}`,
    });
  }
}

export function closeStaleCalls(db, now = new Date()) {
  const cutoff = new Date(now.getTime() - STALE_MINUTES * 60e3).toISOString();
  for (const call of db.find("calls", (c) => c.status === "live" && c.createdAt < cutoff)) {
    const last = call.transcript.at(-1)?.at ?? call.createdAt;
    endCall(db, call, "timed-out", Math.round((Date.parse(last) - Date.parse(call.createdAt)) / 1000));
  }
}

export function startScheduler(db, everyMs = 20_000) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await tick(db);
    } catch (err) {
      console.error("scheduler error", err);
    } finally {
      running = false;
    }
  }, everyMs);
  timer.unref();
  return timer;
}
