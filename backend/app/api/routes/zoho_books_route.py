from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.coa_service import fetch_chart_of_accounts_cached

router = APIRouter(prefix="/zoho", tags=["zoho"])


@router.get("/chart-of-accounts")
def chart_of_accounts(db: Session = Depends(get_db)):
    _ = db  # reserved for org scoping
    return {"accounts": fetch_chart_of_accounts_cached()}
