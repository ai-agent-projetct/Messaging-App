// Caller memory: every phone number that calls becomes a customer record, so
// the receptionist can greet returning callers and know their history.
import { normalizePhone, samePhone } from "./util.js";

export function findCustomer(db, orgId, phone) {
  if (!phone) return null;
  return db.find("customers", (c) => c.orgId === orgId && samePhone(c.phone, phone))[0] ?? null;
}

/** Find-or-create by phone and merge in what we learned. */
export function upsertCustomer(db, orgId, phone, patch = {}) {
  const clean = normalizePhone(phone);
  if (!clean) return null;
  const existing = findCustomer(db, orgId, clean);
  const changes = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined && v !== ""));
  if (existing) return db.update("customers", existing.id, changes);
  return db.insert("customers", {
    orgId, phone: clean, name: "", notes: "", calls: 0, doNotCall: false, lastCallAt: null, ...changes,
  });
}

export function recordCall(db, customer) {
  return db.update("customers", customer.id, { calls: (customer.calls || 0) + 1, lastCallAt: new Date().toISOString() });
}

/** A few lines about this caller for the system prompt, or "" for new callers. */
export function customerContext(db, customer) {
  if (!customer) return "";
  const past = db
    .find("appointments", (a) => a.orgId === customer.orgId && samePhone(a.phone, customer.phone))
    .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1))
    .slice(0, 4)
    .map((a) => `${a.date} ${a.time} ${a.service} (${a.status}, ref ${a.ref})`);
  const lines = [
    customer.calls > 1 ? `This is a returning caller (${customer.calls} calls so far).` : "This caller has not called before.",
    customer.name ? `Their name is ${customer.name}. Greet them by name naturally.` : "",
    past.length ? `Their bookings: ${past.join("; ")}.` : "",
    customer.notes ? `Notes about them: ${customer.notes}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

/** Customers who have not been in touch for `days` days: the win-back audience. */
export function lapsedCustomers(db, orgId, days, now = new Date()) {
  const cutoff = new Date(now.getTime() - days * 864e5).toISOString();
  return db.find("customers", (c) => c.orgId === orgId && !c.doNotCall && c.lastCallAt && c.lastCallAt < cutoff);
}

/** DPDP-style erasure: remove the customer and everything tied to their number. */
export function eraseCustomer(db, customer) {
  const mine = (row) => row.orgId === customer.orgId && samePhone(row.phone ?? row.callerNumber ?? row.to, customer.phone);
  const counts = {};
  const callIds = new Set(db.find("calls", mine).map((c) => c.id));
  for (const table of ["appointments", "leads", "messages", "calls"]) {
    const rows = db.find(table, mine);
    rows.forEach((r) => db.remove(table, r.id));
    counts[table] = rows.length;
  }
  for (const table of ["alerts", "questions"]) {
    db.find(table, (r) => callIds.has(r.callId)).forEach((r) => db.remove(table, r.id));
  }
  db.remove("customers", customer.id);
  return counts;
}
