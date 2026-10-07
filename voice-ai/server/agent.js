// The agent's "brain": takes what the caller just said, asks Claude what to
// reply (letting it use tools like booking), and returns text to speak.
import Anthropic from "@anthropic-ai/sdk";
import { languageInfo } from "./catalog.js";
import { runTool, todayIn, toolDefinitions } from "./tools.js";

const MODEL = process.env.AGENT_MODEL || "claude-opus-5-5";
// Phone conversations need fast replies, so the default effort is "low".
const EFFORT = process.env.AGENT_EFFORT || "low";
const MAX_TOOL_ROUNDS = 5;

let client = null;
export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.AI_MODE !== "mock";
}
function getClient() {
  client ??= new Anthropic();
  return client;
}

export function buildSystemPrompt(agent, call) {
  const lang = languageInfo(agent.language);
  const hours = agent.hours;
  const days = hours.days.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ");
  return [
    `You are ${agent.name}, the phone assistant for this business. You are talking to a caller on a live phone call.`,
    `Today is ${todayIn(agent.timeZone)} (${agent.timeZone}).`,
    `Speak ${lang.name}. If the caller switches language, follow them.`,
    "",
    "How to talk:",
    "- Everything you write is read aloud by a text-to-speech voice. Use plain spoken sentences: no lists, markdown, emojis or URLs.",
    "- Keep each reply to one to three short sentences, then let the caller speak.",
    "- Say numbers, prices and times the way a person would say them.",
    "- Only state facts from the business information below. If you don't know, say so and offer to take a message.",
    "- If asked whether you are a person, say honestly that you are the business's AI assistant, and offer to take a message or transfer if you can.",
    "- Before booking, read back the date, time, name and phone number and get a yes.",
    "- When the caller is done, say a short goodbye and use end_call.",
    "",
    `Opening hours: ${days}, ${hours.open} to ${hours.close}.`,
    agent.services?.length ? `Services: ${agent.services.join(", ")}.` : "",
    `You already greeted the caller with: "${agent.greeting}"`,
    call.callerNumber ? `The caller is phoning from ${call.callerNumber}; confirm it instead of asking for a number.` : "",
    "",
    "<business_information>",
    agent.businessInfo || "(none provided)",
    "</business_information>",
    "",
    "<owner_instructions>",
    agent.instructions || "(none)",
    "</owner_instructions>",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

// Text-to-speech engines read symbols literally, so strip formatting.
export function speakable(text) {
  return text
    .replace(/[*_#`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Handle one caller utterance. Mutates `call` (history + transcript) and
 * returns { reply, action } where action is null | {type:"hangup"|"transfer"}.
 */
export async function respond(db, agent, call, userText) {
  call.transcript.push({ role: "caller", text: userText, at: new Date().toISOString() });
  const outcome = aiEnabled() ? await claudeTurn(db, agent, call, userText) : mockTurn(db, agent, call, userText);
  const reply = speakable(outcome.reply) || "Sorry, could you say that again?";
  call.transcript.push({ role: "agent", text: reply, at: new Date().toISOString() });
  if (outcome.action?.summary) call.summary = outcome.action.summary;
  db.update("calls", call.id, { transcript: call.transcript, messages: call.messages, summary: call.summary });
  return { reply, action: outcome.action ?? null };
}

async function claudeTurn(db, agent, call, userText) {
  // The history is append-only: we always keep Claude's full response content
  // (including thinking blocks) exactly as returned.
  const turnStart = call.messages.length;
  call.messages.push({ role: "user", content: userText });
  const system = buildSystemPrompt(agent, call);
  const tools = toolDefinitions(agent);
  const spoken = [];
  let action = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response;
    try {
      response = await getClient().beta.messages.create({
        model: MODEL,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default", // if the model declines, the API retries on a fallback model
        output_config: { effort: EFFORT },
        system,
        tools,
        messages: call.messages,
      });
    } catch (error) {
      console.error("Claude request failed:", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
      call.messages.length = turnStart; // drop this turn so the history stays valid for a retry
      return { reply: "Sorry, I'm having trouble right now. Could you please repeat that?" };
    }

    if (response.stop_reason === "refusal") {
      call.messages.length = turnStart;
      return { reply: "Sorry, I can't help with that. Is there anything else I can do for you?" };
    }

    call.messages.push({ role: "assistant", content: response.content });
    for (const block of response.content) {
      if (block.type === "text") spoken.push(block.text);
    }
    if (response.stop_reason !== "tool_use") break;

    const results = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const out = runTool(db, agent, call, block.name, block.input);
      if (out.action) action = out.action;
      results.push({ type: "tool_result", tool_use_id: block.id, content: out.result });
    }
    call.messages.push({ role: "user", content: results });
    if (action) break; // hanging up or transferring: nothing more to say
  }
  return { reply: spoken.join(" "), action };
}

// Demo brain used when no ANTHROPIC_API_KEY is set, so the whole product can
// be clicked through for free. It is deliberately simple.
function mockTurn(db, agent, call, userText) {
  const text = userText.toLowerCase();
  if (/\b(bye|thank you|thanks|that's all)\b/.test(text)) {
    return { reply: "You're welcome. Have a great day, goodbye!", action: { type: "hangup", summary: "Demo call" } };
  }
  if (/\b(book|appointment|slot|reserve)\b/.test(text) && agent.bookingEnabled) {
    return {
      reply:
        "I'd be happy to help you book. This is demo mode, so I can't check the calendar yet. Add an Anthropic API key to turn on the real assistant.",
    };
  }
  return {
    reply: `Demo mode: you said "${userText}". Add an Anthropic API key on the server to get real AI answers about ${agent.name}.`,
  };
}
