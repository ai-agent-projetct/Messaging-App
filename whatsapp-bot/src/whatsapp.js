/* WhatsApp Cloud API (official Meta API) client. */
import crypto from 'node:crypto';

export function verifySignature(appSecret, rawBody, header) {
  if (!appSecret || !header || !header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const given = header.slice(7);
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'));
}

/* Flatten a webhook payload into simple inbound messages. */
export function parseWebhook(body) {
  const out = [];
  for (const entry of body?.entry || []) {
    for (const change of entry.changes || []) {
      const v = change.value || {};
      const names = Object.fromEntries((v.contacts || []).map(c => [c.wa_id, c.profile?.name || '']));
      for (const m of v.messages || []) {
        out.push({ id: m.id, from: m.from, name: names[m.from] || '', type: m.type,
          text: messageText(m), timestamp: new Date(Number(m.timestamp) * 1000 || Date.now()) });
      }
    }
  }
  return out;
}

function messageText(m) {
  switch (m.type) {
    case 'text': return m.text?.body || '';
    case 'button': return m.button?.text || '';
    case 'interactive': return m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '';
    case 'image': case 'video': case 'document':
      return `[customer sent a ${m.type}${m[m.type]?.caption ? `: "${m[m.type].caption}"` : ''}]`;
    case 'audio': return '[customer sent a voice note - ask them to type it, or hand off if it looks important]';
    case 'location': return `[customer shared a location: ${m.location?.name || ''} ${m.location?.address || ''}]`.trim();
    default: return `[customer sent a ${m.type} message]`;
  }
}

export class WhatsApp {
  constructor({ token, phoneNumberId, graphVersion = 'v23.0', dryRun = false, fetchImpl = fetch, log = console.log }) {
    Object.assign(this, { token, phoneNumberId, graphVersion, dryRun, fetchImpl, log });
  }

  async #post(payload) {
    if (this.dryRun) { this.log('[DRY_RUN] would send', JSON.stringify(payload)); return { dryRun: true }; }
    const res = await this.fetchImpl(`https://graph.facebook.com/${this.graphVersion}/${this.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${JSON.stringify(data.error || data)}`);
    return data;
  }

  sendText(to, body) {
    return this.#post({ recipient_type: 'individual', to, type: 'text', text: { body, preview_url: true } });
  }

  /* Business-initiated messages (first contact, or >24h since the customer last wrote)
     must use a template Meta has approved. */
  sendTemplate(to, name, language, params = []) {
    const components = params.length
      ? [{ type: 'body', parameters: params.map(text => ({ type: 'text', text: String(text) })) }] : [];
    return this.#post({ to, type: 'template', template: { name, language: { code: language }, components } });
  }

  markRead(messageId) {
    return this.#post({ status: 'read', message_id: messageId }).catch(() => {});
  }
}
