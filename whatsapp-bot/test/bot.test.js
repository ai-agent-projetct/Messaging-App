import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { SalesBot, inQuietHours, isOptOut } from '../src/bot.js';
import { LeadStore, normalizePhone } from '../src/db.js';
import { verifySignature, parseWebhook } from '../src/whatsapp.js';
import { loadBusiness } from '../src/config.js';
import { parseCsv } from '../src/import.js';
import { createServer } from '../src/server.js';

const biz = loadBusiness();
const HOUR = 3600000;

function setup({ decision = {}, start = '2026-10-06T06:00:00Z' } = {}) {   /* 11:30 IST */
  let now = new Date(start);
  const sent = [];
  const whatsapp = {
    sendText: async (to, text) => sent.push({ to, text }),
    sendTemplate: async (to, name, lang, params) => sent.push({ to, template: name, params }),
    markRead: () => {},
  };
  const calls = [];
  const decide = async (b, lead, opts) => {
    calls.push(opts.mode);
    return { reply: opts.mode === 'followup' ? 'Just checking in!' : 'Hi! How can I help?', stage: 'engaged',
      follow_up_in_hours: 0, needs_human: false, note: 'n', ...decision };
  };
  const store = new LeadStore(null);
  const bot = new SalesBot({ store, whatsapp, decide, biz, replyDelayMs: 0, log: () => {}, now: () => now });
  return { bot, store, sent, calls, advance: h => { now = new Date(now.getTime() + h * HOUR); } };
}

const inbound = (text, id = crypto.randomUUID()) => ({ id, from: '919876543210', name: 'Ravi Kumar', type: 'text', text });

test('normalizes Indian numbers', () => {
  assert.equal(normalizePhone('+91 93845 64915'), '919384564915');
  assert.equal(normalizePhone('9384564915'), '919384564915');
  assert.equal(normalizePhone('09384564915'), '919384564915');
});

test('replies to an inbound message and schedules a follow-up', async () => {
  const { bot, store, sent } = setup();
  await bot.receive(inbound('Hi, what do you charge for a website?'));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].text, 'Hi! How can I help?');
  const lead = store.get('919876543210');
  assert.equal(lead.name, 'Ravi Kumar');
  assert.equal(lead.stage, 'engaged');
  assert.ok(lead.nextFollowUpAt);
});

test('ignores duplicate webhook deliveries', async () => {
  const { bot, sent } = setup();
  await bot.receive(inbound('hello', 'wamid.1'));
  await bot.receive(inbound('hello', 'wamid.1'));
  assert.equal(sent.length, 1);
});

test('opt-out stops all messages', async () => {
  const { bot, store, sent, advance } = setup();
  await bot.receive(inbound('hi'));
  await bot.receive(inbound('STOP'));
  assert.equal(store.get('919876543210').stage, 'opted_out');
  assert.match(sent.at(-1).text, /won't get any more/);
  advance(200);
  assert.equal(await bot.runFollowUps(), 0);
  assert.equal(isOptOut(biz, 'please stop the bus'), false);
});

test('follow-up inside 24h window is AI-written, outside it uses the approved template', async () => {
  const { bot, sent, calls, advance } = setup();
  await bot.receive(inbound('Tell me about the growth package'));
  advance(biz.followUp.scheduleHours[0] + 0.1);
  await bot.runFollowUps();
  assert.equal(calls.at(-1), 'followup');
  assert.equal(sent.at(-1).text, 'Just checking in!');

  advance(48);   /* now well past the 24h window */
  await bot.runFollowUps();
  assert.equal(sent.at(-1).template, biz.templates.followUp);
  assert.deepEqual(sent.at(-1).params, ['Ravi']);
});

test('stops after max follow-ups and marks the lead lost', async () => {
  const { bot, store, advance } = setup();
  await bot.receive(inbound('hi'));
  for (let i = 0; i < 20; i++) { advance(24 * 8); await bot.runFollowUps(); }
  const lead = store.get('919876543210');
  assert.equal(lead.followUps, biz.followUp.maxAttempts);
  assert.equal(lead.stage, 'lost');
  assert.equal(lead.nextFollowUpAt, null);
});

test('no follow-ups during quiet hours', async () => {
  assert.equal(inQuietHours(biz, new Date('2026-10-06T17:00:00Z')), true);   /* 22:30 IST */
  assert.equal(inQuietHours(biz, new Date('2026-10-06T06:00:00Z')), false);  /* 11:30 IST */
  const { bot, advance } = setup({ start: '2026-10-06T10:00:00Z' });          /* 15:30 IST */
  await bot.receive(inbound('hi'));
  advance(5);                                                                 /* 20:30 IST */
  assert.equal(await bot.runFollowUps(), 0);
});

test('hand-off pauses the bot', async () => {
  const { bot, store, sent } = setup({ decision: { needs_human: true, reply: 'A teammate will reply shortly.' } });
  await bot.receive(inbound('I want to talk to a person'));
  const lead = store.get('919876543210');
  assert.equal(lead.stage, 'human');
  assert.equal(lead.paused, true);
  await bot.receive(inbound('hello?'));
  assert.equal(sent.length, 1);
});

test('outreach sends the opening template once', async () => {
  const { bot, sent } = setup();
  assert.deepEqual(await bot.outreach({ phone: '9876543210', name: 'Anitha' }), { phone: '919876543210', sent: true });
  assert.equal(sent[0].template, biz.templates.opening);
  assert.equal((await bot.outreach({ phone: '9876543210' })).skipped, 'contacted');
  assert.equal(sent.length, 1);
});

test('webhook signature and parsing', () => {
  const body = Buffer.from(JSON.stringify({ entry: [{ changes: [{ value: {
    contacts: [{ wa_id: '919876543210', profile: { name: 'Ravi' } }],
    messages: [{ id: 'w1', from: '919876543210', timestamp: '1759730000', type: 'text', text: { body: 'hi' } }],
  } }] }] }));
  const sig = 'sha256=' + crypto.createHmac('sha256', 'secret').update(body).digest('hex');
  assert.equal(verifySignature('secret', body, sig), true);
  assert.equal(verifySignature('other', body, sig), false);
  const [m] = parseWebhook(JSON.parse(body));
  assert.equal(m.text, 'hi');
  assert.equal(m.name, 'Ravi');
});

test('CSV import parsing', () => {
  assert.deepEqual(parseCsv('phone,name\n9876543210,Ravi\n'), [{ phone: '9876543210', name: 'Ravi', source: 'import' }]);
});

test('HTTP server: verification handshake, signed webhook, admin auth', async () => {
  const { bot, store, sent } = setup();
  const cfg = { verifyToken: 'vt', appSecret: 'secret', adminToken: 'adm' };
  const server = createServer({ cfg, bot, store, whatsapp: {}, log: () => {} }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    let r = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=42`);
    assert.equal(await r.text(), '42');
    r = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=no&hub.challenge=42`);
    assert.equal(r.status, 403);

    const body = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: 'x', from: '919876543210', type: 'text', text: { body: 'hi' } }] } }] }] });
    r = await fetch(`${base}/webhook`, { method: 'POST', body, headers: { 'x-hub-signature-256': 'sha256=00' } });
    assert.equal(r.status, 401);
    const sig = 'sha256=' + crypto.createHmac('sha256', 'secret').update(body).digest('hex');
    r = await fetch(`${base}/webhook`, { method: 'POST', body, headers: { 'x-hub-signature-256': sig } });
    assert.equal(r.status, 200);
    await new Promise(res => setTimeout(res, 50));
    assert.equal(sent.length, 1);

    r = await fetch(`${base}/admin/leads`);
    assert.equal(r.status, 401);
    r = await fetch(`${base}/admin/leads`, { headers: { Authorization: 'Bearer adm' } });
    assert.equal((await r.json()).length, 1);
  } finally {
    server.close();
  }
});
