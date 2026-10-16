"""Database models: leads, conversation history, knowledge base and an event log."""
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import (Boolean, DateTime, ForeignKey, Integer, String, Text,
                        create_engine, event)
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


OPEN_STAGES = ["new", "engaged", "qualifying", "qualified", "meeting_requested"]
STAGES = OPEN_STAGES + ["handover", "won", "lost"]
LEAD_FIELDS = ["name", "company", "email", "project_type", "business_problem", "features",
               "platforms", "market", "budget", "timeline", "contact_preference"]


class Lead(Base):
    __tablename__ = "leads"
    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    profile_name: Mapped[str] = mapped_column(String(120), default="")
    # Requirements the assistant collects
    name: Mapped[str] = mapped_column(String(120), default="")
    company: Mapped[str] = mapped_column(String(160), default="")
    email: Mapped[str] = mapped_column(String(160), default="")
    project_type: Mapped[str] = mapped_column(String(160), default="")
    business_problem: Mapped[str] = mapped_column(Text, default="")
    features: Mapped[str] = mapped_column(Text, default="")
    platforms: Mapped[str] = mapped_column(String(160), default="")
    market: Mapped[str] = mapped_column(String(120), default="")
    budget: Mapped[str] = mapped_column(String(120), default="")
    timeline: Mapped[str] = mapped_column(String(120), default="")
    contact_preference: Mapped[str] = mapped_column(String(160), default="")
    # Pipeline
    service: Mapped[str] = mapped_column(String(60), default="")
    intent: Mapped[str] = mapped_column(String(40), default="")
    score: Mapped[str] = mapped_column(String(10), default="cold")
    stage: Mapped[str] = mapped_column(String(30), default="new", index=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    staff_notes: Mapped[str] = mapped_column(Text, default="")
    human_takeover: Mapped[bool] = mapped_column(Boolean, default=False)
    handover_reason: Mapped[str] = mapped_column(Text, default="")
    opted_out: Mapped[bool] = mapped_column(Boolean, default=False)
    sales_alerted: Mapped[bool] = mapped_column(Boolean, default=False)
    followups_sent: Mapped[int] = mapped_column(Integer, default=0)
    next_followup_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_inbound_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_outbound_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    messages: Mapped[list["Message"]] = relationship(back_populates="lead", order_by="Message.id",
                                                     cascade="all, delete-orphan")

    @property
    def display_name(self) -> str:
        return self.name or self.profile_name or f"+{self.phone}"


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), index=True)
    direction: Mapped[str] = mapped_column(String(3))             # in | out
    sender: Mapped[str] = mapped_column(String(10), default="")   # client | ai | staff | system
    kind: Mapped[str] = mapped_column(String(20), default="text")
    text: Mapped[str] = mapped_column(Text, default="")
    wa_id: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True)  # dedupe key
    status: Mapped[str] = mapped_column(String(20), default="")   # sent | delivered | read | failed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    lead: Mapped[Lead] = relationship(back_populates="messages")


class KnowledgeItem(Base):
    __tablename__ = "knowledge"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class EventLog(Base):
    """Alerts, hand-overs and errors, so staff can see what really happened."""
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(primary_key=True)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    type: Mapped[str] = mapped_column(String(40))
    detail: Mapped[str] = mapped_column(Text, default="")
    ok: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


def make_sessionmaker(url: str):
    if url in ("sqlite://", "sqlite:///:memory:"):        # tests: one shared in-memory database
        kwargs = {"connect_args": {"check_same_thread": False}, "poolclass": StaticPool}
    elif url.startswith("sqlite"):
        Path(url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)
        kwargs = {"connect_args": {"check_same_thread": False}}
    else:
        kwargs = {"pool_pre_ping": True}
    engine = create_engine(url, **kwargs)
    if url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def _fk(conn, _):
            conn.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    return sessionmaker(engine, expire_on_commit=False)


def aware(dt: datetime | None) -> datetime | None:
    """SQLite drops tz info; treat stored naive datetimes as UTC."""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt
