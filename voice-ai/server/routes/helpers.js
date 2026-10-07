// Shared bits for the API routers.

/** Fetch a row that must belong to the signed-in business, or answer 404. */
export function owned(db, table, req, res, label = "Not found.") {
  const row = db.get(table, req.params.id);
  if (!row || row.orgId !== req.org.id) {
    res.status(404).json({ error: label });
    return null;
  }
  return row;
}

/** Wraps async handlers so errors reach Express's error handler. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Simple fixed-window rate limiter keyed by any string (IP, email...).
 * hit(key) counts one attempt and returns false once over the limit;
 * hit.blocked(key) checks without counting.
 */
export function rateLimiter({ limit, windowMs }) {
  const hits = new Map();
  const live = (key) => {
    const entry = hits.get(key);
    return entry && entry.reset >= Date.now() ? entry : null;
  };
  const hit = (key) => {
    const now = Date.now();
    const entry = live(key);
    if (!entry) {
      hits.set(key, { count: 1, reset: now + windowMs });
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
      return true;
    }
    entry.count++;
    return entry.count <= limit;
  };
  hit.blocked = (key) => (live(key)?.count ?? 0) >= limit;
  return hit;
}

export function isAdmin(user) {
  const admins = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return Boolean(user && admins.includes(user.email));
}
