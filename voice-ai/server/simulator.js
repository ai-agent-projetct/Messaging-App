// Readiness Test Lab: AI role-plays difficult callers against a receptionist,
// then an AI examiner grades each conversation and suggests fixes. Owners see
// a Readiness Score before a single real customer calls.
import { respond } from "./agent.js";
import { endCall, startCall } from "./calls.js";
import { aiEnabled, complete, objectSchema, structured } from "./llm.js";

export const PERSONAS = [
  {
    id: "booker",
    label: "Hinglish booking",
    brief: "You speak Hinglish (Hindi mixed with English). You want to book the business's most popular service for tomorrow evening. Your name is Rohit, number 98765 00011. Accept a reasonable time.",
    demo: ["Hello, kal shaam ko appointment mil sakta hai kya?", "Rohit, number 98765 00011", "Theek hai, thank you bye"],
  },
  {
    id: "price",
    label: "Price shopper",
    brief: "You compare prices. Ask the cost of two or three services and whether there is any discount or package. You are polite but hard to convince.",
    demo: ["What are your prices?", "Any discount for first time customers?", "Okay thanks, bye"],
  },
  {
    id: "offscript",
    label: "Off-script questions",
    brief: "Ask practical questions that may not be in the business information: parking, card or UPI payment, Sunday timings, home service. See if the receptionist admits what it doesn't know instead of guessing.",
    demo: ["Do you have parking?", "Can I pay by UPI?", "Are you open on Sunday?", "Thanks, bye"],
  },
  {
    id: "angry",
    label: "Upset customer",
    brief: "You are upset: last time you waited 40 minutes past your appointment time. You want to complain and ask for the manager. Calm down only if treated with respect.",
    demo: ["I'm very angry, I waited 40 minutes last time!", "I want to speak to the manager", "Fine. Bye"],
  },
  {
    id: "urgent",
    label: "Urgent situation",
    brief: "You have an urgent problem that can't wait (for a clinic: your father has sudden chest pain; otherwise an urgent issue with an order or booking today). See if the receptionist escalates properly.",
    demo: ["This is urgent, I need help right now", "Please hurry", "Okay bye"],
  },
  {
    id: "reschedule",
    label: "Reschedule a booking",
    brief: "You are elderly and a little confused. You want to move your booking (you think it's on Friday) to another day. You may need things repeated.",
    demo: ["I want to change my appointment please", "It is on Friday I think", "Thank you, bye"],
  },
];

const GRADE = objectSchema({
  score: { type: "integer", description: "0-100. 90+ excellent, 75+ ready, 50-74 needs work, below 50 not ready" },
  went_well: { type: "array", items: { type: "string" } },
  problems: { type: "array", items: { type: "string" }, description: "Concrete mistakes, quoting the receptionist where useful" },
  fixes: { type: "array", items: { type: "string" }, description: "Exact text the owner should add to the business information or instructions" },
});

const MAX_CALLER_TURNS = 6;

/** Starts a Test Lab run in the background and returns its record immediately. */
export function startSimulation(db, agent, personaIds) {
  const personas = PERSONAS.filter((p) => personaIds.includes(p.id));
  const run = db.insert("simulations", {
    orgId: agent.orgId,
    agentId: agent.id,
    status: "running",
    demo: !aiEnabled(),
    personas: personas.map((p) => p.id),
    results: [],
    score: null,
  });
  runAll(db, agent, run, personas).catch((err) => {
    console.error("Test Lab failed", err);
    db.update("simulations", run.id, { status: "failed", error: String(err.message || err) });
  });
  return run;
}

async function runAll(db, agent, run, personas) {
  const results = await Promise.all(personas.map((p) => runPersona(db, agent, p)));
  const score = Math.round(results.reduce((s, r) => s + r.grade.score, 0) / results.length);
  db.update("simulations", run.id, { status: "done", results, score, finishedAt: new Date().toISOString() });
}

async function runPersona(db, agent, persona) {
  const call = startCall(db, agent, { channel: "simulation" });
  const callerSystem = [
    "You are role-playing a customer phoning a small business, to test its AI receptionist.",
    persona.brief,
    "Reply with only the words you would say out loud, one or two short sentences. Stay in character.",
    "When your goal is done or the call is over, say goodbye and then write [END].",
  ].join("\n");

  try {
    for (let turn = 0; turn < MAX_CALLER_TURNS; turn++) {
      let line;
      if (aiEnabled()) {
        // From the caller's point of view, receptionist lines are "user" turns.
        const history = call.transcript.map((t) => ({ role: t.role === "agent" ? "user" : "assistant", content: t.text }));
        line = await complete({ system: callerSystem, messages: history });
      } else {
        line = persona.demo[turn];
      }
      if (!line) break;
      const done = line.includes("[END]");
      line = line.replace("[END]", "").trim();
      if (line) {
        const { action } = await respond(db, agent, call, line);
        if (action) break;
      }
      if (done) break;
    }
  } finally {
    endCall(db, call, "simulated");
  }

  const finished = db.get("calls", call.id);
  const actions = describeActions(db, call.id);
  const grade = aiEnabled() ? await gradeCall(agent, persona, finished, actions) : demoGrade(finished, actions);
  cleanUp(db, call.id);
  return { persona: persona.id, label: persona.label, transcript: finished.transcript, actions, grade };
}

function describeActions(db, callId) {
  const list = [];
  db.find("appointments", (a) => a.callId === callId).forEach((a) => list.push(`Booked ${a.service} ${a.date} ${a.time}`));
  db.find("leads", (l) => l.callId === callId).forEach((l) => list.push(`Saved lead: ${l.interest}`));
  db.find("questions", (q) => q.callId === callId).forEach((q) => list.push(`Logged unanswered question: ${q.question}`));
  db.find("alerts", (a) => a.callId === callId).forEach((a) => list.push(`Alerted owner: ${a.title}`));
  db.find("messages", (m) => m.callId === callId).forEach((m) => list.push(`Sent ${m.channel} message`));
  return list;
}

async function gradeCall(agent, persona, call, actions) {
  const transcript = call.transcript.map((t) => `${t.role === "agent" ? "Receptionist" : "Caller"}: ${t.text}`).join("\n");
  return structured({
    system:
      "You are a strict examiner of AI phone receptionists for small businesses. Judge: factual accuracy against the business information (inventing facts is a serious failure), helpfulness, warmth, brevity suitable for voice, correct use of actions (booking, escalation, logging unknown questions), and honesty.",
    prompt: [
      `Test scenario: ${persona.label}. Caller brief: ${persona.brief}`,
      `<business_information>\n${agent.businessInfo}\n</business_information>`,
      `<owner_instructions>\n${agent.instructions}\n</owner_instructions>`,
      `<transcript>\n${transcript}\n</transcript>`,
      `Actions the receptionist took: ${actions.length ? actions.join("; ") : "none"}`,
    ].join("\n\n"),
    schema: GRADE,
    effort: "medium",
  });
}

function demoGrade(call, actions) {
  return {
    score: 50,
    went_well: ["The conversation flow and logging work end to end."],
    problems: ["Demo mode: replies are placeholders, so this score is only illustrative."],
    fixes: ["Add an Anthropic API key on the server, then run the Test Lab again for a real Readiness Score."],
  };
}

// Test calls must not leave fake bookings, leads or alerts behind. Questions
// it uncovered are kept: they are real gaps in the knowledge base.
function cleanUp(db, callId) {
  for (const table of ["appointments", "leads", "alerts", "messages"]) {
    db.find(table, (r) => r.callId === callId).forEach((r) => db.remove(table, r.id));
  }
  db.find("questions", (q) => q.callId === callId).forEach((q) => db.update("questions", q.id, { source: "test_lab" }));
  db.remove("calls", callId);
}
