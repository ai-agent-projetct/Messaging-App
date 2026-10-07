// Entry point: serves the website, the dashboard, the API and the phone webhooks.
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Store } from "./db.js";
import { aiEnabled } from "./agent.js";
import { apiRouter } from "./routes/api.js";
import { twilioRouter } from "./routes/twilio.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export function createApp(db) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
    });
    next();
  });
  app.use("/api", express.json({ limit: "200kb" }), apiRouter(db));
  app.use("/twilio", twilioRouter(db));
  app.get("/healthz", (req, res) => res.json({ ok: true }));
  app.use(express.static(path.join(here, "..", "public"), { extensions: ["html"] }));
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  });
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = new Store(process.env.DATA_FILE || path.join(here, "..", "data", "db.json"));
  const port = Number(process.env.PORT) || 3000;
  createApp(db).listen(port, () => {
    console.log(`VoiceDesk running at http://localhost:${port}`);
    console.log(aiEnabled() ? "AI: Claude is on." : "AI: demo mode (set ANTHROPIC_API_KEY to turn on real answers).");
  });
}
