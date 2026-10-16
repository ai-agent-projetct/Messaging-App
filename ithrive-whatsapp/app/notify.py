"""Sales-team alerts: WhatsApp message to a salesperson and/or a JSON webhook (n8n, Zapier, CRM)."""
import logging

import httpx

from .db import LEAD_FIELDS, Lead

log = logging.getLogger("ithrive.notify")


def lead_payload(lead: Lead) -> dict:
    return {
        "id": lead.id, "phone": lead.phone, "whatsapp_link": f"https://wa.me/{lead.phone}",
        "profile_name": lead.profile_name, "service": lead.service, "intent": lead.intent,
        "score": lead.score, "stage": lead.stage, "summary": lead.summary,
        "handover_reason": lead.handover_reason,
        **{f: getattr(lead, f) for f in LEAD_FIELDS},
    }


def alert_text(event: str, lead: Lead) -> str:
    title = {"lead.qualified": "🔥 Qualified lead", "lead.handover": "🙋 Client needs a person"}.get(event, event)
    lines = [f"{title}: {lead.display_name}" + (f" ({lead.company})" if lead.company else ""),
             f"Service: {lead.service or '-'} · score: {lead.score}",
             lead.summary or "",
             f"Reason: {lead.handover_reason}" if event == "lead.handover" and lead.handover_reason else "",
             f"Chat: https://wa.me/{lead.phone}"]
    return "\n".join(line for line in lines if line)


class Notifier:
    def __init__(self, whatsapp, sales_whatsapp: str = "", webhook_url: str = "",
                 http: httpx.AsyncClient | None = None):
        self.whatsapp = whatsapp
        self.sales_whatsapp = sales_whatsapp
        self.webhook_url = webhook_url
        self.http = http or httpx.AsyncClient(timeout=15)

    async def send(self, event: str, lead: Lead) -> list[tuple[str, bool, str]]:
        """Returns (channel, ok, detail) for each channel tried, so results can be logged honestly."""
        results = []
        if self.sales_whatsapp:
            try:
                await self.whatsapp.send_text(self.sales_whatsapp, alert_text(event, lead))
                results.append(("whatsapp", True, self.sales_whatsapp))
            except Exception as exc:  # noqa: BLE001 - one channel failing must not stop the others
                results.append(("whatsapp", False, str(exc)))
        if self.webhook_url:
            try:
                r = await self.http.post(self.webhook_url, json={"event": event, "lead": lead_payload(lead)})
                r.raise_for_status()
                results.append(("webhook", True, str(r.status_code)))
            except Exception as exc:  # noqa: BLE001
                results.append(("webhook", False, str(exc)))
        for channel, ok, detail in results:
            (log.info if ok else log.error)("%s via %s for lead %s: %s", event, channel, lead.id, detail)
        return results
