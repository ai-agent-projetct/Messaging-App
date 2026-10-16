"""Official WhatsApp Business Platform (Cloud API) client and webhook helpers."""
import asyncio
import hashlib
import hmac
import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

log = logging.getLogger("ithrive.whatsapp")


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 10:                       # bare Indian mobile number
        digits = "91" + digits
    elif len(digits) == 11 and digits.startswith("0"):
        digits = "91" + digits[1:]
    return digits


def verify_signature(app_secret: str, body: bytes, header: str | None) -> bool:
    if not app_secret or not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header[7:])


@dataclass
class Inbound:
    wa_id: str
    phone: str
    profile_name: str
    kind: str
    text: str
    timestamp: datetime


@dataclass
class StatusUpdate:
    wa_id: str
    status: str
    error: str


def _text_of(m: dict) -> str:
    t = m.get("type")
    if t == "text":
        return m.get("text", {}).get("body", "")
    if t == "button":
        return m.get("button", {}).get("text", "")
    if t == "interactive":
        i = m.get("interactive", {})
        return (i.get("button_reply") or i.get("list_reply") or {}).get("title", "")
    if t in ("image", "video", "document"):
        caption = m.get(t, {}).get("caption") or m.get(t, {}).get("filename") or ""
        return f"[customer sent a {t}{': ' + caption if caption else ''}]"
    if t == "audio":
        return "[customer sent a voice note - politely ask them to type their message]"
    if t == "location":
        loc = m.get("location", {})
        return f"[customer shared a location: {loc.get('name', '')} {loc.get('address', '')}]".strip()
    return f"[customer sent a {t} message]"


def parse_webhook(payload: dict) -> tuple[list[Inbound], list[StatusUpdate]]:
    messages, statuses = [], []
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            names = {c.get("wa_id"): c.get("profile", {}).get("name", "") for c in value.get("contacts", [])}
            for m in value.get("messages", []):
                ts = datetime.fromtimestamp(int(m.get("timestamp", 0)) or datetime.now().timestamp(), timezone.utc)
                messages.append(Inbound(m.get("id", ""), normalize_phone(m.get("from", "")),
                                        names.get(m.get("from"), ""), m.get("type", "text"), _text_of(m), ts))
            for s in value.get("statuses", []):
                err = "; ".join(e.get("title", "") for e in s.get("errors", []))
                statuses.append(StatusUpdate(s.get("id", ""), s.get("status", ""), err))
    return messages, statuses


class WhatsAppError(Exception):
    pass


class WhatsAppClient:
    def __init__(self, token: str, phone_number_id: str, graph_version: str = "v23.0",
                 dry_run: bool = False, http: httpx.AsyncClient | None = None):
        self.url = f"https://graph.facebook.com/{graph_version}/{phone_number_id}/messages"
        self.token = token
        self.dry_run = dry_run
        self.http = http or httpx.AsyncClient(timeout=20)

    async def _post(self, payload: dict) -> str:
        """Send and return the WhatsApp message id. Retries rate limits and server errors."""
        body = {"messaging_product": "whatsapp", **payload}
        if self.dry_run:
            log.info("[DRY_RUN] %s", json.dumps(body, ensure_ascii=False))
            return ""
        for attempt in range(3):
            try:
                r = await self.http.post(self.url, json=body, headers={"Authorization": f"Bearer {self.token}"})
            except httpx.TransportError as exc:
                if attempt == 2:
                    raise WhatsAppError(f"network error: {exc}") from exc
            else:
                if r.status_code < 300:
                    return (r.json().get("messages") or [{}])[0].get("id", "")
                if r.status_code != 429 and r.status_code < 500:
                    raise WhatsAppError(f"{r.status_code}: {r.text[:300]}")
                if attempt == 2:
                    raise WhatsAppError(f"{r.status_code} after retries: {r.text[:300]}")
            await asyncio.sleep(2 ** attempt)
        raise WhatsAppError("unreachable")

    async def send_text(self, to: str, text: str) -> str:
        return await self._post({"recipient_type": "individual", "to": to, "type": "text",
                                 "text": {"body": text[:4096], "preview_url": True}})

    async def send_template(self, to: str, name: str, language: str, params: list[str] | None = None) -> str:
        components = [{"type": "body", "parameters": [{"type": "text", "text": p} for p in params]}] if params else []
        return await self._post({"to": to, "type": "template",
                                 "template": {"name": name, "language": {"code": language}, "components": components}})

    async def mark_read(self, wa_id: str) -> None:
        try:
            await self._post({"status": "read", "message_id": wa_id})
        except WhatsAppError as exc:
            log.debug("mark_read failed: %s", exc)
