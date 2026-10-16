# iThrive Software — WhatsApp AI Sales Assistant

Automatic replies to enquiries on **+91 93845 64915** for [iThrive Software](https://ithrivesoftware.com/).
Each enquiry is qualified, saved as a lead, and handed to your sales team when it's serious.

Setup chosen:

| Decision | Choice |
|---|---|
| WhatsApp setup | **Official WhatsApp Business Platform (Cloud API)** on +91 93845 64915 |
| How it replies | **Hybrid**: fixed rules for STOP and "talk to a person", plus AI conversation, with human hand-over |
| Where leads live | **Custom iThrive admin dashboard**, with CSV export and an **n8n/CRM webhook** |

## What it does

1. **Replies within seconds, 24/7**, in the client's language (English, Tamil, Hindi, Tanglish…).
   The first reply includes a welcome to iThrive Software.
2. **Understands the enquiry**: AI agents, chatbots/RAG, mobile apps, websites, e-commerce, ERP,
   cloud/DevOps, MVPs, dedicated developers, or support for an existing project.
3. **Answers only from your knowledge base.** It doesn't invent prices, dates, clients or case
   studies. For pricing it explains that cost depends on scope and offers a consultation.
4. **Qualifies the lead step by step.** It asks one or two questions at a time and never repeats a
   question already answered. It collects:
   name, company, project, problem, features, platforms, market, budget, launch date, and how to
   contact them.
5. **Scores every lead** as hot, warm or cold, and gives it a stage:
   new → engaged → qualifying → qualified → meeting requested → won/lost.
6. **Alerts sales** once a lead is hot or qualified. The alert goes by WhatsApp to a salesperson
   and/or as JSON to n8n, a CRM, email or Slack.
7. **Hands over to a human** when the client asks for a person, needs a quotation or contract, is
   an existing client, complains, or asks something the knowledge base can't answer. The AI goes
   silent on that chat until your team hands it back.
8. **Follows up on quiet leads** without spamming:
   - up to 3 follow-ups, never between 9pm and 9am IST;
   - inside WhatsApp's 24-hour window the AI writes a personalised message;
   - after that it uses an approved template, but only if you set one;
   - it stops as soon as the client replies or says STOP.
9. **Admin dashboard** at `/admin`:
   - leads with search and filters;
   - the full conversation;
   - reply as a person, take over a chat, or hand it back to the AI;
   - edit lead details and notes;
   - edit the knowledge base / FAQs;
   - stats (enquiries, hot leads, waiting for a person, won, average first response time);
   - activity log and CSV export.
10. **Reliability and security**:
    - checks the signature on every webhook from Meta;
    - ignores duplicate deliveries;
    - retries WhatsApp sends;
    - falls back to a human if the AI service fails;
    - shows delivery status (sent, delivered, read, failed) for each message;
    - password-protects the dashboard;
    - keeps all secrets in environment variables;
    - deletes old messages automatically (`DATA_RETENTION_DAYS`).

Example:

> **Client:** Hi, I need an AI-powered mobile app for my business. How much will it cost?
> **Assistant:** Hello! Welcome to iThrive Software 👋 We build AI-powered apps, mobile apps, websites and
> custom software. Cost depends on features, platforms and integrations — our team prepares an estimate
> after a short consultation. What kind of app are you planning?
> **Client:** A taxi booking app with AI features.
> **Assistant:** Great — that usually means passenger and driver apps, an admin dashboard, live tracking,
> payments and smart dispatch. Do you need Android, iOS or both, and is it for India?

## 1. Connect +91 93845 64915 to the WhatsApp Cloud API

1. **Meta Business portfolio**: create one at <https://business.facebook.com> and verify iThrive
   Software (GST or incorporation certificate). Verification raises your sending limits.
2. **Meta app**: at <https://developers.facebook.com>, choose **Create app → Business**, then add
   the **WhatsApp** product.
3. **Add the number**: in **WhatsApp → API Setup → Add phone number**, add **+91 93845 64915** and
   verify it.
   - If the number currently runs the **WhatsApp Business app**, Meta may offer *coexistence*
     (keep the app and the API on the same number). Otherwise, back up your chats and delete the
     app's account on that number first.
4. **Permanent token**: go to **Business Settings → System users → Add**. Assign the app with the
   `whatsapp_business_messaging` and `whatsapp_business_management` permissions, then click
   **Generate token**.
5. **IDs and secret**: copy the **Phone number ID** (from API Setup) and the **App secret** (from
   App settings → Basic).
6. **Payment method**: add one in WhatsApp Manager. Replies to clients who messaged you in the last
   24 hours are free. Template messages are charged per message.
7. **Optional template**: for follow-ups after 24 hours, create one in WhatsApp Manager
   (category Utility or Marketing). Example:
   *"Hi {{1}}, thanks for your enquiry with iThrive Software. Would you like to schedule a short call to
   discuss your project? Reply STOP to opt out."*
   Put its name in `FOLLOWUP_TEMPLATE`.

## 2. Run it

**With Docker (recommended):**

```bash
cd ithrive-whatsapp
cp .env.example .env          # fill in the values from step 1, an Anthropic API key and an admin password
POSTGRES_PASSWORD=<strong-password> docker compose up -d --build
```

**Without Docker:**

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill it in
set -a && . ./.env && set +a
uvicorn app.main:run --factory --host 0.0.0.0 --port 8000
```

You need a server with **HTTPS**, such as a VPS behind Nginx/Caddy, Render, Railway or Fly.io.
Get the AI key at <https://console.anthropic.com> and put it in `ANTHROPIC_API_KEY`.

**Connect the webhook.** In the Meta app, open **WhatsApp → Configuration → Webhook**:

- Callback URL: `https://YOUR-DOMAIN/webhook`
- Verify token: the same value as `WHATSAPP_VERIFY_TOKEN`
- Subscribe to the **messages** field.

**Test it.** Message +91 93845 64915 from another phone, then open `https://YOUR-DOMAIN/admin`.
Set `DRY_RUN=1` to try everything without sending real WhatsApp messages.

## 3. Before going live

- **Fill in the knowledge base** (Dashboard → Knowledge base). Replace every `[STAFF: …]`
  placeholder: location, working hours, project process, approved case studies, full tech stack.
  The assistant answers only from what is written there. The starting content comes from the
  services listed on ithrivesoftware.com, so check it.
- **Set `SALES_WHATSAPP`** to the salesperson's number. WhatsApp only delivers free-form alerts if
  that number has messaged the business number in the last 24 hours. For guaranteed alerts, also
  set `N8N_WEBHOOK_URL` and send them on by email or Slack from n8n.
- Read the first few days of conversations in the dashboard and adjust the knowledge base.

## n8n / CRM integration

When a lead becomes qualified or needs a person, the app sends this to `N8N_WEBHOOK_URL`:

```json
{ "event": "lead.qualified",            // or "lead.handover"
  "lead": { "id": 12, "phone": "919876543210", "whatsapp_link": "https://wa.me/919876543210",
            "name": "Ravi", "company": "Ravi Cabs", "project_type": "Taxi booking app",
            "platforms": "Android, iOS", "market": "India", "budget": "discuss", "timeline": "March",
            "service": "mobile_app", "score": "hot", "stage": "qualified", "summary": "…" } }
```

In n8n, use a **Webhook** node. From there you can create a deal in Zoho/HubSpot, add a row to
Google Sheets, email the sales team, or book a calendar slot. `/admin/export.csv` exports every
lead for a spreadsheet or CRM import.

## Rules (WhatsApp policy)

- Only message people who contacted you, or who agreed to hear from you on WhatsApp.
- Outside the 24-hour window, use only approved templates. The app does this automatically.
- STOP is honoured immediately and permanently, unless the client writes again.
- Too many blocks or reports lower your number's quality rating, so keep follow-ups few and useful.

## Code

```
app/
  main.py        FastAPI app: /webhook, /admin dashboard, background scheduler
  service.py     conversation engine: replies, hand-over, alerts, follow-ups, opt-out
  ai.py          Claude: structured decision (reply, intent, lead details, score, stage, hand-over)
  prompt.py      master prompt for the iThrive assistant
  knowledge.py   starting knowledge base (editable in the dashboard)
  whatsapp.py    WhatsApp Cloud API client, signature check, webhook parsing
  notify.py      sales alerts (WhatsApp + n8n/CRM webhook)
  db.py          PostgreSQL / SQLite models: leads, messages, knowledge, events
  templates/     dashboard pages
tests/           run with:  python -m pytest
```

The whole knowledge base goes into every AI request, using prompt caching. A separate vector
database (pgvector) isn't needed until it grows beyond a few hundred entries.
