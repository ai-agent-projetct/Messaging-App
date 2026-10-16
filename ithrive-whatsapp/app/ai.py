"""Claude decides each reply and extracts lead details as structured JSON."""
import json
import logging
from datetime import datetime, timezone
from typing import Literal

import anthropic
from pydantic import BaseModel

from .db import LEAD_FIELDS, STAGES, Lead
from .prompt import system_prompt

log = logging.getLogger("ithrive.ai")

INTENTS = ["greeting", "service_enquiry", "pricing", "new_project", "technical_question",
           "existing_project", "support", "complaint", "opt_out", "other"]
SERVICES = ["ai_agentic", "ai_chatbot_rag", "mobile_app", "website", "ecommerce", "custom_software_erp",
            "cloud_devops", "mvp", "dedicated_developers", "existing_project_support", "other"]


class LeadDetails(BaseModel):
    name: str | None = None
    company: str | None = None
    email: str | None = None
    project_type: str | None = None
    business_problem: str | None = None
    features: str | None = None
    platforms: str | None = None
    market: str | None = None
    budget: str | None = None
    timeline: str | None = None
    contact_preference: str | None = None


class Decision(BaseModel):
    reply: str
    intent: str
    service: str
    lead: LeadDetails
    score: Literal["hot", "warm", "cold"]
    stage: str
    handover: bool
    handover_reason: str
    summary: str


_nullable = {"anyOf": [{"type": "string"}, {"type": "null"}]}
SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["reply", "intent", "service", "lead", "score", "stage", "handover", "handover_reason", "summary"],
    "properties": {
        "reply": {"type": "string"},
        "intent": {"type": "string", "enum": INTENTS},
        "service": {"type": "string", "enum": SERVICES},
        "lead": {"type": "object", "additionalProperties": False, "required": LEAD_FIELDS,
                 "properties": {f: _nullable for f in LEAD_FIELDS}},
        "score": {"type": "string", "enum": ["hot", "warm", "cold"]},
        "stage": {"type": "string", "enum": STAGES},
        "handover": {"type": "boolean"},
        "handover_reason": {"type": "string"},
        "summary": {"type": "string"},
    },
}

FALLBACK_REPLY = ("Thank you for your message! A member of the iThrive Software team will get back "
                  "to you shortly.")


def conversation_text(lead: Lead, now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    known = {f: getattr(lead, f) for f in LEAD_FIELDS if getattr(lead, f)}
    lines = []
    for m in lead.messages[-30:]:
        who = "Customer" if m.direction == "in" else ("iThrive team member" if m.sender == "staff" else "Assistant")
        lines.append(f"[{m.created_at:%Y-%m-%d %H:%M}] {who}: {m.text}")
    return (
        f"WhatsApp profile name: {lead.profile_name or 'unknown'}\n"
        f"Known lead details: {json.dumps(known, ensure_ascii=False) if known else 'none yet'}\n"
        f"Current stage: {lead.stage} · score: {lead.score} · follow-ups already sent: {lead.followups_sent}\n"
        f"Current time (UTC): {now:%Y-%m-%d %H:%M}\n\n"
        "Conversation so far:\n" + ("\n".join(lines) or "(none)")
    )


class Assistant:
    def __init__(self, model: str = "claude-opus-5-5", effort: str = "medium", client=None):
        self.client = client or anthropic.AsyncAnthropic()
        self.model = model
        self.effort = effort

    async def decide(self, lead: Lead, knowledge: list[tuple[str, str]], mode: str = "reply") -> Decision:
        task = ("The customer has not replied to our last message. Write the next follow-up message."
                if mode == "followup" else "Reply to the customer's latest message(s).")
        try:
            response = await self.client.beta.messages.create(
                model=self.model,
                max_tokens=16000,
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
                thinking={"type": "adaptive"},
                output_config={"effort": self.effort, "format": {"type": "json_schema", "schema": SCHEMA}},
                cache_control={"type": "ephemeral"},
                system=system_prompt(knowledge),
                messages=[{"role": "user", "content": f"{conversation_text(lead)}\n\n{task}"}],
            )
        except anthropic.APIError as exc:
            log.error("AI request failed for %s: %s", lead.phone, exc)
            return self._handover("AI service error - please reply manually.")

        if response.stop_reason == "refusal":
            log.warning("AI declined for %s: %s", lead.phone, response.stop_details)
            return self._handover("AI declined to answer - please review.")
        if response.stop_reason == "max_tokens":
            return self._handover("AI response was cut off - please reply manually.")

        text = "".join(b.text for b in response.content if b.type == "text")
        try:
            return Decision.model_validate_json(text)
        except ValueError as exc:
            log.error("Bad AI JSON for %s: %s", lead.phone, exc)
            return self._handover("AI returned an invalid answer - please reply manually.")

    @staticmethod
    def _handover(reason: str) -> Decision:
        return Decision(reply=FALLBACK_REPLY, intent="other", service="other", lead=LeadDetails(),
                        score="warm", stage="handover", handover=True, handover_reason=reason,
                        summary=reason)
