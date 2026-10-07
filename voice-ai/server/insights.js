// "Proof in rupees": what the receptionist did for the business, and the
// owner's daily brief.
import { normalizeServices } from "./catalog.js";
import { usage } from "./plans.js";
import { addDays, isAfterHours, localParts, todayIn } from "./util.js";

const REAL_CHANNELS = ["phone", "widget"];
const isReal = (row) => !row.source || REAL_CHANNELS.includes(row.source); // excludes test bookings

export function insights(db, org, { days = 30, now = new Date() } = {}) {
  const tz = org.timeZone || "Asia/Kolkata";
  const since = new Date(now.getTime() - days * 864e5).toISOString();
  const mine = (t, extra = () => true) => db.find(t, (x) => x.orgId === org.id && extra(x));
  const agents = new Map(mine("agents").map((a) => [a.id, a]));

  const calls = mine("calls", (c) => REAL_CHANNELS.includes(c.channel) && c.createdAt >= since);
  const bookings = mine("appointments", (a) => a.createdAt >= since && a.status !== "cancelled" && isReal(a));
  const leads = mine("leads", (l) => l.createdAt >= since && isReal(l));

  const priceOf = (appt) => {
    if (appt.price) return appt.price;
    const agent = agents.get(appt.agentId);
    const match = normalizeServices(agent?.services).find((s) => s.name.toLowerCase() === String(appt.service).toLowerCase());
    return match?.price ?? 0;
  };
  const revenue = bookings.reduce((sum, a) => sum + priceOf(a), 0);
  const afterHours = calls.filter((c) => {
    const agent = agents.get(c.agentId);
    return agent && isAfterHours(agent, new Date(c.createdAt));
  }).length;

  const count = (rows, key) => rows.reduce((acc, r) => {
    const k = key(r);
    if (k) acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  // Calls per day for the last 14 days, in the business's time zone.
  const today = todayIn(tz, now);
  const perDay = Array.from({ length: 14 }, (_, i) => ({ date: addDays(today, i - 13), calls: 0, bookings: 0 }));
  const byDate = new Map(perDay.map((d) => [d.date, d]));
  mine("calls", (c) => REAL_CHANNELS.includes(c.channel)).forEach((c) => {
    const d = byDate.get(localParts(tz, new Date(c.createdAt)).date);
    if (d) d.calls++;
  });
  mine("appointments", (a) => a.status !== "cancelled" && isReal(a)).forEach((a) => {
    const d = byDate.get(localParts(tz, new Date(a.createdAt)).date);
    if (d) d.bookings++;
  });

  const analysed = calls.filter((c) => c.analysis);
  return {
    days,
    calls: calls.length,
    minutes: Math.round(calls.reduce((s, c) => s + (c.durationSec || 0), 0) / 6) / 10,
    bookings: bookings.length,
    estimatedRevenue: revenue,
    afterHoursCalls: afterHours,
    leads: leads.length,
    leadScores: count(leads, (l) => l.score),
    intents: count(analysed, (c) => c.analysis.intent),
    sentiment: count(analysed, (c) => c.analysis.sentiment),
    openQuestions: mine("questions", (q) => q.status === "open").length,
    unseenAlerts: mine("alerts", (a) => !a.seen).length,
    perDay,
    usage: usage(db, org, now),
  };
}

/** The evening WhatsApp brief for the owner (also shown on the dashboard). */
export function dailyBrief(db, org, now = new Date()) {
  const tz = org.timeZone || "Asia/Kolkata";
  const today = todayIn(tz, now);
  const tomorrow = addDays(today, 1);
  const isToday = (iso) => localParts(tz, new Date(iso)).date === today;
  const mine = (t, f) => db.find(t, (x) => x.orgId === org.id && f(x));

  const calls = mine("calls", (c) => REAL_CHANNELS.includes(c.channel) && isToday(c.createdAt));
  const bookedToday = mine("appointments", (a) => isToday(a.createdAt) && a.status !== "cancelled" && isReal(a));
  const tomorrowAppts = mine("appointments", (a) => a.date === tomorrow && a.status === "confirmed").sort((a, b) => (a.time < b.time ? -1 : 1));
  const hotLeads = mine("leads", (l) => l.status === "new" && (l.score === "hot" || l.score === "warm"));
  const questions = mine("questions", (q) => q.status === "open");

  const lines = [
    `📞 ${calls.length} call${calls.length === 1 ? "" : "s"} today, ${bookedToday.length} new booking${bookedToday.length === 1 ? "" : "s"}.`,
    tomorrowAppts.length
      ? `📅 Tomorrow: ${tomorrowAppts.slice(0, 6).map((a) => `${a.time} ${a.customerName} (${a.service})`).join(", ")}${tomorrowAppts.length > 6 ? ` +${tomorrowAppts.length - 6} more` : ""}.`
      : "📅 No bookings tomorrow yet.",
    hotLeads.length ? `🔥 Call back: ${hotLeads.slice(0, 5).map((l) => `${l.customerName} ${l.phone} (${l.interest})`).join("; ")}.` : "",
    questions.length ? `❓ ${questions.length} question${questions.length === 1 ? "" : "s"} your receptionist couldn't answer. Answer them in the dashboard to teach it.` : "",
  ].filter(Boolean);
  return { date: today, title: `Your VoiceDesk brief for ${today}`, lines };
}
