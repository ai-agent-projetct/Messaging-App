// Ready-made options shown in the dashboard: languages, phone voices and
// starter templates for common local businesses.

// `twilio` is the speech-recognition language code for <Gather>, `voice` is a
// Twilio <Say> voice (Google neural voices). Swap voices freely in the editor.
export const LANGUAGES = [
  { code: "en-IN", name: "English (India)", voice: "Google.en-IN-Neural2-A" },
  { code: "hi-IN", name: "Hindi", voice: "Google.hi-IN-Neural2-A" },
  { code: "ta-IN", name: "Tamil", voice: "Google.ta-IN-Standard-A" },
  { code: "te-IN", name: "Telugu", voice: "Google.te-IN-Standard-A" },
  { code: "kn-IN", name: "Kannada", voice: "Google.kn-IN-Standard-A" },
  { code: "ml-IN", name: "Malayalam", voice: "Google.ml-IN-Standard-A" },
  { code: "mr-IN", name: "Marathi", voice: "Google.mr-IN-Standard-A" },
  { code: "bn-IN", name: "Bengali", voice: "Google.bn-IN-Standard-A" },
  { code: "gu-IN", name: "Gujarati", voice: "Google.gu-IN-Standard-A" },
  { code: "en-US", name: "English (US)", voice: "Google.en-US-Neural2-F" },
];

export const DEFAULT_HOURS = {
  days: [1, 2, 3, 4, 5, 6], // Monday to Saturday (0 = Sunday)
  open: "09:00",
  close: "18:00",
  slotMinutes: 30,
};

export const TEMPLATES = [
  {
    id: "clinic",
    label: "Clinic / doctor",
    agent: {
      name: "Clinic Receptionist",
      greeting: "Hello, thank you for calling. This is the clinic's assistant. How can I help you today?",
      businessInfo:
        "Dr. Priya's Family Clinic, 12 Gandhi Road. General physician consultations ₹400, follow-ups within 7 days free. Blood tests available 8am–11am. Parking available behind the building.",
      instructions:
        "Help callers book, reschedule or ask about consultations. Never give medical advice or diagnoses; for emergencies tell them to call 108 or go to the nearest hospital immediately.",
      services: ["General consultation", "Follow-up", "Blood test"],
      bookingEnabled: true,
    },
  },
  {
    id: "salon",
    label: "Salon / spa",
    agent: {
      name: "Salon Front Desk",
      greeting: "Hi! Thanks for calling the salon. Would you like to book an appointment?",
      businessInfo:
        "Glow Unisex Salon, Anna Nagar. Haircut ₹300 (men) / ₹600 (women), hair colour from ₹1500, facial from ₹800, bridal packages on consultation.",
      instructions: "Book appointments, explain prices and suggest the right service. Be warm and upbeat.",
      services: ["Haircut", "Hair colour", "Facial", "Bridal consultation"],
      bookingEnabled: true,
    },
  },
  {
    id: "restaurant",
    label: "Restaurant",
    agent: {
      name: "Restaurant Host",
      greeting: "Hello, thanks for calling! Would you like to reserve a table or ask about our menu?",
      businessInfo:
        "Spice Route Restaurant. South Indian and North Indian, veg and non-veg. Lunch 12–3:30pm, dinner 7–11pm. Home delivery through Swiggy and Zomato. Tables for up to 12 people.",
      instructions:
        "Take table reservations (ask for party size and put it in notes). Answer menu and timing questions. For large parties over 12, take a message for the manager.",
      services: ["Table reservation"],
      bookingEnabled: true,
    },
  },
  {
    id: "realestate",
    label: "Real estate (lead capture)",
    agent: {
      name: "Property Enquiry Assistant",
      greeting: "Hello, thank you for calling about our properties. Are you looking to buy or rent?",
      businessInfo:
        "Sunrise Homes. 2 and 3 BHK apartments in Velachery and OMR. 2 BHK from ₹65 lakh, 3 BHK from ₹95 lakh. Site visits daily 10am–6pm.",
      instructions:
        "Qualify the caller: budget, preferred area, BHK, timeline to buy. Always save their details as a lead. Offer a site visit and book it if they agree.",
      services: ["Site visit"],
      bookingEnabled: true,
    },
  },
  {
    id: "blank",
    label: "Start from scratch",
    agent: {
      name: "My Assistant",
      greeting: "Hello, thanks for calling. How can I help you?",
      businessInfo: "",
      instructions: "",
      services: [],
      bookingEnabled: false,
    },
  },
];

export function languageInfo(code) {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}
