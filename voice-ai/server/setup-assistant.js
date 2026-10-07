// "Set up in 5 minutes": turn a website link, Google listing, menu or rough
// notes (any language) into a ready receptionist: knowledge, services with
// prices, FAQs and a greeting. Returns a proposal; the owner reviews and saves.
import { languageInfo } from "./catalog.js";
import { aiEnabled, objectSchema, structured } from "./llm.js";

const SCHEMA = objectSchema({
  business_info: {
    type: "string",
    description: "Everything a receptionist needs: what the business is, address and landmarks, timings, services, prices, policies, payment options, parking. Plain sentences.",
  },
  greeting: { type: "string", description: "Short, warm phone greeting naming the business, in the receptionist's language" },
  instructions: { type: "string", description: "How the receptionist should behave for this kind of business, including what it must never do" },
  services: {
    type: "array",
    items: objectSchema({ name: { type: "string" }, price: { type: "number", description: "Price in rupees, 0 if unknown or free" } }),
  },
  faqs: {
    type: "array",
    description: "Questions callers commonly ask, answered only from the source material",
    items: objectSchema({ q: { type: "string" }, a: { type: "string" } }),
  },
});

export async function autofill({ agent, org, notes, url }) {
  const cleanUrl = url ? safeUrl(url) : "";
  if (url && !cleanUrl) throw new Error("Please enter a full website address starting with https://");
  if (!notes?.trim() && !cleanUrl) throw new Error("Paste some notes about the business or a website link.");

  if (!aiEnabled()) return demoAutofill(agent, org, notes || "");

  const lang = languageInfo(agent.language).name;
  const prompt = [
    `Business name: ${org.name}. The receptionist speaks ${lang}.`,
    cleanUrl ? `Read this page and use it as the main source: ${cleanUrl}` : "",
    notes?.trim() ? `<owner_notes>\n${notes.trim().slice(0, 20000)}\n</owner_notes>` : "",
    "Build the receptionist's setup. Use only facts from the sources; never invent prices, timings or addresses. Leave out anything unknown.",
  ].filter(Boolean).join("\n\n");
  const system = "You set up AI phone receptionists for small businesses in India. Be accurate, concise and practical.";

  let out;
  try {
    out = await structured({
      system,
      prompt,
      schema: SCHEMA,
      effort: "medium",
      ...(cleanUrl && { tools: [{ type: "web_fetch_20260209", name: "web_fetch", max_uses: 3 }] }),
    });
  } catch (err) {
    if (!cleanUrl || !notes?.trim()) throw new Error(`Couldn't build the setup: ${err.message} Try pasting the text from your website instead.`);
    out = await structured({ system, prompt: prompt.replace(/Read this page[^\n]*\n*/, ""), schema: SCHEMA, effort: "medium" });
  }
  return {
    businessInfo: out.business_info,
    greeting: out.greeting,
    instructions: out.instructions,
    services: out.services.filter((s) => s.name).map((s) => ({ name: s.name, price: Math.max(0, Math.round(s.price || 0)) })),
    faqs: out.faqs.filter((f) => f.q && f.a),
  };
}

function safeUrl(raw) {
  try {
    const u = new URL(String(raw).trim());
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}

// Demo mode: pick out "Service ₹price" lines so the flow can be tried for free.
function demoAutofill(agent, org, notes) {
  const services = [];
  for (const line of notes.split(/\r?\n|,(?![^(]*\))/)) {
    const m = line.match(/^\s*([A-Za-z][\w &'/-]{1,40}?)\s*(?:[-:–]|for)?\s*(?:₹|rs\.?|inr)\s*([\d,]+)/i);
    if (m) services.push({ name: m[1].trim(), price: Number(m[2].replace(/,/g, "")) });
  }
  return {
    businessInfo: notes.trim() || agent.businessInfo,
    greeting: `Hello, thank you for calling ${org.name}. How can I help you today?`,
    instructions: agent.instructions || "Be warm and helpful. Only share facts from the business information.",
    services: services.length ? services : agent.services,
    faqs: [],
    demo: true,
  };
}
