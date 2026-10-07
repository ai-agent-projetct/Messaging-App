// A tiny JSON-file database. Good enough for a pilot with a handful of
// businesses; swap it for PostgreSQL before you have real traffic
// (see docs/LEARN.md, "Going to production").
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const EMPTY = () => ({
  users: [],
  sessions: [],
  orgs: [],
  agents: [],
  calls: [],
  appointments: [],
  leads: [],
  customers: [],
  questions: [],
  messages: [],
  alerts: [],
  campaigns: [],
  simulations: [],
});

export class Store {
  constructor(file) {
    this.file = file;
    this.data = EMPTY();
    if (file && fs.existsSync(file)) {
      this.data = { ...EMPTY(), ...JSON.parse(fs.readFileSync(file, "utf8")) };
    }
  }

  save() {
    if (!this.file) return; // in-memory mode (tests)
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file); // atomic replace, never a half-written file
  }

  insert(table, record) {
    const row = { id: newId(), createdAt: new Date().toISOString(), ...record };
    this.data[table].push(row);
    this.save();
    return row;
  }

  find(table, predicate) {
    return this.data[table].filter(predicate);
  }

  get(table, id) {
    return this.data[table].find((r) => r.id === id) ?? null;
  }

  update(table, id, changes) {
    const row = this.get(table, id);
    if (!row) return null;
    Object.assign(row, changes, { updatedAt: new Date().toISOString() });
    this.save();
    return row;
  }

  remove(table, id) {
    const before = this.data[table].length;
    this.data[table] = this.data[table].filter((r) => r.id !== id);
    this.save();
    return this.data[table].length !== before;
  }
}

export function newId() {
  return crypto.randomBytes(9).toString("base64url");
}
