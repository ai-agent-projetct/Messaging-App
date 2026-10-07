// One place for everything that talks to Claude.
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.AGENT_MODEL || "claude-opus-5-5";
// Live calls need fast replies, so conversation effort defaults to "low".
export const EFFORT = process.env.AGENT_EFFORT || "low";

let client = null;

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.AI_MODE !== "mock";
}

export function getClient() {
  client ??= new Anthropic();
  return client;
}

export { Anthropic };

// A Messages API request with refusal fallbacks on: if the model declines,
// the API retries the same request on a fallback model inside the same call.
export function createMessage(params) {
  return getClient().beta.messages.create({
    model: MODEL,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    ...params,
  });
}

/**
 * Ask Claude for JSON that matches `schema` (structured outputs).
 * Optional `tools` (e.g. web_fetch) run server-side first; pause_turn is resumed.
 */
export async function structured({ system, prompt, schema, effort = "medium", tools, maxTokens = 8000 }) {
  const messages = [{ role: "user", content: prompt }];
  for (let i = 0; i < 6; i++) {
    const response = await createMessage({
      max_tokens: maxTokens,
      system,
      messages,
      ...(tools && { tools }),
      output_config: { effort, format: { type: "json_schema", schema } },
    });
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    if (response.stop_reason === "refusal") throw new Error("The AI declined this request.");
    if (response.stop_reason === "max_tokens") throw new Error("The AI response was too long.");
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return JSON.parse(text);
  }
  throw new Error("The AI took too many steps.");
}

/** Plain text completion (used for simulated callers in the Test Lab). */
export async function complete({ system, messages, effort = "low", maxTokens = 2000 }) {
  const response = await createMessage({ max_tokens: maxTokens, system, messages, output_config: { effort } });
  if (response.stop_reason === "refusal") return "";
  return response.content.filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
}

// JSON-schema helper: every property required, no extras (structured outputs rule).
export function objectSchema(properties) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}
