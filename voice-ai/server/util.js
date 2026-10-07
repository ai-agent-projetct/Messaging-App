// Small shared helpers: local time in a business's time zone, phone numbers.

/** Date parts as the business sees them: { date: "YYYY-MM-DD", time: "HH:MM", weekday: 0-6 }. */
export function localParts(timeZone, when = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
    })
      .formatToParts(when)
      .map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    date,
    time: `${parts.hour}:${parts.minute}`,
    weekday: new Date(`${date}T12:00:00Z`).getUTCDay(),
  };
}

export function todayIn(timeZone, when = new Date()) {
  return localParts(timeZone, when).date;
}

/** Minutes between two local "date time" pairs, ignoring time zones (both are local). */
export function minutesBetween(fromDate, fromTime, toDate, toTime) {
  const at = (d, t) => Date.parse(`${d}T${t}:00Z`) / 60000;
  return at(toDate, toTime) - at(fromDate, fromTime);
}

export function addDays(date, days) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 864e5).toISOString().slice(0, 10);
}

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function toHHMM(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Was this moment outside the agent's opening hours? */
export function isAfterHours(agent, when) {
  const { time, weekday } = localParts(agent.timeZone, when);
  const h = agent.hours;
  return !h.days.includes(weekday) || time < h.open || time >= h.close;
}

/**
 * Normalises a phone number to E.164 ("+919876543210"). Bare 10-digit Indian
 * mobile numbers get +91; numbers starting with 0 lose it first.
 */
export function normalizePhone(number, defaultCountry = "91") {
  let digits = String(number ?? "").replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+")) return `+${digits.slice(1).replace(/\+/g, "")}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  digits = digits.replace(/^0+/, "");
  if (digits.length === 10) return `+${defaultCountry}${digits}`;
  return `+${digits}`;
}

/** Same last 10 digits = same person (tolerates +91 / 0 prefixes). */
export function samePhone(a, b) {
  const tail = (x) => String(x ?? "").replace(/\D/g, "").slice(-10);
  return tail(a).length >= 8 && tail(a) === tail(b);
}

export function csv(rows, columns) {
  const cell = (v) => {
    let s = v == null ? "" : Array.isArray(v) ? v.join("; ") : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].join("\n");
}
