# Building a voice AI business: a beginner's guide

This guide explains how a product like VoiceDesk works, what each piece of this code does,
and the steps from "it runs on my laptop" to "local businesses pay me every month".

---

## 1. What a voice AI agent actually is

When a customer calls, five things happen in a loop:

```
 Caller speaks
     │
     ▼
 ┌──────────────┐   ┌────────────────┐   ┌──────────────┐   ┌──────────────┐
 │  TELEPHONY   │──▶│  EARS (STT)    │──▶│  BRAIN (LLM) │──▶│ MOUTH (TTS)  │──▶ caller hears reply
 │ phone network│   │ speech → text  │   │ decides reply│   │ text → speech│
 └──────────────┘   └────────────────┘   └──────┬───────┘   └──────────────┘
                                                │ uses tools
                                                ▼
                                   book slot · save lead · transfer · hang up
```

| Piece | Job | In this project |
|---|---|---|
| **Telephony** | Connects real phone calls to your server | Twilio |
| **STT** (speech-to-text) | Turns the caller's voice into text | Twilio's built-in speech recognition |
| **LLM** (large language model) | Understands the request and writes the reply | Claude (Anthropic) |
| **Tools** | Lets the AI *do* things, not just talk | `server/tools.js` |
| **TTS** (text-to-speech) | Reads the reply aloud | Twilio `<Say>` with Google voices |

The **dashboard** is the part businesses see. The **website** sells the product. The
"magic" in a voice AI company is mostly in making the loop above **fast, reliable and
well-informed about the business**.

## 2. How a phone call flows through this code

1. A customer dials the business's Twilio number.
2. Twilio sends a web request to `POST /twilio/voice` (`server/routes/twilio.js`).
3. The server finds which receptionist owns that number, creates a call record and replies
   with **TwiML**, a small XML file of instructions: *say the greeting, then listen*.
4. Twilio plays the greeting, listens and converts the caller's speech to text. It sends
   that text to `POST /twilio/gather/<callId>`.
5. The server passes the text to `respond()` in `server/agent.js`. That function builds the
   **system prompt** (business info, hours, rules for speaking on the phone) and calls Claude.
6. Claude either replies or asks to use a **tool**, for example
   `check_availability(date: "2026-10-09")`. The server runs the tool (`server/tools.js`),
   gives the result back to Claude, and Claude writes the final reply.
7. The reply goes back to Twilio as TwiML (*say this, then listen again*). Steps 4–7 repeat.
8. When Claude calls `end_call` or `transfer_to_human`, the server hangs up or forwards the
   call. The transcript, bookings and leads are saved and appear in the dashboard.

The browser **test call** in the dashboard uses the same brain. Instead of Twilio, it uses
your browser's built-in speech recognition and speech synthesis.

### Why tools matter

An LLM on its own can only talk. Tools let it act, and your code stays in control. For
example, Claude *asks* to book 6:30pm, but `book_appointment` in `tools.js` checks that the
slot is really free and inside opening hours before saving. **Never trust the AI to enforce
business rules; enforce them in code.**

### Why the prompt matters

`buildSystemPrompt()` in `agent.js` is the receptionist's job briefing. It says to keep
replies short, not to use lists (they sound strange when read aloud), to answer only from
the business information, to read details back before booking, and to admit it is an AI if
asked. Most quality improvements come from improving this prompt and the business
information each customer writes.

## 3. How the smart features work

Each feature is a small, readable file in `server/`. Here is the idea behind each one.

**Caller memory (`customers.js`).** Every phone number that calls becomes a customer record.
When they call again, `startCall` finds them, the greeting becomes "Welcome back, Ravi!",
and a short `<caller_profile>` (name, past bookings, notes) is added to the system prompt.

**The teaching loop (`tools.js` → `note_unanswered_question`).** The prompt tells Claude to
use this tool whenever the answer isn't in the business information. Questions collect on the
**Teach it** page, counted by how often they're asked. The owner's answer is saved to the
receptionist's FAQs, which go into every future system prompt.

**Structured outputs (`llm.js` → `structured()`).** For the post-call analysis, the setup
assistant and the Test Lab grades, we give Claude a JSON schema and it must reply with JSON
that fits it exactly. That's how we get reliable fields like `lead_score: "hot"` instead of
free text we'd have to guess at.

**Post-call analysis (`analysis.js`).** When a call ends, the transcript goes to Claude with
that schema: summary, intent, sentiment, lead score, follow-up. Hot leads and unhappy callers
trigger `notifyOwner`.

**The Test Lab (`simulator.js`).** One Claude plays a customer (with a persona brief), and the
real receptionist brain answers. Then a third Claude call grades the transcript against the
business information. Anything the test booked is deleted afterwards. Questions it uncovered
are kept, because they are real gaps.

**The scheduler (`scheduler.js`).** Every 20 seconds it sends reminders for bookings in the next
24 hours, sends the owner's evening brief, closes calls left open, and places the next
campaign calls. In production you'd move this to a job queue (see section 8).

**Messaging (`messaging.js`).** Every WhatsApp or SMS is first saved in an outbox (the
**Messages** page), then sent through Twilio. Without credentials, messages are kept as
"not configured", so nothing is lost silently. **WhatsApp rule:** businesses can only send
free-form messages within 24 hours of the customer's last message. Reminders and briefs outside
that window need **pre-approved templates**, which you register in Twilio/Meta before launch.

**Campaigns (`campaigns.js`).** Outbound calls follow rules written in code: consent must be
confirmed, calls are only placed inside the window (never before 9am or after 9pm), anyone on
the do-not-call list is skipped, and every call opens with "this is an AI assistant calling
from [business]". Set `TWILIO_CALLER_ID` and `PUBLIC_URL` to enable dialling.

**Plans (`plans.js`).** Minutes are counted from real phone and widget conversations each
month. When a business runs out, callers are never dropped: they are transferred to the
owner, and the owner gets an alert to upgrade. People listed in `ADMIN_EMAILS` see the
**Admin** console, where they can see every business and change its plan.

## 4. Turning on the real AI

1. Create an account at <https://console.anthropic.com>, add billing, create an API key.
2. In `voice-ai/`, run `cp .env.example .env` and paste the key after `ANTHROPIC_API_KEY=`.
3. Run `npm run dev`, open the dashboard and make a test call.

`AGENT_EFFORT=low` keeps replies fast. On a phone call, every second of silence feels long.
You can try `AGENT_MODEL` with a faster model (for example `claude-sonnet-5-5`) and compare
quality against speed in test calls.

## 5. Connecting a real phone number

Twilio needs to reach your server over the internet with HTTPS.

**To test from your laptop:** install [ngrok](https://ngrok.com), run `ngrok http 3000`,
and use the `https://….ngrok-free.app` address it prints as your public URL.

Then follow **Phone setup** in the dashboard:

1. Buy a Voice-enabled number in Twilio.
2. Set its "A call comes in" webhook to `https://YOUR-URL/twilio/voice` (HTTP POST).
3. Set "Call status changes" to `https://YOUR-URL/twilio/status`.
4. Put the number in your receptionist's **Phone** tab.
5. In `.env`, set `TWILIO_AUTH_TOKEN` (from the Twilio console) and `PUBLIC_URL` (your
   HTTPS address). The server then rejects any request that isn't really from Twilio.

**India note:** Indian phone numbers from Twilio need business documents (KYC), and the
rules change. Many Indian voice AI startups use local providers such as **Exotel**,
**Plivo**, **Knowlarity** or **Ozonetel**. They work in the same way: the provider calls
your webhook and you reply with instructions. To support one, add a new file next to
`routes/twilio.js` that speaks that provider's format; the brain (`agent.js`) stays the same.
Check each provider's current Indian number availability and pricing before you choose.

## 6. What it costs you per call (work this out before setting prices)

Each minute of a call costs you:

```
cost per minute = phone provider's per-minute rate (number + inbound minutes)
                + speech recognition per minute (included in Twilio's <Gather> price)
                + text-to-speech per character
                + AI tokens (roughly: system prompt + conversation, every turn)
```

Make 20–30 realistic test calls, then check your real bills on the Twilio and Anthropic
consoles and divide by the minutes. Price your plans at **at least 3× your cost per
minute** so you can pay for support, servers and calls that don't convert. The prices on the
website (`public/index.html`, Pricing section) are placeholders: change them once you
know your costs.

**Ways to reduce AI cost:** keep business info concise, use lower effort, and try a smaller
model on simple receptionists.

## 7. Version 2: making it feel instant

This first version uses Twilio's `<Gather>`: wait for the caller to finish, recognise the
whole sentence, think, then speak. It is simple and reliable, but each turn has roughly
2–4 seconds of silence, and callers can't interrupt the agent.

Leading platforms use **streaming**:

- **Twilio Media Streams** (or the Exotel/Plivo equivalent) send raw audio over a WebSocket
  as the caller speaks.
- **Streaming STT** (for example Deepgram, AssemblyAI, Sarvam AI for Indian languages)
  returns words as they are spoken and detects when the caller stops.
- **Streaming LLM**: Claude's streaming API lets you start speaking the first sentence
  before the full reply is written.
- **Streaming TTS** (for example ElevenLabs, Cartesia, Sarvam AI) begins audio within
  milliseconds and sounds far more human than standard voices.
- **Barge-in:** when the caller starts talking, stop the agent's audio immediately.

Done well, this brings the gap down to under a second. Build this **after** you have
paying customers who like version 1. Only the phone layer and `agent.js` change; the
dashboard, tools and database stay the same.

## 8. Going to production: checklist

**Technical**
- [ ] Host the server (for example Render, Railway, Fly.io, or AWS/GCP in the Mumbai region),
      with HTTPS and a domain name.
- [ ] Replace the JSON file database (`server/db.js`) with PostgreSQL before you have more
      than a few customers. The JSON file is fine for pilots, but it lives on one machine
      and is rewritten on every change.
- [ ] Back up the database daily.
- [ ] Set `TWILIO_AUTH_TOKEN` and `PUBLIC_URL` so phone webhooks are verified.
- [ ] Add error monitoring (for example Sentry) and uptime checks on `/healthz`.
- [ ] Add password reset and team members (plan limits and usage metering are built in).
- [ ] Add billing: Razorpay or Stripe subscriptions that set the business's plan (today the
      Admin console changes plans by hand).
- [ ] Register **WhatsApp message templates** for reminders, confirmations and the daily brief
      (needed outside the 24-hour window), or use an Indian WhatsApp provider such as Gupshup.
- [ ] Move the scheduler (`scheduler.js`) to a job queue if you run more than one server, so
      reminders aren't sent twice.
- [ ] Set `TRUST_PROXY=1` behind a load balancer, and `ADMIN_EMAILS` for your team.

**Legal and trust (India)**
- [ ] Privacy policy and terms of service. India's **Digital Personal Data Protection Act,
      2023** applies to the caller data you store. Get a lawyer to review them once you have
      revenue.
- [ ] Tell callers that the call is answered by an AI assistant and may be recorded or
      transcribed. A line in the greeting is enough.
- [ ] **Campaigns** place outgoing calls. In India these fall under TRAI telemarketing rules
      (DLT registration, consent, DND lists). The code enforces consent, calling hours,
      do-not-call and AI disclosure, but **get legal advice and register before your
      customers run campaigns**.
- [ ] Data requests: **Customers → Erase all data** handles deletion requests; CSV export
      handles access requests.
- [ ] Medical and legal businesses: keep the "never give advice" instructions (the clinic
      template already has them).

## 9. Launching to local businesses

1. **Pick one niche first** (for example clinics in your city). The templates, demo and
   sales pitch all get sharper when you focus.
2. **Find 5 pilot customers.** Offer one free month in return for honest feedback. Set up
   their receptionist yourself, sitting with them.
3. **Read every transcript** in the first weeks. Each mistake shows what to fix in the
   prompt, the template or the business info.
4. **Measure what owners care about:** calls answered after hours, bookings made, leads
   captured. The Overview page shows these, and they are your case studies.
5. **Then charge.** Turn the pilots into paying customers, ask them for referrals, and
   expand to the next niche.

## 10. Ideas for the roadmap

Already built: website widget, caller memory, teaching loop, Test Lab, analysis and lead
scores, ROI dashboard, WhatsApp follow-ups, reminders, daily brief, live takeover, campaigns,
plans and admin. Next:

- Streaming voice (section 7) and higher-quality Indian-language voices
- An Exotel or Plivo adapter for local Indian numbers
- WhatsApp as a full two-way channel using the same brain
- Calendar sync (Google Calendar, clinic and salon software)
- Knowledge upload (PDF menus, price lists)
- Team members, roles and multi-branch businesses
- Self-serve billing (Razorpay)

## 11. Glossary

- **API**: a way for programs to talk to each other over the internet.
- **Webhook**: a URL on your server that another service (such as Twilio) calls when
  something happens.
- **TwiML**: Twilio's XML instructions (`<Say>`, `<Gather>`, `<Dial>`, `<Hangup>`).
- **LLM**: large language model; the AI that understands and writes text (Claude here).
- **System prompt**: the instructions given to the LLM before the conversation starts.
- **Tool / function calling**: the LLM asking your code to perform an action.
- **Latency**: the delay between the caller finishing speaking and the agent answering.
- **Environment variables (`.env`)**: secret settings, such as API keys, kept out of the code.
