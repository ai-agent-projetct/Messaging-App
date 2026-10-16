"""FastAPI app: WhatsApp webhook, admin dashboard and background scheduler."""
import asyncio
import csv
import io
import json
import logging
import secrets
from collections import Counter
from contextlib import asynccontextmanager
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, PlainTextResponse, RedirectResponse, Response
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.templating import Jinja2Templates
from sqlalchemy import desc, func, or_, select

from .ai import Assistant
from .config import Settings
from .db import LEAD_FIELDS, STAGES, EventLog, KnowledgeItem, Lead, aware, make_sessionmaker
from .notify import Notifier
from .service import Engine
from .whatsapp import WhatsAppClient, parse_webhook, verify_signature

log = logging.getLogger("ithrive")
templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))


def _ist(dt) -> str:
    return aware(dt).astimezone(ZoneInfo("Asia/Kolkata")).strftime("%d %b %H:%M") if dt else "-"


templates.env.filters["ist"] = _ist


def build_engine(settings: Settings) -> Engine:
    Session = make_sessionmaker(settings.database_url)
    wa = WhatsAppClient(settings.whatsapp_token, settings.phone_number_id, settings.graph_version, settings.dry_run)
    return Engine(Session, wa, Assistant(settings.ai_model, settings.ai_effort),
                  Notifier(wa, settings.sales_whatsapp, settings.n8n_webhook_url), settings)


def create_app(settings: Settings | None = None, engine: Engine | None = None, scheduler: bool = True) -> FastAPI:
    settings = settings or Settings.from_env()
    engine = engine or build_engine(settings)
    engine.seed_knowledge()

    async def tick():
        n = 0
        while True:
            try:
                await engine.run_followups()
                if n % 1440 == 0:
                    engine.purge_old_messages()
            except Exception:  # noqa: BLE001
                log.exception("scheduler tick failed")
            n += 1
            await asyncio.sleep(60)

    @asynccontextmanager
    async def lifespan(_app):
        task = asyncio.create_task(tick()) if scheduler else None
        yield
        if task:
            task.cancel()

    app = FastAPI(title="iThrive WhatsApp Assistant", lifespan=lifespan)
    app.state.engine = engine
    security = HTTPBasic()

    def admin(creds: HTTPBasicCredentials = Depends(security)) -> str:
        ok = bool(settings.admin_password) and secrets.compare_digest(creds.username, settings.admin_user) \
            and secrets.compare_digest(creds.password, settings.admin_password)
        if not ok:
            raise HTTPException(401, "Unauthorized", headers={"WWW-Authenticate": "Basic"})
        return creds.username

    # ------------------------------------------------------------ webhook
    @app.get("/webhook")
    async def verify(request: Request):
        q = request.query_params
        if q.get("hub.mode") == "subscribe" and settings.verify_token and \
                secrets.compare_digest(q.get("hub.verify_token", ""), settings.verify_token):
            return PlainTextResponse(q.get("hub.challenge", ""))
        raise HTTPException(403, "Verification failed")

    @app.post("/webhook")
    async def webhook(request: Request):
        body = await request.body()
        if not verify_signature(settings.app_secret, body, request.headers.get("x-hub-signature-256")):
            raise HTTPException(401, "Invalid signature")
        messages, statuses = parse_webhook(json.loads(body or b"{}"))
        for st in statuses:
            engine.update_status(st)
        for msg in messages:
            engine.receive(msg)          # replies run in the background; Meta needs a fast 200
        return {"ok": True}

    @app.get("/health")
    async def health():
        return {"ok": True}

    # ---------------------------------------------------------- dashboard
    @app.get("/admin", response_class=HTMLResponse)
    async def dashboard(request: Request, stage: str = "", score: str = "", q: str = "", _=Depends(admin)):
        with engine.Session() as db:
            stmt = select(Lead).order_by(desc(Lead.human_takeover), desc(Lead.updated_at))
            if stage:
                stmt = stmt.where(Lead.stage == stage)
            if score:
                stmt = stmt.where(Lead.score == score)
            if q:
                like = f"%{q}%"
                stmt = stmt.where(or_(Lead.phone.like(like), Lead.name.like(like), Lead.company.like(like),
                                      Lead.profile_name.like(like), Lead.project_type.like(like)))
            leads = db.scalars(stmt.limit(500)).all()
            stages = Counter(dict(db.execute(select(Lead.stage, func.count()).group_by(Lead.stage)).all()))
            scores = Counter(dict(db.execute(select(Lead.score, func.count()).group_by(Lead.score)).all()))
            waiting = db.scalar(select(func.count()).select_from(Lead).where(Lead.human_takeover)) or 0
            total = sum(stages.values())
            response = _avg_first_response(db)
            events = db.scalars(select(EventLog).order_by(desc(EventLog.id)).limit(15)).all()
            names = {lead.id: lead.display_name for lead in db.scalars(select(Lead).where(
                Lead.id.in_({e.lead_id for e in events if e.lead_id})))}
        return templates.TemplateResponse(request, "dashboard.html", dict(
            leads=leads, stages=stages, scores=scores, waiting=waiting, total=total, all_stages=STAGES,
            response=response, events=events, names=names, f_stage=stage, f_score=score, q=q))

    @app.get("/admin/leads/{lead_id}", response_class=HTMLResponse)
    async def lead_page(request: Request, lead_id: int, _=Depends(admin)):
        with engine.Session() as db:
            lead = db.get(Lead, lead_id) or _404()
            messages = list(lead.messages)
            events = db.scalars(select(EventLog).where(EventLog.lead_id == lead_id).order_by(desc(EventLog.id)).limit(20)).all()
        return templates.TemplateResponse(request, "lead.html", dict(
            lead=lead, messages=messages, events=events, fields=LEAD_FIELDS, all_stages=STAGES))

    @app.post("/admin/leads/{lead_id}/send")
    async def lead_send(lead_id: int, text: str = Form(...), _=Depends(admin)):
        if text.strip():
            await engine.staff_send(lead_id, text.strip())
        return RedirectResponse(f"/admin/leads/{lead_id}", 303)

    @app.post("/admin/leads/{lead_id}/takeover")
    async def lead_takeover(lead_id: int, on: str = Form(...), _=Depends(admin)):
        engine.set_takeover(lead_id, on == "1")
        return RedirectResponse(f"/admin/leads/{lead_id}", 303)

    @app.post("/admin/leads/{lead_id}/update")
    async def lead_update(lead_id: int, request: Request, _=Depends(admin)):
        form = await request.form()
        with engine.Session() as db:
            lead = db.get(Lead, lead_id) or _404()
            for f in LEAD_FIELDS + ["staff_notes"]:
                if f in form:
                    setattr(lead, f, str(form[f]).strip())
            if form.get("stage") in STAGES:
                lead.stage = str(form["stage"])
                if lead.stage in ("won", "lost"):
                    lead.next_followup_at = None
            if form.get("score") in ("hot", "warm", "cold"):
                lead.score = str(form["score"])
            db.commit()
        return RedirectResponse(f"/admin/leads/{lead_id}", 303)

    @app.get("/admin/knowledge", response_class=HTMLResponse)
    async def knowledge_page(request: Request, _=Depends(admin)):
        with engine.Session() as db:
            items = db.scalars(select(KnowledgeItem).order_by(KnowledgeItem.id)).all()
        return templates.TemplateResponse(request, "knowledge.html", dict(items=items))

    @app.post("/admin/knowledge")
    async def knowledge_save(item_id: int = Form(0), title: str = Form(...), content: str = Form(...),
                             enabled: str = Form(""), action: str = Form("save"), _=Depends(admin)):
        with engine.Session() as db:
            item = db.get(KnowledgeItem, item_id) if item_id else None
            if action == "delete" and item:
                db.delete(item)
            else:
                item = item or KnowledgeItem()
                item.title, item.content, item.enabled = title.strip(), content.strip(), enabled == "1" or not item_id
                db.add(item)
            db.commit()
        return RedirectResponse("/admin/knowledge", 303)

    @app.get("/admin/export.csv")
    async def export(_=Depends(admin)):
        cols = ["id", "phone", "profile_name", *LEAD_FIELDS, "service", "score", "stage", "summary",
                "staff_notes", "created_at", "updated_at"]
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(cols)
        with engine.Session() as db:
            for lead in db.scalars(select(Lead).order_by(Lead.id)):
                w.writerow([getattr(lead, c) for c in cols])
        return Response(buf.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": "attachment; filename=ithrive-leads.csv"})

    return app


def _404():
    raise HTTPException(404, "Not found")


def _avg_first_response(db) -> str:
    """Average time from a client's first message to our first reply, over the last 200 leads."""
    gaps = []
    for lead in db.scalars(select(Lead).order_by(desc(Lead.id)).limit(200)):
        first_in = next((m for m in lead.messages if m.direction == "in"), None)
        first_out = next((m for m in lead.messages if m.direction == "out" and first_in and m.id > first_in.id), None)
        if first_in and first_out:
            gaps.append((aware(first_out.created_at) - aware(first_in.created_at)).total_seconds())
    if not gaps:
        return "-"
    avg = sum(gaps) / len(gaps)
    return f"{avg:.0f}s" if avg < 120 else f"{avg / 60:.0f} min"


def run() -> FastAPI:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    settings = Settings.from_env()
    missing = settings.missing()
    if missing and not settings.dry_run:
        raise SystemExit(f"Missing settings: {', '.join(missing)} (see .env.example)")
    return create_app(settings)
