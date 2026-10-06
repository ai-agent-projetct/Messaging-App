/* Orchestration: inbound replies, scheduled follow-ups and first-contact outreach. */
import { OPEN_STAGES, normalizePhone } from './db.js';

const HOUR = 3600000;
const WINDOW_MS = 24 * HOUR;   /* WhatsApp customer-service window */

export function hourIn(timezone, date) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' }).format(date));
}

export function inQuietHours(biz, now) {
  const q = biz.followUp.quietHours;
  if (!q) return false;
  const h = hourIn(q.timezone, now);
  return h < q.start || h >= q.end;
}

export function insideWindow(lead, now) {
  return !!lead.lastInboundAt && now - new Date(lead.lastInboundAt) < WINDOW_MS;
}

export function isOptOut(biz, text) {
  const t = String(text || '').toLowerCase().replace(/[^\p{L}\p{N}' ]/gu, ' ').replace(/\s+/g, ' ').trim();
  return biz.optOutKeywords.some(k => t === k || t.startsWith(k + ' '));
}

const firstName = lead => (lead.name || '').split(/\s+/)[0] || 'there';

export class SalesBot {
  constructor({ store, whatsapp, decide, biz, replyDelayMs = 4000, log = console.log, now = () => new Date() }) {
    Object.assign(this, { store, wa: whatsapp, decide, biz, replyDelayMs, log, now });
    this.timers = new Map();
    this.chains = new Map();
  }

  /* Run jobs for the same customer one at a time. */
  #serial(phone, job) {
    const prev = this.chains.get(phone) || Promise.resolve();
    const next = prev.then(job).catch(err => this.log('error for', phone, err.message));
    this.chains.set(phone, next);
    return next;
  }

  #schedule(lead, hours) {
    const fu = this.biz.followUp;
    if (!OPEN_STAGES.includes(lead.stage) || lead.paused || lead.followUps >= fu.maxAttempts) {
      lead.nextFollowUpAt = null;
    } else {
      const h = hours > 0 ? hours : (fu.scheduleHours[lead.followUps] ?? fu.scheduleHours.at(-1));
      lead.nextFollowUpAt = new Date(this.now().getTime() + h * HOUR).toISOString();
    }
  }

  async #send(lead, text, kind = 'text') {
    await this.wa.sendText(lead.phone, text);
    this.store.addMessage(lead.phone, 'out', text, kind, this.now());
  }

  /* Called for every message that arrives on the webhook. */
  receive(msg) {
    const phone = normalizePhone(msg.from);
    const lead = this.store.get(phone) || this.store.upsert(phone, { source: 'inbound' });
    lead.seen = lead.seen || [];
    if (msg.id && lead.seen.includes(msg.id)) return Promise.resolve();   /* Meta retries webhooks */
    if (msg.id) lead.seen = [...lead.seen.slice(-49), msg.id];
    if (msg.name && !lead.name) lead.name = msg.name;
    this.store.addMessage(phone, 'in', msg.text, msg.type, msg.timestamp || this.now());
    if (msg.id) this.wa.markRead(msg.id);

    if (isOptOut(this.biz, msg.text)) {
      clearTimeout(this.timers.get(phone));
      return this.#serial(phone, async () => {
        const l = this.store.upsert(phone, { stage: 'opted_out', nextFollowUpAt: null });
        await this.#send(l, `Done - you won't get any more messages from ${this.biz.business.name}. If you ever need us, just say hi here.`);
      });
    }

    /* Wait briefly so several quick messages get one combined reply. */
    clearTimeout(this.timers.get(phone));
    return new Promise(resolve => {
      this.timers.set(phone, setTimeout(() => {
        this.timers.delete(phone);
        resolve(this.#serial(phone, () => this.#reply(phone)));
      }, this.replyDelayMs));
    });
  }

  async #reply(phone) {
    const lead = this.store.get(phone);
    if (lead.paused || lead.stage === 'human') {
      this.log(`+${phone} is with a human; not auto-replying`);
      return;
    }
    if (lead.stage === 'opted_out') lead.stage = 'engaged';   /* they came back on their own */
    if (lead.history.at(-1)?.dir !== 'in') return;            /* already answered */

    const d = await this.decide(this.biz, lead, { mode: 'reply' });
    if (d.reply) await this.#send(lead, d.reply);
    this.#apply(lead, d);
  }

  #apply(lead, d) {
    lead.stage = d.stage;
    if (d.note) lead.notes = d.note;
    if (d.needs_human) {
      lead.paused = true;
      lead.stage = 'human';
      this.#alertHuman(lead).catch(err => this.log('handoff alert failed:', err.message));
    }
    lead.followUps = 0;
    this.#schedule(lead, d.follow_up_in_hours);
    this.store.upsert(lead.phone, lead);
  }

  async #alertHuman(lead) {
    this.log(`HANDOFF +${lead.phone} (${lead.name}): ${lead.notes}`);
    const to = normalizePhone(this.biz.handoff.notifyNumber);
    if (to) await this.wa.sendText(to, `Lead needs you: ${lead.name || ''} +${lead.phone}\n${lead.notes}\nhttps://wa.me/${lead.phone}`);
  }

  /* Called every minute. Sends follow-ups that are due. */
  async runFollowUps() {
    const now = this.now();
    if (inQuietHours(this.biz, now)) return 0;
    const due = this.store.all().filter(l => OPEN_STAGES.includes(l.stage) && !l.paused && l.nextFollowUpAt
      && new Date(l.nextFollowUpAt) <= now && l.history.at(-1)?.dir === 'out');
    for (const lead of due) await this.#serial(lead.phone, () => this.#followUp(lead.phone));
    return due.length;
  }

  async #followUp(phone) {
    const lead = this.store.get(phone);
    const now = this.now();
    if (!lead.nextFollowUpAt || new Date(lead.nextFollowUpAt) > now || lead.history.at(-1)?.dir !== 'out') return;

    if (insideWindow(lead, now)) {
      const d = await this.decide(this.biz, lead, { mode: 'followup' });
      if (d.reply) await this.#send(lead, d.reply, 'followup');
      lead.stage = d.stage;
      if (d.note) lead.notes = d.note;
    } else {
      const t = this.biz.templates;
      await this.wa.sendTemplate(phone, t.followUp, t.language, [firstName(lead)]);
      this.store.addMessage(phone, 'out', `[template ${t.followUp}]`, 'template', now);
    }
    lead.followUps += 1;
    if (lead.followUps >= this.biz.followUp.maxAttempts) {
      lead.stage = 'lost';
      lead.notes = `${lead.notes ? lead.notes + ' | ' : ''}No reply after ${lead.followUps} follow-ups.`;
    }
    this.#schedule(lead, 0);
    this.store.upsert(phone, lead);
  }

  /* First contact with a lead who opted in (form, ad, walk-in) but hasn't messaged yet. */
  async outreach({ phone, name = '', source = 'import' }) {
    const id = normalizePhone(phone);
    const existing = this.store.get(id);
    if (existing && existing.stage !== 'new') return { phone: id, skipped: existing.stage };
    const lead = this.store.upsert(id, { name: existing?.name || name, source });
    const t = this.biz.templates;
    await this.wa.sendTemplate(id, t.opening, t.language, [firstName(lead)]);
    this.store.addMessage(id, 'out', `[template ${t.opening}]`, 'template', this.now());
    lead.stage = 'contacted';
    this.#schedule(lead, Math.max(24, this.biz.followUp.scheduleHours[0]));
    this.store.upsert(id, lead);
    return { phone: id, sent: true };
  }

  /* Admin actions */
  takeOver(phone) { return this.store.upsert(phone, { paused: true, stage: 'human', nextFollowUpAt: null }); }

  resume(phone) {
    const lead = this.store.upsert(phone, { paused: false, stage: 'engaged', followUps: 0 });
    this.#schedule(lead, 0);
    return this.store.upsert(phone, lead);
  }
}
