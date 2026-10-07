# VoiceDesk: the AI front desk for local businesses

VoiceDesk answers a business's phone calls (and website chats) with an AI receptionist that
books appointments, answers questions, remembers customers, sends WhatsApp follow-ups, and
reports the money it made. It speaks English and 9 Indian languages, including mixed speech
such as Hinglish.

**Read first:**
- [docs/STRATEGY.md](docs/STRATEGY.md): market analysis, positioning and why these features
- [docs/LEARN.md](docs/LEARN.md): how voice AI works, how to run it, and how to launch

## What's in the product

| Area | Features |
|---|---|
| **Receptionist** | Industry templates · **AI setup assistant** (from a website link or notes) · services with prices · opening hours · FAQs · 10 languages and code-mixing |
| **On the call** | Book / check / **cancel / reschedule** by voice · save leads · send info on WhatsApp · **alert the owner** · transfer to a person · respects "don't call me" |
| **Gets smarter** | **"Teach it"**: questions it couldn't answer become answers · **caller memory** (greets returning callers by name, knows their bookings) |
| **Quality** | **Readiness Test Lab**: AI role-plays tough callers and an AI examiner scores the receptionist with exact fixes |
| **After the call** | **AI analysis** (summary, intent, mood, hot/warm/cold lead score) · WhatsApp/SMS **confirmations** · **reminders** the day before · hot-lead and unhappy-caller **alerts** |
| **Owner** | **ROI dashboard** (revenue in ₹, after-hours calls caught) · **daily WhatsApp brief** · **live calls with one-tap takeover** · customers · bookings · leads · CSV export · **erase customer data** |
| **Growth** | **Outbound campaigns** (win-back, reminders) with consent records, a 9am–9pm calling window, do-not-call and AI disclosure enforced in code · **website voice/chat widget** |
| **Business** | Plans with minute and receptionist limits · a polite hand-off to a person when minutes run out · **platform admin console** · rate limiting · Twilio signature checks |

## Run it on your computer

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
cd voice-ai
npm install
npm start
```

Open <http://localhost:3000> for the website and <http://localhost:3000/app> for the dashboard.
Without an API key everything runs in **demo mode** (placeholder replies). To turn on the AI,
phone calls and messaging:

```bash
cp .env.example .env      # fill in the keys you have
npm run dev               # loads .env and restarts when you edit code
```

To see the admin console, put your email in `ADMIN_EMAILS`.

## Tests

```bash
npm test
```

There are 21 end-to-end tests, all running without any paid account. They cover accounts and
data isolation, phone webhooks and signature checks, booking rules, the Claude tool loop and
structured analysis (against a fake API), caller memory, self-service privacy, the teaching
loop, alerts, ROI, briefs, reminders, live takeover, plan limits, campaign compliance, the
widget, the Test Lab, the setup assistant, admin, CSV export and data erasure.

## Project layout

```
server/
  index.js            starts the web server and the background scheduler
  agent.js            the AI brain: system prompt + Claude + tool loop (+ demo brain)
  tools.js            what the receptionist can do on a call, with the business rules
  llm.js              Claude client: messages, structured JSON, refusal fallbacks
  calls.js            call lifecycle (start, end, then analysis)
  analysis.js         post-call AI analysis and owner alerts
  customers.js        caller memory, win-back audiences, data erasure
  messaging.js        WhatsApp/SMS outbox and owner notifications
  insights.js         ROI numbers and the daily brief
  scheduler.js        reminders, briefs, stale-call cleanup, campaign dialling
  campaigns.js        outbound campaigns with compliance rules
  simulator.js        Readiness Test Lab
  setup-assistant.js  AI setup from a website link or notes
  plans.js            plans and usage metering
  telephony.js        placing outbound calls via Twilio
  routes/             HTTP API: account, agents, records, growth, public (widget), admin, twilio
public/
  index.html          marketing website
  app.html, js/       dashboard (plain ES modules, no build step)
  widget.js           embeddable "Talk to us" widget
test/                 automated tests
docs/                 STRATEGY.md, LEARN.md
```
