# iThrive Messaging

An enterprise communication and collaboration platform — messaging, groups, channels, threads,
calls, meetings, files, tasks, calendar, announcements, search, directory, administration,
analytics, security, integrations and an AI layer, in one product.

The workspace is populated with a fictional company, **Northbeam Technologies** (486 employees,
fleet-intelligence software, HQ in Lisbon), so every screen shows realistic content rather than
placeholder text.

---

## Running it

No build step and no dependencies. Either:

**Open it directly** — double-click `index.html`.

**Or serve it** (recommended, avoids browser file-protocol quirks):

```bash
python -m http.server 8177
```

Then open <http://localhost:8177>.

### Signing in

Any email and password combination signs you in as **Aarav Menon**, Senior Product Manager.
OTP and two-factor codes accept any six digits. Every authentication route is reachable from
the welcome screen: email/phone login, SSO, Google/Microsoft, sign-up, email verification,
forgotten password, reset, account recovery, organisation join and invitation acceptance.

Your session, messages and settings persist in `localStorage`.
**Settings → About → Reset demonstration data** restores the original state.

---

## Brand and design system

An original identity, deliberately unlike Slack or Teams.

| Token | Value | Use |
|---|---|---|
| Primary — *Thrive Jade* | `#0b8a6e` | Actions, own messages, selection |
| Structure — *Deep Ink* | `#121c29` | Top bar and navigation rail |
| Accent — *Solar Coral* | `#ff7a45` | Announcements, launch surfaces |
| AI — *Aurora Violet* | `#7c5cff` | Every Thrive AI surface |
| Success / Warning / Error / Info | `#17a34a` / `#eab308` / `#e5484d` / `#2e7cf6` | Status |

Typography is Inter with Plus Jakarta Sans for display. Three densities, four accent colours,
light and dark themes (plus *match system*), and a `prefers-reduced-motion` path.

The icon set in `assets/js/icons.js` is hand-authored 24×24 stroke geometry — no third-party pack.

---

## Structure

```
index.html
assets/
  css/
    tokens.css        design tokens, light + dark, accents, density
    base.css          reset, typography, utilities, boot screen
    components.css    buttons, inputs, cards, modals, menus, toasts, tables, states
    layout.css        top bar, rail, sidebar, main, contextual panel
    views.css         chat, composer, AI, search, calendar, board, admin …
    auth.css          authentication and onboarding
    calls.css         call stage, lobby, screen share, whiteboard
    mobile.css        tablet and phone
  js/
    icons.js  util.js  data.js  store.js  ui.js
    ai.js             the AI engine
    aipanel.js        AI surfaces (summaries, catch-up, ask, hub)
    auth.js           17 authentication screens + onboarding
    composer.js       message composer
    chat.js           conversation view
    threads.js        threaded discussion
    calls.js          calls, meetings, lobby, breakouts, captions
    search.js         global search + command palette
    modals.js         61 modal flows
    app.js            shell, routing, chrome, shortcuts
    views/            home, files, tasks, calendar, meetings, calls,
                      people, notifications, saved, announcements,
                      settings, admin, org
```

`Store` is the single source of truth; views subscribe to its events and persist automatically.

---

## The AI layer

Thrive AI is **computed from the workspace data in the store**, not hard-coded. Change the
conversation and the output changes with it.

- **Conversation and thread summaries** — scores each message on decision/risk/action language,
  reactions, pins, attachments, thread depth and recency, then extracts key points, decisions,
  risks, open questions and metrics.
- **Action item extraction** — detects commitments, infers the owner (from mentions, names and
  first-person phrasing) and a due date (from "tomorrow", "Thursday", "end of week"), then creates
  real assigned tasks.
- **Catch-up** — ranks unread conversations into *needs you now / worth a look / can wait*.
- **Ask Thrive AI** — answers questions from your own messages and cites each source, with a
  confidence level. Clicking a citation jumps to the message.
- **Smart search** — parses `from:`, `in:`, `has:` and natural-language time hints, with stemming.
- **Drafting and rewriting** — replies, follow-ups, status updates, declines; concise, formal,
  friendly, expanded, bulleted or proofread.
- **Translation** — six languages, with the original always one click away.
- **Meetings** — agenda generation from the title, summaries, notes, transcripts with speaker
  labels, and action items.
- **Smart notification priority** — weights sender seniority, whether they are your manager,
  urgency language and age.
- **Smart status suggestions** — drawn from your calendar and urgent tasks.

Translation uses a word-level demonstration dictionary, so it shows the shape of a translation
rather than production machine translation.

---

## Notes on fidelity

Some things are genuinely real rather than mocked:

- **File attachments** read real files you drop or select — real names, sizes and image previews
  via `URL.createObjectURL`.
- **Screen sharing** requests `getDisplayMedia`; if you allow it, your actual screen is shared in
  the call stage. Declining falls back to a simulated presentation.
- **Camera** uses `getUserMedia` when you turn video on, and falls back to an avatar tile if the
  browser blocks it.
- **The whiteboard** is a working canvas you can draw on.

Everything else — presence, delivery receipts, typing indicators, peer replies in direct messages,
call connection — is simulated locally, since there is no backend.

---

## Coverage

- **Auth** — welcome, email/phone login, password, OTP, 2FA (app/SMS/backup codes), SSO,
  Google/Microsoft, sign-up, email verification, forgot, reset with live policy meter, recovery,
  join organisation, invitation, create organisation, five-step onboarding.
- **Messaging** — direct, group and six channel types; threads with resolve and follow; reply,
  forward, edit, delete, pin, save, react, mention, quote, report; rich text, code, polls, tasks,
  voice messages, GIFs, stickers, location, screen capture; slash commands, mention autocomplete,
  scheduled send, drafts.
- **Calls and meetings** — ringing, lobby, gallery/speaker layouts, screen share, raise hand,
  reactions, chat, participants, recording, live captions, transcript, whiteboard, polls,
  breakout rooms, virtual backgrounds, device settings, AI summary, failed-call states.
- **Work** — files with folders/versions/permissions/preview, tasks with a drag-and-drop board,
  calendar in day/week/month/agenda with conflict detection, announcements with read receipts and
  scheduled publishing.
- **Organisation** — directory, departments, teams, org chart, eight roles, admin dashboard,
  analytics, audit log, security, storage policies, integration marketplace, invitations.
- **States** — empty, loading, skeleton, offline, permission denied, upload failure, failed
  message, missed call, no results, not found.

Keyboard: `Ctrl/⌘ K` search, `?` shortcuts, `G` then `H/M/C/T/F/N/K/P/S` to navigate,
`Ctrl/⌘ ⇧ D` dark mode, `Ctrl/⌘ ⇧ A` ask AI, `Ctrl/⌘ ⇧ U` catch up.
In a call: `M` mute, `V` video, `H` raise hand.
