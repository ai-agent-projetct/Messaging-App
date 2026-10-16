import os
from dataclasses import dataclass, field


def _hours(raw: str) -> list[float]:
    return [float(x) for x in raw.split(",") if x.strip()]


def _range(raw: str) -> tuple[int, int] | None:
    if not raw.strip():
        return None
    start, end = raw.split("-")
    return int(start), int(end)


@dataclass
class Settings:
    whatsapp_token: str = ""
    phone_number_id: str = ""
    app_secret: str = ""
    verify_token: str = ""
    graph_version: str = "v23.0"
    ai_model: str = "claude-opus-5-5"
    ai_effort: str = "medium"
    database_url: str = "sqlite:///./data/ithrive.db"
    admin_user: str = "admin"
    admin_password: str = ""
    sales_whatsapp: str = ""
    n8n_webhook_url: str = ""
    followup_hours: list[float] = field(default_factory=lambda: [4, 22, 72])
    followup_template: str = ""
    template_language: str = "en"
    quiet_hours: tuple[int, int] | None = (21, 9)
    timezone: str = "Asia/Kolkata"
    retention_days: int = 365
    reply_delay_seconds: float = 4.0
    dry_run: bool = False

    @classmethod
    def from_env(cls) -> "Settings":
        e = os.environ.get
        return cls(
            whatsapp_token=e("WHATSAPP_TOKEN", ""),
            phone_number_id=e("WHATSAPP_PHONE_NUMBER_ID", ""),
            app_secret=e("WHATSAPP_APP_SECRET", ""),
            verify_token=e("WHATSAPP_VERIFY_TOKEN", ""),
            graph_version=e("GRAPH_API_VERSION", "v23.0"),
            ai_model=e("AI_MODEL", "claude-opus-5-5"),
            ai_effort=e("AI_EFFORT", "medium"),
            database_url=e("DATABASE_URL", "sqlite:///./data/ithrive.db"),
            admin_user=e("ADMIN_USER", "admin"),
            admin_password=e("ADMIN_PASSWORD", ""),
            sales_whatsapp=e("SALES_WHATSAPP", ""),
            n8n_webhook_url=e("N8N_WEBHOOK_URL", ""),
            followup_hours=_hours(e("FOLLOWUP_HOURS", "4,22,72")),
            followup_template=e("FOLLOWUP_TEMPLATE", ""),
            template_language=e("TEMPLATE_LANGUAGE", "en"),
            quiet_hours=_range(e("QUIET_HOURS", "21-9")),
            timezone=e("TIMEZONE", "Asia/Kolkata"),
            retention_days=int(e("DATA_RETENTION_DAYS", "365")),
            reply_delay_seconds=float(e("REPLY_DELAY_SECONDS", "4")),
            dry_run=e("DRY_RUN", "0") == "1",
        )

    def missing(self) -> list[str]:
        need = {
            "WHATSAPP_TOKEN": self.whatsapp_token,
            "WHATSAPP_PHONE_NUMBER_ID": self.phone_number_id,
            "WHATSAPP_APP_SECRET": self.app_secret,
            "WHATSAPP_VERIFY_TOKEN": self.verify_token,
            "ADMIN_PASSWORD": self.admin_password,
        }
        return [k for k, v in need.items() if not v]
