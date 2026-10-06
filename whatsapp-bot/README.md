# WhatsApp Sales Bot

Runs your WhatsApp Business number (**+91 93845 64915**) on autopilot:

- **Replies to every customer message** within seconds, 24/7, in the customer's language
  (English, Tamil, Hindi, Tanglish/Hinglish).
- **Qualifies the lead**, recommends the right package, handles objections and **sends your
  payment or booking link** once they're ready to buy.
- **Follows up by itself** when a customer goes quiet (default: 4h, 1 day, 3 days, 7 days),
  only between 9am and 8pm IST, then marks the lead lost.
- **Contacts new leads first** (from your website form, ads, walk-ins) with an approved template.
- **Hands off to you** when a customer asks for a person, complains, or asks something outside
  your playbook, and sends you an alert on WhatsApp.
- **Honours STOP** right away and never messages that person again.

It uses the official **WhatsApp Cloud API** from Meta and **Claude** (Anthropic) to write the
messages. It doesn't use unofficial "WhatsApp Web" automation, which gets numbers banned.

---

## 1. Set up the number on the WhatsApp Business Platform (one time, about 1 hour)

1. Create a **Meta Business portfolio** at <https://business.facebook.com> and verify your business
   (GST certificate or similar). Without verification you can only message 250 people a day.
2. Go to <https://developers.facebook.com> → **Create app** → type **Business** → add the
   **WhatsApp** product.
3. In **WhatsApp → API Setup → Add phone number**, enter **+91 93845 64915** and verify it by SMS/call.
   - If the number already uses the **WhatsApp Business app**, either pick the option to keep
     using the app alongside the API ("coexistence", if Meta offers it for your number), or
     back up your chats and delete the WhatsApp account on that number first. A number can't
     be on the normal WhatsApp app and the API at the same time.
4. **Permanent token**: Business Settings → Users → **System users** → Add → give it the app with
   `whatsapp_business_messaging` and `whatsapp_business_management` → **Generate token**.
   Copy the token and the **Phone number ID** shown on API Setup.
5. **App secret**: App settings → Basic → App secret.
6. **Add a payment method** in WhatsApp Manager. Meta charges per template message
   (marketing/utility); replies to customers who messaged you within 24h are free.

## 2. Create two message templates

In **WhatsApp Manager → Message templates**, create these and wait for approval (minutes to a day):

| Name | Category | Example body (`{{1}}` = first name) |
|---|---|---|
| `lead_intro` | Marketing | Hi {{1}}, thanks for your interest in our services! I'm Priya. What kind of business do you run? Reply STOP to opt out. |
| `lead_followup` | Marketing | Hi {{1}}, just following up on your enquiry. We still have a slot this week. Want me to share the details? Reply STOP to opt out. |

WhatsApp only lets a business start a conversation, or write again after 24 hours of silence,
with an approved template. The bot handles this for you: it writes its own messages inside the
24-hour window and uses these templates outside it.

## 3. Fill in your playbook

Edit **`business.config.json`** with your business name, what you sell, packages and prices,
payment link (Razorpay/UPI/Instamojo), booking link, discount limit, objections, tone, follow-up
timing and your own number for hand-off alerts (`handoff.notifyNumber`).
**The bot only quotes prices and offers written there.**

## 4. Run it

You need Node.js 20+ and a server with HTTPS (Render, Railway, a VPS, etc.).

```bash
cd whatsapp-bot
cp .env.example .env      # fill in the values from steps 1 and 4 plus an Anthropic API key
npm install
npm start
```

Get an Anthropic API key at <https://console.anthropic.com>.

Then, in the Meta app → **WhatsApp → Configuration → Webhook**:

- Callback URL: `https://YOUR-SERVER/webhook`
- Verify token: the same `WHATSAPP_VERIFY_TOKEN` you put in `.env`
- Subscribe to the **messages** field.

Send a message to +91 93845 64915 from another phone. You should get an answer within a few seconds.

To try it without sending real messages, set `DRY_RUN=1` and every outgoing message is
printed instead of sent.

## 5. Bring in leads

Only add people who agreed to hear from you on WhatsApp (website form, ad lead form, walk-in).
Messaging bought lists gets the number blocked by Meta fast.

```bash
# leads.csv:  phone,name
#             9876543210,Ravi Kumar
npm run import -- leads.csv
```

Leads who message you first (from a click-to-WhatsApp ad, your website button, a QR code) are
picked up automatically.

## 6. Watch the pipeline and step in

All admin calls need `Authorization: Bearer <ADMIN_TOKEN>`.

| Call | What it does |
|---|---|
| `GET /admin/stats` | Count of leads per stage |
| `GET /admin/leads?stage=proposal` | Leads (filter by stage) with the bot's note on each |
| `GET /admin/leads/919876543210` | Full conversation |
| `POST /admin/leads/919876543210/takeover` | Bot stops; you handle this customer |
| `POST /admin/leads/919876543210/send` `{"text":"..."}` | Reply as a human from the business number |
| `POST /admin/leads/919876543210/resume` | Give the customer back to the bot |
| `POST /admin/leads/919876543210/stage` `{"stage":"won"}` | Mark won/lost manually |

Stages: `new → contacted → engaged → qualified → proposal → won` / `lost`, plus `human` (handed
off) and `opted_out`.

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://YOUR-SERVER/admin/stats
```

---

## How it works

```
Customer ──WhatsApp──▶ Meta Cloud API ──webhook──▶ src/server.js
                                                      │
                                   src/bot.js  (opt-out, dedupe, hand-off, 24h window, follow-up timer)
                                                      │
                                   src/agent.js (Claude reads your playbook + chat, returns
                                                 reply · stage · when to follow up · needs human)
                                                      │
Customer ◀──────────── src/whatsapp.js (text or approved template)
```

Leads are stored in `data/leads.json`. Run `npm test` to check the logic.

## Rules to stay within

- Message only people who opted in, and keep the "Reply STOP" line in templates.
- Low reply rates and blocks lower your quality rating and messaging limit, so keep follow-ups
  useful and few (the defaults stop after 4).
- Review a few conversations every day for the first week and adjust `business.config.json`.
