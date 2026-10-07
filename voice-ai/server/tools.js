// The actions an agent can take during a call. Claude decides *when* to use
// them; this file decides *what actually happens* (and enforces the rules,
// such as never double-booking a slot).
import { DEFAULT_HOURS } from "./catalog.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function todayIn(timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date()); // YYYY-MM-DD
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function weekday(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function freeSlots(db, agent, date) {
  const hours = agent.hours ?? DEFAULT_HOURS;
  if (!hours.days.includes(weekday(date))) return [];
  const taken = new Set(
    db
      .find("appointments", (a) => a.agentId === agent.id && a.date === date && a.status !== "cancelled")
      .map((a) => a.time),
  );
  const slots = [];
  for (let t = toMinutes(hours.open); t + hours.slotMinutes <= toMinutes(hours.close); t += hours.slotMinutes) {
    if (!taken.has(toHHMM(t))) slots.push(toHHMM(t));
  }
  return slots;
}

// Tool definitions sent to Claude. `strict: true` makes Claude's arguments
// always match the schema exactly.
export function toolDefinitions(agent) {
  const tools = [
    {
      name: "save_lead",
      description:
        "Save the caller's details for the business owner to follow up: use whenever a caller shows interest, asks for a callback, or leaves a message.",
      strict: true,
      input_schema: {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          phone: { type: "string", description: "Caller's phone number" },
          interest: { type: "string", description: "What they want, in a few words" },
          notes: { type: "string", description: "Any other useful details (budget, timing, message)" },
        },
        required: ["customer_name", "phone", "interest", "notes"],
        additionalProperties: false,
      },
    },
    {
      name: "end_call",
      description: "Hang up after you have said goodbye, when the caller has nothing else they need.",
      strict: true,
      input_schema: {
        type: "object",
        properties: { summary: { type: "string", description: "One-sentence summary of the call" } },
        required: ["summary"],
        additionalProperties: false,
      },
    },
  ];
  if (agent.bookingEnabled) {
    tools.unshift(
      {
        name: "check_availability",
        description: "List free appointment slots on a date. Always check before offering times.",
        strict: true,
        input_schema: {
          type: "object",
          properties: { date: { type: "string", description: "YYYY-MM-DD" } },
          required: ["date"],
          additionalProperties: false,
        },
      },
      {
        name: "book_appointment",
        description:
          "Book a slot once the caller has confirmed the date, time, their name and phone number. Read the details back before booking.",
        strict: true,
        input_schema: {
          type: "object",
          properties: {
            customer_name: { type: "string" },
            phone: { type: "string" },
            date: { type: "string", description: "YYYY-MM-DD" },
            time: { type: "string", description: "HH:MM, 24-hour" },
            service: { type: "string" },
            notes: { type: "string" },
          },
          required: ["customer_name", "phone", "date", "time", "service", "notes"],
          additionalProperties: false,
        },
      },
    );
  }
  if (agent.transferNumber) {
    tools.push({
      name: "transfer_to_human",
      description: "Transfer the call to a staff member when the caller insists on a person or you cannot help.",
      strict: true,
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
        additionalProperties: false,
      },
    });
  }
  return tools;
}

// Runs one tool call. Returns { result: string for Claude, action?: call control }.
export function runTool(db, agent, call, name, input) {
  const today = todayIn(agent.timeZone);
  switch (name) {
    case "check_availability": {
      if (!DATE_RE.test(input.date)) return { result: "Error: date must be YYYY-MM-DD." };
      if (input.date < today) return { result: "That date is in the past." };
      const slots = freeSlots(db, agent, input.date);
      const day = DAY_NAMES[weekday(input.date)];
      return {
        result: slots.length
          ? `${day} ${input.date}: free slots ${slots.join(", ")}.`
          : `${day} ${input.date}: closed or fully booked. Suggest another day.`,
      };
    }
    case "book_appointment": {
      if (!DATE_RE.test(input.date) || !TIME_RE.test(input.time)) {
        return { result: "Error: date must be YYYY-MM-DD and time HH:MM." };
      }
      if (input.date < today) return { result: "That date is in the past." };
      if (!freeSlots(db, agent, input.date).includes(input.time)) {
        return { result: "That slot is not available. Check availability again and offer another time." };
      }
      const appt = db.insert("appointments", {
        orgId: agent.orgId,
        agentId: agent.id,
        callId: call.id,
        customerName: input.customer_name,
        phone: input.phone,
        date: input.date,
        time: input.time,
        service: input.service,
        notes: input.notes,
        status: "confirmed",
      });
      return { result: `Booked. Reference ${appt.id.slice(0, 6).toUpperCase()}.` };
    }
    case "save_lead": {
      db.insert("leads", {
        orgId: agent.orgId,
        agentId: agent.id,
        callId: call.id,
        customerName: input.customer_name,
        phone: input.phone,
        interest: input.interest,
        notes: input.notes,
        status: "new",
      });
      return { result: "Saved. The team will follow up." };
    }
    case "transfer_to_human":
      return { result: "Transferring now. Tell the caller you are connecting them.", action: { type: "transfer", reason: input.reason } };
    case "end_call":
      return { result: "Call will end after your goodbye.", action: { type: "hangup", summary: input.summary } };
    default:
      return { result: `Unknown tool ${name}.` };
  }
}
