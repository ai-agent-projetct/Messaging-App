// Email + password accounts. Passwords are hashed with scrypt (never stored
// in plain text) and logins get a random session token sent as a Bearer header.
import crypto from "node:crypto";

const SESSION_DAYS = 30;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function checkPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const candidate = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

export function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.insert("sessions", { token, userId, expiresAt });
  return token;
}

// Express middleware: attaches req.user and req.org, or answers 401.
export function requireAuth(db) {
  return (req, res, next) => {
    const token = (req.get("authorization") || "").replace(/^Bearer /, "");
    const session = token && db.find("sessions", (s) => s.token === token)[0];
    if (!session || session.expiresAt < new Date().toISOString()) {
      return res.status(401).json({ error: "Please sign in again." });
    }
    req.user = db.get("users", session.userId);
    req.org = req.user && db.get("orgs", req.user.orgId);
    if (!req.org) return res.status(401).json({ error: "Please sign in again." });
    req.sessionToken = token;
    next();
  };
}

export function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}
