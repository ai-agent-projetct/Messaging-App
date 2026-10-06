import http from 'node:http';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { loadBusiness, loadEnv, missingEnv } from './config.js';
import { LeadStore } from './db.js';
import { WhatsApp, verifySignature, parseWebhook } from './whatsapp.js';
import { SalesBot } from './bot.js';
import { createAgent } from './agent.js';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': typeof body === 'string' ? 'text/plain' : 'application/json' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function createServer({ cfg, bot, store, whatsapp, log = console.log }) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      /* Meta webhook verification handshake */
      if (req.method === 'GET' && url.pathname === '/webhook') {
        const ok = url.searchParams.get('hub.mode') === 'subscribe'
          && safeEqual(url.searchParams.get('hub.verify_token') || '', cfg.verifyToken);
        return ok ? send(res, 200, url.searchParams.get('hub.challenge') || '') : send(res, 403, 'forbidden');
      }

      if (req.method === 'POST' && url.pathname === '/webhook') {
        const raw = await readBody(req);
        if (!verifySignature(cfg.appSecret, raw, req.headers['x-hub-signature-256'])) return send(res, 401, 'bad signature');
        send(res, 200, 'ok');                      /* acknowledge fast; Meta retries slow webhooks */
        for (const msg of parseWebhook(JSON.parse(raw.toString('utf8')))) bot.receive(msg);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });

      /* Admin API - Authorization: Bearer <ADMIN_TOKEN> */
      if (url.pathname.startsWith('/admin/')) {
        if (!safeEqual(req.headers.authorization || '', `Bearer ${cfg.adminToken}`) || !cfg.adminToken) return send(res, 401, 'unauthorized');
        const parts = url.pathname.split('/').filter(Boolean);    /* admin, leads, :phone, action */
        const body = req.method === 'POST' ? JSON.parse((await readBody(req)).toString('utf8') || '{}') : {};

        if (req.method === 'GET' && parts[1] === 'leads' && !parts[2]) {
          const stage = url.searchParams.get('stage');
          const leads = store.all().filter(l => !stage || l.stage === stage).map(({ history, seen, ...l }) => ({ ...l, messages: history.length }));
          return send(res, 200, leads);
        }
        if (req.method === 'GET' && parts[1] === 'stats') {
          const counts = {};
          for (const l of store.all()) counts[l.stage] = (counts[l.stage] || 0) + 1;
          return send(res, 200, counts);
        }
        if (req.method === 'GET' && parts[1] === 'leads' && parts[2]) {
          const lead = store.get(parts[2]);
          return lead ? send(res, 200, lead) : send(res, 404, 'not found');
        }
        if (req.method === 'POST' && parts[1] === 'outreach') {
          const results = [];
          for (const l of body.leads || []) {
            try { results.push(await bot.outreach(l)); } catch (e) { results.push({ phone: l.phone, error: e.message }); }
          }
          return send(res, 200, results);
        }
        if (req.method === 'POST' && parts[1] === 'leads' && parts[2]) {
          if (!store.get(parts[2])) return send(res, 404, 'not found');
          if (parts[3] === 'takeover') return send(res, 200, bot.takeOver(parts[2]));
          if (parts[3] === 'resume') return send(res, 200, bot.resume(parts[2]));
          if (parts[3] === 'stage') return send(res, 200, store.upsert(parts[2], { stage: body.stage, nextFollowUpAt: null }));
          if (parts[3] === 'send' && body.text) {        /* a human replying through the bot's number */
            const lead = store.get(parts[2]);
            await whatsapp.sendText(lead.phone, body.text);
            return send(res, 200, store.addMessage(lead.phone, 'out', body.text, 'human'));
          }
        }
      }
      send(res, 404, 'not found');
    } catch (err) {
      log('request error:', err.message);
      if (!res.headersSent) send(res, 500, { error: err.message });
    }
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cfg = loadEnv();
  const missing = missingEnv(cfg);
  if (missing.length && !cfg.dryRun) {
    console.error(`Missing settings in .env: ${missing.join(', ')}. See .env.example.`);
    process.exit(1);
  }
  const biz = loadBusiness();
  const store = new LeadStore(cfg.dataFile);
  const whatsapp = new WhatsApp({ token: cfg.whatsappToken, phoneNumberId: cfg.phoneNumberId, graphVersion: cfg.graphVersion, dryRun: cfg.dryRun });
  const bot = new SalesBot({ store, whatsapp, decide: createAgent(), biz });

  createServer({ cfg, bot, store, whatsapp }).listen(cfg.port, () =>
    console.log(`WhatsApp sales bot for ${biz.business.name} listening on :${cfg.port}${cfg.dryRun ? ' (DRY RUN)' : ''}`));
  setInterval(() => bot.runFollowUps().catch(e => console.error('follow-up run failed:', e.message)), 60000);
}
