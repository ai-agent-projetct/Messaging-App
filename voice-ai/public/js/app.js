// VoiceDesk dashboard entry point: loads every page module, then routes.
// Pages live in js/pages/*; shared plumbing in js/core.js. No build step.
import { router } from "./core.js";
import "./pages/home.js";
import "./pages/agents.js";
import "./pages/records.js";
import "./pages/manage.js";

window.addEventListener("hashchange", router);
router();
