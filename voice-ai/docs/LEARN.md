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

## 3. Turning on the real AI

1. Create an account at <https://console.anthropic.com>, add billing, create an API key.
2. In `voice-ai/`, run `cp .env.example .env` and paste the key after `ANTHROPIC_API_KEY=`.
3. Run `npm run dev`, open the dashboard and make a test call.

`AGENT_EFFORT=low` keeps replies fast. On a phone call, every second of silence feels long.
You can try `AGENT_MODEL` with a faster model (for example `claude-sonnet-5-5`) and compare
quality against speed in test calls.

## 4. Connecting a real phone number

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

## 5. What it costs you per call (work this out before setting prices)

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

## 6. Version 2: making it feel instant

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

## 7. Going to production: checklist

**Technical**
- [ ] Host the server (for example Render, Railway, Fly.io, or AWS/GCP in the Mumbai region),
      with HTTPS and a domain name.
- [ ] Replace the JSON file database (`server/db.js`) with PostgreSQL before you have more
      than a few customers. The JSON file is fine for pilots, but it lives on one machine
      and is rewritten on every change.
- [ ] Back up the database daily.
- [ ] Set `TWILIO_AUTH_TOKEN` and `PUBLIC_URL` so phone webhooks are verified.
- [ ] Add error monitoring (for example Sentry) and uptime checks on `/healthz`.
- [ ] Add password reset, team members and usage limits per plan.
- [ ] Add billing: Razorpay or Stripe subscriptions, and count minutes from
      `call.durationSec`.
- [ ] SMS or WhatsApp confirmations for bookings (Twilio, Gupshup or the WhatsApp Business API).

**Legal and trust (India)**
- [ ] Privacy policy and terms of service. India's **Digital Personal Data Protection Act,
      2023** applies to the caller data you store. Get a lawyer to review them once you have
      revenue.
- [ ] Tell callers that the call is answered by an AI assistant and may be recorded or
      transcribed. A line in the greeting is enough.
- [ ] This product answers **incoming** calls. **Outgoing** sales calls in India fall under
      TRAI telemarketing rules (DLT registration, consent, DND lists). Read those rules
      before you build outbound calling.
- [ ] Medical and legal businesses: keep the "never give advice" instructions (the clinic
      template already has them).

## 8. Launching to local businesses

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

## 9. Ideas for the roadmap

- Streaming voice (section 6) and higher-quality voices
- A "Talk to us" voice widget businesses can add to their own website
- WhatsApp channel using the same brain
- Calendar sync (Google Calendar) instead of the built-in booking list
- Outbound reminder calls for appointments (after reading the TRAI rules)
- Knowledge upload (PDF menus, price lists)
- Analytics: top questions, missed opportunities, busiest hours
- Multi-branch businesses and team roles

## 10. Glossary

- **API**: a way for programs to talk to each other over the internet.
- **Webhook**: a URL on your server that another service (such as Twilio) calls when
  something happens.
- **TwiML**: Twilio's XML instructions (`<Say>`, `<Gather>`, `<Dial>`, `<Hangup>`).
- **LLM**: large language model; the AI that understands and writes text (Claude here).
- **System prompt**: the instructions given to the LLM before the conversation starts.
- **Tool / function calling**: the LLM asking your code to perform an action.
- **Latency**: the delay between the caller finishing speaking and the agent answering.
- **Environment variables (`.env`)**: secret settings, such as API keys, kept out of the code.
