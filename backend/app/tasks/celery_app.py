import importlib
import os

from celery import Celery


def _redis_url() -> str:
    if v := os.environ.get("REDIS_URL"):
        return v
    try:
        from app.core.config import get_settings
        return get_settings().redis_url
    except Exception:
        return "redis://localhost:6379/0"


_redis = _redis_url()
celery_app = Celery("zoho_mapping_studio", broker=_redis, backend=_redis)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# Import task module so worker registers tasks when using -A app.tasks.celery_app
importlib.import_module("app.tasks.publish_zoho")
