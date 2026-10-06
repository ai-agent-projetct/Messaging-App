/* Lead store: a single JSON file, written atomically. Fine for a few thousand leads;
   swap for a real database if you outgrow it. */
import fs from 'node:fs';
import path from 'node:path';

export const OPEN_STAGES = ['new', 'contacted', 'engaged', 'qualified', 'proposal'];
export const STAGES = [...OPEN_STAGES, 'won', 'lost', 'opted_out', 'human'];

export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10) d = '91' + d;          /* bare Indian mobile number */
  if (d.startsWith('0') && d.length === 11) d = '91' + d.slice(1);
  return d;
}

export class LeadStore {
  constructor(file) {
    this.file = file;
    this.leads = {};
    if (file && fs.existsSync(file)) this.leads = JSON.parse(fs.readFileSync(file, 'utf8')).leads || {};
  }

  save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ leads: this.leads }, null, 2));
    fs.renameSync(tmp, this.file);
  }

  get(phone) { return this.leads[normalizePhone(phone)] || null; }

  all() { return Object.values(this.leads); }

  upsert(phone, fields = {}) {
    const id = normalizePhone(phone);
    const lead = this.leads[id] || {
      phone: id, name: '', source: '', stage: 'new', notes: '', history: [],
      createdAt: new Date().toISOString(), lastInboundAt: null, lastOutboundAt: null,
      followUps: 0, nextFollowUpAt: null, paused: false,
    };
    Object.assign(lead, fields);
    this.leads[id] = lead;
    this.save();
    return lead;
  }

  addMessage(phone, dir, text, kind = 'text', at = new Date()) {
    const lead = this.upsert(phone);
    const ts = at.toISOString();
    lead.history.push({ dir, text, kind, ts });
    if (lead.history.length > 200) lead.history = lead.history.slice(-200);
    if (dir === 'in') lead.lastInboundAt = ts; else lead.lastOutboundAt = ts;
    this.save();
    return lead;
  }
}
