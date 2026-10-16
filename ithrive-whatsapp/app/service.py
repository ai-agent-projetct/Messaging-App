"""Conversation engine: inbound handling, AI replies, hand-over, alerts and follow-ups."""
import asyncio
import logging
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select

from .ai import Decision
from .config import Settings
from .db import LEAD_FIELDS, OPEN_STAGES, EventLog, KnowledgeItem, Lead, Message, aware, utcnow
from .knowledge import SEED
from .whatsapp import Inbound, StatusUpdate, WhatsAppError

log = logging.getLogger("ithrive.engine")

WINDOW = timedelta(hours=24)        # WhatsApp customer-service window
OPT_OUT_RX = re.compile(r"^\s*(stop|unsubscribe|stop messages|don'?t message( me)?|remove me)\W*$", re.I)
HUMAN_RX = re.compile(r"\b(human|real person|agent|executive|talk to (a |some)?(person|one|body)|"
                      r"speak to (a |some)?(person|one|body)|call me)\b", re.I)

OPT_OUT_REPLY = ("You won't receive any more messages from iThrive Software. "
                 "If you need us later, just send us a message here.")
HUMAN_REPLY = ("Sure! I've passed your request to the iThrive Software team - a team member will "
               "reply to you here shortly.")


class Engine:
    def __init__(self, sessionmaker, whatsapp, assistant, notifier, settings: Settings, now=utcnow):
        self.Session = sessionmaker
        self.wa = whatsapp
        self.ai = assistant
        self.notifier = notifier
        self.s = settings
        self.now = now
        self.locks: dict[str, asyncio.Lock] = {}
        self.pending: dict[str, asyncio.Task] = {}

    # ------------------------------------------------------------------ setup
    def seed_knowledge(self) -> None:
        with self.Session() as db:
            if db.scalar(select(KnowledgeItem.id).limit(1)) is None:
                db.add_all(KnowledgeItem(title=t, content=c) for t, c in SEED)
                db.commit()

    def knowledge(self, db) -> list[tuple[str, str]]:
        rows = db.scalars(select(KnowledgeItem).where(KnowledgeItem.enabled).order_by(KnowledgeItem.id))
        return [(k.title, k.content) for k in rows]

    def _lock(self, phone: str) -> asyncio.Lock:
        return self.locks.setdefault(phone, asyncio.Lock())

    @staticmethod
    def _log(db, lead: Lead | None, type_: str, detail: str = "", ok: bool = True) -> None:
        db.add(EventLog(lead_id=lead.id if lead else None, type=type_, detail=detail, ok=ok))

    # ------------------------------------------------------------- outbound
    async def _send(self, db, lead: Lead, text: str, sender: str, kind: str = "text") -> bool:
        try:
            wa_id = await self.wa.send_text(lead.phone, text)
        except WhatsAppError as exc:
            log.error("send to %s failed: %s", lead.phone, exc)
            db.add(Message(lead=lead, direction="out", sender=sender, kind=kind, text=text, status="failed"))
            self._log(db, lead, "send_failed", str(exc), ok=False)
            return False
        db.add(Message(lead=lead, direction="out", sender=sender, kind=kind, text=text,
                       wa_id=wa_id or None, status="sent", created_at=self.now()))
        lead.last_outbound_at = self.now()
        return True

    async def _alert(self, db, event: str, lead: Lead) -> None:
        results = await self.notifier.send(event, lead)
        if not results:
            self._log(db, lead, event, "no alert channel configured (see SALES_WHATSAPP / N8N_WEBHOOK_URL)", ok=False)
        for channel, ok, detail in results:
            self._log(db, lead, event, f"{channel}: {detail}", ok=ok)

    def _schedule_followup(self, lead: Lead) -> None:
        hours = self.s.followup_hours
        if (lead.stage not in OPEN_STAGES or lead.human_takeover or lead.opted_out
                or lead.followups_sent >= len(hours)):
            lead.next_followup_at = None
        else:
            lead.next_followup_at = self.now() + timedelta(hours=hours[lead.followups_sent])

    # -------------------------------------------------------------- inbound
    def receive(self, msg: Inbound) -> asyncio.Task | None:
        """Store an incoming message and schedule the reply. Returns the reply task (awaitable in tests)."""
        with self.Session() as db:
            if msg.wa_id and db.scalar(select(Message.id).where(Message.wa_id == msg.wa_id)):
                return None                                   # Meta re-delivered a webhook
            lead = db.scalar(select(Lead).where(Lead.phone == msg.phone))
            if lead is None:
                lead = Lead(phone=msg.phone)
                db.add(lead)
            if msg.profile_name:
                lead.profile_name = msg.profile_name
            db.add(Message(lead=lead, direction="in", sender="client", kind=msg.kind, text=msg.text,
                           wa_id=msg.wa_id or None, created_at=msg.timestamp))
            lead.last_inbound_at = msg.timestamp
            lead.next_followup_at = None                      # they replied; stop the follow-up timer
            lead.followups_sent = 0
            db.commit()

        if msg.wa_id:
            asyncio.ensure_future(self.wa.mark_read(msg.wa_id))

        if OPT_OUT_RX.match(msg.text):
            self._cancel_pending(msg.phone)
            return asyncio.ensure_future(self._serial(msg.phone, self._opt_out))
        if HUMAN_RX.search(msg.text):
            self._cancel_pending(msg.phone)
            return asyncio.ensure_future(self._serial(msg.phone, self._human_request))

        # Wait briefly so a burst of messages gets one combined answer.
        self._cancel_pending(msg.phone)
        task = asyncio.ensure_future(self._debounced(msg.phone))
        self.pending[msg.phone] = task
        return task

    def _cancel_pending(self, phone: str) -> None:
        task = self.pending.pop(phone, None)
        if task and not task.done():
            task.cancel()

    async def _debounced(self, phone: str) -> None:
        try:
            await asyncio.sleep(self.s.reply_delay_seconds)
        except asyncio.CancelledError:
            return
        self.pending.pop(phone, None)
        await self._serial(phone, self._reply)

    async def _serial(self, phone: str, job) -> None:
        async with self._lock(phone):
            try:
                await job(phone)
            except Exception:  # noqa: BLE001 - never let one conversation crash the worker
                log.exception("processing %s failed", phone)

    async def _opt_out(self, phone: str) -> None:
        with self.Session() as db:
            lead = db.scalar(select(Lead).where(Lead.phone == phone))
            lead.opted_out = True
            lead.next_followup_at = None
            await self._send(db, lead, OPT_OUT_REPLY, "system")
            self._log(db, lead, "opt_out")
            db.commit()

    async def _human_request(self, phone: str) -> None:
        with self.Session() as db:
            lead = db.scalar(select(Lead).where(Lead.phone == phone))
            lead.opted_out = False
            if lead.human_takeover:
                return                                        # a person is already handling it
            await self._send(db, lead, HUMAN_REPLY, "system")
            lead.human_takeover = True
            lead.stage = "handover"
            lead.handover_reason = "Client asked to speak to a person."
            lead.next_followup_at = None
            await self._alert(db, "lead.handover", lead)
            db.commit()

    async def _reply(self, phone: str) -> None:
        with self.Session() as db:
            lead = db.scalar(select(Lead).where(Lead.phone == phone))
            if lead.human_takeover:
                log.info("lead %s is with staff; no auto-reply", lead.id)
                return
            lead.opted_out = False                            # they messaged us again
            if not lead.messages or lead.messages[-1].direction != "in":
                return
            decision = await self.ai.decide(lead, self.knowledge(db), mode="reply")
            if decision.reply:
                await self._send(db, lead, decision.reply, "ai")
            await self._apply(db, lead, decision)
            db.commit()

    async def _apply(self, db, lead: Lead, d: Decision) -> None:
        for f in LEAD_FIELDS:
            value = getattr(d.lead, f)
            if value and value.strip():
                setattr(lead, f, value.strip()[:2000])
        lead.intent, lead.service, lead.score = d.intent, d.service, d.score
        lead.stage = d.stage
        if d.summary:
            lead.summary = d.summary
        if d.handover:
            lead.human_takeover = True
            lead.stage = "handover"
            lead.handover_reason = d.handover_reason
            await self._alert(db, "lead.handover", lead)
        elif not lead.sales_alerted and (lead.score == "hot" or lead.stage in ("qualified", "meeting_requested")):
            lead.sales_alerted = True
            await self._alert(db, "lead.qualified", lead)
        self._schedule_followup(lead)

    # ------------------------------------------------------------ statuses
    def update_status(self, st: StatusUpdate) -> None:
        with self.Session() as db:
            msg = db.scalar(select(Message).where(Message.wa_id == st.wa_id))
            if msg is None:
                return
            order = ["", "sent", "delivered", "read"]
            if st.status == "failed":
                msg.status = "failed"
                self._log(db, msg.lead, "delivery_failed", st.error, ok=False)
            elif order.index(st.status) > order.index(msg.status if msg.status in order else ""):
                msg.status = st.status
            db.commit()

    # ------------------------------------------------------------ follow-ups
    def in_quiet_hours(self, at: datetime) -> bool:
        if not self.s.quiet_hours:
            return False
        start, end = self.s.quiet_hours
        hour = at.astimezone(ZoneInfo(self.s.timezone)).hour
        return (hour >= start or hour < end) if start > end else (start <= hour < end)

    async def run_followups(self) -> int:
        now = self.now()
        if self.in_quiet_hours(now):
            return 0
        with self.Session() as db:
            due = db.scalars(select(Lead.phone).where(
                Lead.stage.in_(OPEN_STAGES), Lead.human_takeover.is_(False), Lead.opted_out.is_(False),
                Lead.next_followup_at.is_not(None), Lead.next_followup_at <= now)).all()
        for phone in due:
            await self._serial(phone, self._followup)
        return len(due)

    async def _followup(self, phone: str) -> None:
        now = self.now()
        with self.Session() as db:
            lead = db.scalar(select(Lead).where(Lead.phone == phone))
            due = aware(lead.next_followup_at)
            if (due is None or due > now or lead.human_takeover or lead.opted_out
                    or not lead.messages or lead.messages[-1].direction != "out"):
                return
            last_in = aware(lead.last_inbound_at)
            if last_in and now - last_in < WINDOW:
                d = await self.ai.decide(lead, self.knowledge(db), mode="followup")
                if d.reply:
                    await self._send(db, lead, d.reply, "ai", kind="followup")
                await self._apply(db, lead, d)
            elif self.s.followup_template:
                first = (lead.name or lead.profile_name or "there").split()[0]
                try:
                    wa_id = await self.wa.send_template(phone, self.s.followup_template,
                                                        self.s.template_language, [first])
                    db.add(Message(lead=lead, direction="out", sender="system", kind="template",
                                   text=f"[template: {self.s.followup_template}]", wa_id=wa_id or None,
                                   status="sent", created_at=now))
                    lead.last_outbound_at = now
                except WhatsAppError as exc:
                    self._log(db, lead, "send_failed", str(exc), ok=False)
            else:
                lead.next_followup_at = None                  # outside 24h and no template: stop
                db.commit()
                return
            lead.followups_sent += 1
            self._schedule_followup(lead)
            db.commit()

    # --------------------------------------------------------- staff actions
    async def staff_send(self, lead_id: int, text: str) -> bool:
        with self.Session() as db:
            lead = db.get(Lead, lead_id)
            async with self._lock(lead.phone):
                lead.human_takeover = True
                lead.next_followup_at = None
                ok = await self._send(db, lead, text, "staff")
                db.commit()
                return ok

    def set_takeover(self, lead_id: int, on: bool) -> None:
        with self.Session() as db:
            lead = db.get(Lead, lead_id)
            lead.human_takeover = on
            if on:
                lead.next_followup_at = None
                self._log(db, lead, "takeover")
            else:
                if lead.stage == "handover":
                    lead.stage = "engaged"
                lead.followups_sent = 0
                self._schedule_followup(lead)
                self._log(db, lead, "released_to_ai")
            db.commit()

    # --------------------------------------------------------------- privacy
    def purge_old_messages(self) -> int:
        cutoff = self.now() - timedelta(days=self.s.retention_days)
        with self.Session() as db:
            n = db.execute(delete(Message).where(Message.created_at < cutoff)).rowcount
            db.commit()
            return n or 0

