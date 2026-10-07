// After every call: AI writes a summary, the caller's intent, sentiment and a
// lead score. Hot leads and unhappy callers alert the owner.
import { aiEnabled, objectSchema, structured } from "./llm.js";
import { notifyOwner } from "./messaging.js";

const INTENTS = ["booking", "enquiry", "reschedule_or_cancel", "complaint", "sales_lead", "emergency", "wrong_number", "other"];

const SCHEMA = objectSchema({
  summary: { type: "string", description: "One or two sentences: who called, what they wanted, what happened" },
  intent: { type: "string", enum: INTENTS },
  sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
  lead_score: { type: "string", enum: ["hot", "warm", "cold", "none"], description: "How likely this caller is to buy soon" },
  language: { type: "string", description: "Language(s) the caller used, e.g. 'Hindi + English'" },
  follow_up_needed: { type: "boolean" },
  follow_up_note: { type: "string", description: "What the owner should do next, or empty" },
});

export async function analyzeCall(db, call) {
  if (call.transcript.length < 2) return null;
  const outcomes = {
    booked: db.find("appointments", (a) => a.callId === call.id).length,
    leads: db.find("leads", (l) => l.callId === call.id).length,
  };
  let analysis;
  if (aiEnabled()) {
    try {
      const transcript = call.transcript.map((t) => `${t.role === "agent" ? "Receptionist" : "Caller"}: ${t.text}`).join("\n");
      const a = await structured({
        system: "You review phone calls handled by an AI receptionist for a small business and produce a short, factual report for the owner.",
        prompt: `Bookings made on this call: ${outcomes.booked}. Leads saved: ${outcomes.leads}.\n\n<transcript>\n${transcript}\n</transcript>`,
        schema: SCHEMA,
        effort: "low",
      });
      analysis = {
        summary: a.summary, intent: a.intent, sentiment: a.sentiment, leadScore: a.lead_score,
        language: a.language, followUpNeeded: a.follow_up_needed, followUpNote: a.follow_up_note,
      };
    } catch (err) {
      console.error("Call analysis failed:", err.message);
      return null;
    }
  } else {
    analysis = heuristicAnalysis(call, outcomes);
  }

  const fresh = db.get("calls", call.id);
  if (!fresh) return null; // erased meanwhile
  db.update("calls", call.id, { analysis, summary: fresh.summary || analysis.summary });
  db.find("leads", (l) => l.callId === call.id).forEach((l) => db.update("leads", l.id, { score: analysis.leadScore }));

  const who = call.callerNumber || "a website visitor";
  if (analysis.leadScore === "hot" && !outcomes.booked) {
    notifyOwner(db, call.orgId, { kind: "hot_lead", title: "Hot lead: call them back", body: `${analysis.summary}\nFrom ${who}`, callId: call.id, urgent: true });
  } else if (analysis.sentiment === "negative") {
    notifyOwner(db, call.orgId, { kind: "unhappy_caller", title: "Unhappy caller", body: `${analysis.summary}\nFrom ${who}`, callId: call.id });
  }
  return analysis;
}

// Rough rules for demo mode (no API key).
function heuristicAnalysis(call, outcomes) {
  const said = call.transcript.filter((t) => t.role === "caller").map((t) => t.text.toLowerCase()).join(" ");
  const negative = /\b(angry|worst|bad|complaint|terrible|rude|never again)\b/.test(said);
  const intent = outcomes.booked ? "booking"
    : /\b(emergency|urgent)\b/.test(said) ? "emergency"
    : negative ? "complaint"
    : /\b(cancel|reschedule|change)\b/.test(said) ? "reschedule_or_cancel"
    : /\b(price|cost|buy|interested|rate)\b/.test(said) ? "sales_lead"
    : "enquiry";
  return {
    summary: call.summary || `Caller made a ${intent.replace(/_/g, " ")} over ${call.transcript.length} messages.`,
    intent,
    sentiment: negative ? "negative" : outcomes.booked ? "positive" : "neutral",
    leadScore: outcomes.booked ? "hot" : outcomes.leads ? "warm" : intent === "sales_lead" ? "warm" : "none",
    language: "Unknown (demo mode)",
    followUpNeeded: Boolean(outcomes.leads) || negative,
    followUpNote: negative ? "Call the customer back and apologise." : outcomes.leads ? "Call back about their enquiry." : "",
  };
}
