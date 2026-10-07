// Placing outbound calls through Twilio's REST API. Inbound calls arrive via
// webhooks (routes/twilio.js); this file is only for calls *we* start.

export const dialer = {
  /** Returns { ok, sid?, error? }. */
  async call({ to, url, statusCallback }) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_CALLER_ID;
    if (!sid || !token || !from || !process.env.PUBLIC_URL) {
      return { ok: false, error: "Outbound calling is not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_CALLER_ID, PUBLIC_URL)." };
    }
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
      method: "POST",
      headers: { authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
      body: new URLSearchParams({
        To: to,
        From: from,
        Url: url,
        StatusCallback: statusCallback,
        StatusCallbackEvent: "completed",
      }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, sid: data.sid } : { ok: false, error: data.message || `HTTP ${res.status}` };
  },
};

export function publicUrl(path) {
  return `${(process.env.PUBLIC_URL || "").replace(/\/$/, "")}${path}`;
}
