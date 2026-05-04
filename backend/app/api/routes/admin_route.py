from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.db.seeds.mapping_profiles import seed_walmart_default_profile

router = APIRouter(prefix="/admin", tags=["admin"])


def _check_admin(x_admin_secret: str | None = Header(default=None)) -> None:
    secret = (get_settings().admin_secret or "").strip()
    if secret and x_admin_secret != secret:
        raise HTTPException(403, "Forbidden: invalid or missing X-Admin-Secret header")


@router.post("/seed-walmart-profile")
def seed_walmart(db: Session = Depends(get_db), _: None = Depends(_check_admin)):
    pid = seed_walmart_default_profile(db)
    return {"profile_id": str(pid)}
