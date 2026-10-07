// Phone calls through Twilio. How a call flows:
//   1. Someone dials the business's Twilio number.
//   2. Twilio POSTs to /twilio/voice. We reply with TwiML (XML instructions):
//      "say the greeting, then listen" (<Gather input="speech">).
//   3. Twilio turns the caller's speech into text and POSTs it to /twilio/gather.
//   4. We ask the agent's brain for a reply and answer with more TwiML. Repeat.
import crypto from "node:crypto";
import express from "express";
import { languageInfo } from "../catalog.js";
import { respond } from "../agent.js";
import { endCall, normalizePhone, startCall } from "./api.js";

const MAX_SILENCES = 2;

export function twilioRouter(db) {
  const r = express.Router();
  r.use(express.urlencoded({ extended: false }));
  r.use(verifyTwilioSignature);

  r.post("/voice", (req, res) => {
    const to = normalizePhone(req.body.To || "");
    const agent = db.find("agents", (a) => a.phoneNumber && a.phoneNumber === to && a.active)[0];
    if (!agent) {
      return twiml(res, `<Say>Sorry, this number is not set up yet. Goodbye.</Say><Hangup/>`);
    }
    const call = startCall(db, agent, {
      channel: "phone",
      callerNumber: req.body.From || "",
      twilioSid: req.body.CallSid || "",
      silences: 0,
    });
    twiml(res, gather(agent, call, agent.greeting));
  });

  r.post("/gather/:callId", async (req, res) => {
    const call = db.get("calls", req.params.callId);
    const agent = call && db.get("agents", call.agentId);
    if (!call || !agent || call.status === "ended") return twiml(res, "<Hangup/>");

    const heard = String(req.body.SpeechResult || "").trim();
    if (!heard) {
      const silences = (call.silences || 0) + 1;
      db.update("calls", call.id, { silences });
      if (silences > MAX_SILENCES) {
        endCall(db, call, "no-response");
        return twiml(res, `${say(agent, "I can't hear anything, so I'll hang up now. Please call again. Goodbye.")}<Hangup/>`);
      }
      return twiml(res, gather(agent, call, "Sorry, I didn't catch that. Could you say it again?"));
    }

    db.update("calls", call.id, { silences: 0 });
    const { reply, action } = await respond(db, agent, call, heard);
    if (action?.type === "hangup") {
      endCall(db, call, "completed");
      return twiml(res, `${say(agent, reply)}<Hangup/>`);
    }
    if (action?.type === "transfer" && agent.transferNumber) {
      endCall(db, call, "transferred");
      return twiml(res, `${say(agent, reply)}<Dial>${escapeXml(agent.transferNumber)}</Dial>`);
    }
    twiml(res, gather(agent, call, reply));
  });

  // Set this as the number's "Call status changes" webhook in Twilio to get
  // accurate call durations (and to close calls when the caller hangs up).
  r.post("/status", (req, res) => {
    const call = db.find("calls", (c) => c.twilioSid && c.twilioSid === req.body.CallSid)[0];
    if (call && ["completed", "busy", "failed", "no-answer", "canceled"].includes(req.body.CallStatus)) {
      const duration = Number(req.body.CallDuration) || undefined;
      if (call.status === "ended") db.update("calls", call.id, { durationSec: duration ?? call.durationSec });
      else endCall(db, call, req.body.CallStatus === "completed" ? "caller-hung-up" : req.body.CallStatus, duration);
    }
    res.sendStatus(204);
  });

  return r;
}

function say(agent, text) {
  const lang = languageInfo(agent.language);
  return `<Say voice="${escapeXml(agent.voice || lang.voice)}" language="${lang.code}">${escapeXml(text)}</Say>`;
}

function gather(agent, call, text) {
  const lang = languageInfo(agent.language);
  return (
    `<Gather input="speech" action="/twilio/gather/${call.id}" method="POST" ` +
    `language="${lang.code}" speechTimeout="auto" actionOnEmptyResult="true">` +
    `${say(agent, text)}</Gather>`
  );
}

function twiml(res, body) {
  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`);
}

export function escapeXml(text) {
  return String(text).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);
}

// Proves a request really came from Twilio, so nobody can fake calls.
// Twilio signs: full URL + each POST param (sorted by name, key then value),
// HMAC-SHA1 with your auth token, base64-encoded.
export function twilioSignature(authToken, url, params) {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return crypto.createHmac("sha1", authToken).update(data).digest("base64");
}

function verifyTwilioSignature(req, res, next) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return next(); // local development without Twilio
  const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  const expected = twilioSignature(token, base + req.originalUrl, req.body || {});
  const given = req.get("x-twilio-signature") || "";
  const ok = given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return res.status(403).send("Invalid Twilio signature");
  next();
}
