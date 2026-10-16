import asyncio
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.ai import SCHEMA, Decision, LeadDetails, conversation_text
from app.config import Settings
from app.db import Lead, make_sessionmaker
from app.main import create_app
from app.notify import Notifier
from app.service import Engine
from app.whatsapp import Inbound, normalize_phone, parse_webhook, verify_signature

PHONE = "919876543210"


class FakeWhatsApp:
    def __init__(self):
        self.sent, self.n = [], 0

    async def send_text(self, to, text):
        self.n += 1
        self.sent.append({"to": to, "text": text})
        return f"out-{self.n}"

    async def send_template(self, to, name, language, params=None):
        self.n += 1
        self.sent.append({"to": to, "template": name, "params": params})
        return f"out-{self.n}"

    async def mark_read(self, wa_id):
        pass


class FakeAI:
    def __init__(self, **overrides):
        self.calls, self.overrides = [], overrides

    async def decide(self, lead, knowledge, mode="reply"):
        self.calls.append((mode, lead.messages[-1].text))
        base = dict(reply="Follow-up: shall we schedule a quick call?" if mode == "followup"
                    else "Hello! Welcome to iThrive Software. What would you like to build?",
                    intent="new_project", service="mobile_app", lead=LeadDetails(project_type="Taxi app"),
                    score="warm", stage="qualifying", handover=False, handover_reason="", summary="Taxi app enquiry")
        base.update(self.overrides)
        return Decision(**base)


class Clock:
    def __init__(self, start="2026-10-16T05:30:00+00:00"):          # 11:00 IST
        self.t = datetime.fromisoformat(start)

    def __call__(self):
        return self.t

    def advance(self, hours):
        self.t += timedelta(hours=hours)


def make(ai=None, clock=None, **settings):
    s = Settings(reply_delay_seconds=0, sales_whatsapp="919000000001", database_url="sqlite://", **settings)
    wa = FakeWhatsApp()
    clock = clock or Clock()
    eng = Engine(make_sessionmaker("sqlite://"), wa, ai or FakeAI(), Notifier(wa, s.sales_whatsapp), s, now=clock)
    eng.seed_knowledge()
    return eng, wa, clock


def msg(text, wa_id=None, at=None):
    return Inbound(wa_id or f"in-{text}-{at}", PHONE, "Ravi Kumar", "text", text,
                   at or datetime.now(timezone.utc))


def lead(eng) -> Lead:
    with eng.Session() as db:
        from sqlalchemy import select
        row = db.scalar(select(Lead).where(Lead.phone == PHONE))
        list(row.messages)
        return row


def run(coro):
    return asyncio.run(coro)


async def receive(eng, m):
    task = eng.receive(m)
    if task:
        await task


def test_phone_and_signature():
    assert normalize_phone("9384564915") == "919384564915"
    assert normalize_phone("+91 93845 64915") == "919384564915"
    body = b'{"a":1}'
    sig = "sha256=" + hmac.new(b"s3cret", body, hashlib.sha256).hexdigest()
    assert verify_signature("s3cret", body, sig)
    assert not verify_signature("other", body, sig)
    assert not verify_signature("s3cret", body, None)


def test_ai_reply_saves_lead_details_and_schedules_followup():
    eng, wa, clock = make()
    run(receive(eng, msg("Hi, I need an AI taxi booking app", at=clock())))
    assert wa.sent[-1]["text"].startswith("Hello! Welcome to iThrive")
    row = lead(eng)
    assert row.project_type == "Taxi app"
    assert row.profile_name == "Ravi Kumar"
    assert row.stage == "qualifying"
    assert row.next_followup_at is not None
    assert [m.sender for m in row.messages] == ["client", "ai"]


def test_duplicate_webhook_is_ignored():
    eng, wa, clock = make()

    async def go():
        await receive(eng, msg("hello", wa_id="wamid.1", at=clock()))
        await receive(eng, msg("hello", wa_id="wamid.1", at=clock()))
    run(go())
    assert len(wa.sent) == 1


def test_burst_of_messages_gets_one_reply():
    eng, wa, clock = make()
    eng.s.reply_delay_seconds = 0.05

    async def go():
        eng.receive(msg("hi", at=clock()))
        t = eng.receive(msg("I need a website", at=clock()))
        await t
    run(go())
    assert len(wa.sent) == 1
    assert eng.ai.calls == [("reply", "I need a website")]


def test_asking_for_a_human_hands_over_without_ai():
    eng, wa, clock = make()
    run(receive(eng, msg("Can I talk to a person please", at=clock())))
    row = lead(eng)
    assert row.human_takeover and row.stage == "handover"
    assert eng.ai.calls == []
    assert wa.sent[0]["to"] == PHONE and "team member" in wa.sent[0]["text"]
    assert wa.sent[1]["to"] == "919000000001"                          # sales alert
    run(receive(eng, msg("hello?", at=clock())))
    assert len(wa.sent) == 2                                            # AI stays silent while a person handles it


def test_ai_handover_and_qualified_alerts():
    eng, wa, clock = make(ai=FakeAI(handover=True, handover_reason="Wants a quotation", stage="handover"))
    run(receive(eng, msg("Send me a quotation", at=clock())))
    row = lead(eng)
    assert row.human_takeover and row.handover_reason == "Wants a quotation"
    assert any("needs a person" in m.get("text", "") for m in wa.sent if m["to"] == "919000000001")

    eng2, wa2, clock2 = make(ai=FakeAI(score="hot", stage="qualified"))
    run(receive(eng2, msg("Both Android and iOS, launch in March", at=clock2())))
    run(receive(eng2, msg("My name is Ravi", at=clock2())))
    alerts = [m for m in wa2.sent if m["to"] == "919000000001"]
    assert len(alerts) == 1 and "Qualified lead" in alerts[0]["text"]  # alerted once, not every message


def test_opt_out():
    eng, wa, clock = make()
    run(receive(eng, msg("hi", at=clock())))
    run(receive(eng, msg("STOP", at=clock())))
    row = lead(eng)
    assert row.opted_out and row.next_followup_at is None
    assert "won't receive" in wa.sent[-1]["text"]
    clock.advance(100)
    assert run(eng.run_followups()) == 0


def test_followups_in_window_then_template_then_stop():
    eng, wa, clock = make(followup_hours=[4, 22, 72], followup_template="enquiry_followup")
    run(receive(eng, msg("hi", at=clock())))
    clock.advance(4.1)
    run(eng.run_followups())
    assert wa.sent[-1]["text"].startswith("Follow-up")                  # inside 24h: AI-written
    clock.advance(22.1)
    run(eng.run_followups())
    assert wa.sent[-1]["template"] == "enquiry_followup"               # outside 24h: approved template
    assert wa.sent[-1]["params"] == ["Ravi"]
    clock.advance(72.1)
    run(eng.run_followups())
    count = len(wa.sent)
    clock.advance(200)
    run(eng.run_followups())
    assert len(wa.sent) == count and lead(eng).followups_sent == 3     # max reached


def test_no_template_means_no_followup_after_24h():
    eng, wa, clock = make(followup_hours=[30])
    run(receive(eng, msg("hi", at=clock())))
    clock.advance(31)
    run(eng.run_followups())
    assert len(wa.sent) == 1 and lead(eng).next_followup_at is None


def test_quiet_hours():
    eng, _, _ = make()
    assert eng.in_quiet_hours(datetime(2026, 10, 16, 17, 0, tzinfo=timezone.utc))      # 22:30 IST
    assert not eng.in_quiet_hours(datetime(2026, 10, 16, 6, 0, tzinfo=timezone.utc))   # 11:30 IST


def test_staff_reply_takes_over_and_release():
    eng, wa, clock = make()
    run(receive(eng, msg("hi", at=clock())))
    row = lead(eng)
    run(eng.staff_send(row.id, "Hi Ravi, this is Vinoth from iThrive"))
    row = lead(eng)
    assert row.human_takeover and row.messages[-1].sender == "staff"
    eng.set_takeover(row.id, False)
    assert not lead(eng).human_takeover


def test_conversation_text_and_schema():
    eng, _, clock = make()
    run(receive(eng, msg("hi", at=clock())))
    text = conversation_text(lead(eng))
    assert "Taxi app" in text and "Customer: hi" in text
    assert set(SCHEMA["required"]) == set(Decision.model_fields)


def test_webhook_parsing():
    payload = {"entry": [{"changes": [{"value": {
        "contacts": [{"wa_id": PHONE, "profile": {"name": "Ravi"}}],
        "messages": [{"id": "wamid.9", "from": PHONE, "timestamp": "1760000000", "type": "interactive",
                      "interactive": {"button_reply": {"title": "Mobile app"}}}],
        "statuses": [{"id": "out-1", "status": "delivered"}]}}]}]}
    msgs, statuses = parse_webhook(payload)
    assert msgs[0].text == "Mobile app" and msgs[0].profile_name == "Ravi"
    assert statuses[0].status == "delivered"


def test_http_endpoints():
    eng, wa, clock = make()
    eng.s.verify_token, eng.s.app_secret, eng.s.admin_password = "vt", "sec", "pw"
    app = create_app(eng.s, eng, scheduler=False)
    with TestClient(app) as c:
        assert c.get("/webhook", params={"hub.mode": "subscribe", "hub.verify_token": "vt", "hub.challenge": "42"}).text == "42"
        assert c.get("/webhook", params={"hub.mode": "subscribe", "hub.verify_token": "x", "hub.challenge": "42"}).status_code == 403

        body = json.dumps({"entry": [{"changes": [{"value": {"messages": [
            {"id": "w1", "from": PHONE, "timestamp": "1760000000", "type": "text", "text": {"body": "hi"}}]}}]}]})
        assert c.post("/webhook", content=body, headers={"x-hub-signature-256": "sha256=00"}).status_code == 401
        sig = "sha256=" + hmac.new(b"sec", body.encode(), hashlib.sha256).hexdigest()
        assert c.post("/webhook", content=body, headers={"x-hub-signature-256": sig}).status_code == 200

        assert c.get("/admin").status_code == 401
        assert c.get("/admin", auth=("admin", "wrong")).status_code == 401
        page = c.get("/admin", auth=("admin", "pw"))
        assert page.status_code == 200 and "Enquiries" in page.text
        row = lead(eng)
        assert "hi" in c.get(f"/admin/leads/{row.id}", auth=("admin", "pw")).text
        r = c.post(f"/admin/leads/{row.id}/update", data={"stage": "won", "company": "Ravi Cabs"},
                   auth=("admin", "pw"), follow_redirects=False)
        assert r.status_code == 303 and lead(eng).company == "Ravi Cabs"
        assert "About iThrive Software" in c.get("/admin/knowledge", auth=("admin", "pw")).text
        assert "Ravi Cabs" in c.get("/admin/export.csv", auth=("admin", "pw")).text

