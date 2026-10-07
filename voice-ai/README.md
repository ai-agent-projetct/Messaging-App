# VoiceDesk: AI phone receptionist for local businesses

VoiceDesk answers a business's phone calls with an AI voice agent. The agent answers
questions, books appointments, saves leads and transfers callers to staff. It speaks
English and 9 Indian languages.

It has three parts:

| Part | Where | What it is |
|---|---|---|
| **Website** | `public/index.html` | The marketing page that sells the product (`/`) |
| **Dashboard** | `public/app.html`, `public/js/app.js` | Where a business signs up, sets up its receptionist, tests it and sees calls, bookings and leads (`/app`) |
| **Server** | `server/` | The API, the AI "brain" and the phone-call webhooks |

**New to this?** Read [docs/LEARN.md](docs/LEARN.md). It explains how voice AI works,
what each file does, and how to take this from your laptop to paying customers.

## Run it on your computer

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
cd voice-ai
npm install
npm start
```

Open <http://localhost:3000> for the website and <http://localhost:3000/app> for the dashboard.
Create an account, choose a template and press **Start test call** to talk to the receptionist
from your browser.

Without an API key it runs in **demo mode**: everything works, but the receptionist gives
placeholder answers. To turn on the real AI:

```bash
cp .env.example .env      # then put your Anthropic API key in .env
npm run dev               # loads .env and restarts when you edit code
```

## Tests

```bash
npm test
```

The tests cover sign-up and login, keeping each business's data separate, browser test
calls, the phone-call flow, Twilio signature checks and booking rules (no double-booking,
no closed days).

## Project layout

```
server/
  index.js         starts the web server
  agent.js         the AI brain: prompt + Claude + tool loop
  tools.js         what the agent can do: check slots, book, save lead, transfer, hang up
  catalog.js       languages, voices, business templates
  routes/api.js    dashboard API (accounts, receptionists, calls, bookings, leads)
  routes/twilio.js phone calls (Twilio webhooks)
  auth.js          passwords and login sessions
  db.js            simple JSON-file database
public/            website + dashboard (plain HTML/CSS/JS, no build step)
test/              automated tests
docs/LEARN.md      the beginner's guide
```
