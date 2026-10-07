// WhatsApp / SMS follow-ups and owner alerts, through an outbox.
// Every message is stored first (so the dashboard shows it), then sent.
//
// Sending uses Twilio's Messages API when TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
// and TWILIO_WHATSAPP_FROM / TWILIO_SMS_FROM are set. Without them messages are
// kept with status "not_configured" so nothing is silently lost.
// Note: WhatsApp only allows free-form business messages within 24 hours of the
// customer's last message; outside that window you need approved templates.

const TEST_CHANNELS = ["web", "simulation"];

export const transport = {
  async send({ channel, to, body }) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = channel === "whatsapp" ? process.env.TWILIO_WHATSAPP_FROM : process.env.TWILIO_SMS_FROM;
    if (!sid || !token || !from) return { status: "not_configured" };
    const prefix = channel === "whatsapp" ? "whatsapp:" : "";
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
      body: new URLSearchParams({ To: prefix + to, From: prefix + from.replace(/^whatsapp:/, ""), Body: body }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { status: "sent", providerId: data.sid } : { status: "failed", error: data.message || `HTTP ${res.status}` };
  },
};

/**
 * Store a message for a customer and send it.
 * Returns the stored message, or null when follow-ups are switched off.
 */
export function queueMessage(db, { orgId, to, kind, body, call = null, channel }) {
  const org = db.get("orgs", orgId);
  const useChannel = channel ?? org?.followUpChannel ?? "whatsapp";
  if (useChannel === "off" || !to) return null;
  const isTest = call && TEST_CHANNELS.includes(call.channel);
  const msg = db.insert("messages", {
    orgId,
    to,
    channel: useChannel,
    kind,
    body: body.slice(0, 1500),
    callId: call?.id ?? null,
    status: isTest ? "test" : "queued",
  });
  if (!isTest) dispatch(db, msg);
  return msg;
}

async function dispatch(db, msg) {
  try {
    const result = await transport.send(msg);
    db.update("messages", msg.id, { ...result, sentAt: result.status === "sent" ? new Date().toISOString() : null });
  } catch (err) {
    db.update("messages", msg.id, { status: "failed", error: String(err.message || err) });
  }
}

/**
 * Tell the business owner something: always shown in the dashboard's alert
 * feed; also sent to the owner's phone when alerts are on.
 */
export function notifyOwner(db, orgId, { kind, title, body, callId = null, urgent = false }) {
  const org = db.get("orgs", orgId);
  if (!org) return null;
  const alert = db.insert("alerts", { orgId, kind, title, body, callId, urgent, seen: false });
  const call = callId && db.get("calls", callId);
  if (org.ownerPhone && org.alertsEnabled !== false && !(call && TEST_CHANNELS.includes(call.channel))) {
    queueMessage(db, {
      orgId,
      to: org.ownerPhone,
      kind: `owner_${kind}`,
      body: `${urgent ? "🔴 " : ""}VoiceDesk: ${title}\n${body}`,
      channel: org.followUpChannel === "sms" ? "sms" : "whatsapp",
    });
  }
  return alert;
}
