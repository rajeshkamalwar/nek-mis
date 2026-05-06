"""Rule-driven unified Zoho Books publisher (Books by Rudra v2)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import ZohoAPIException
from app.core.logging import get_logger
from app.db.models.mapping import MappingRule
from app.db.repositories import csv_row_repo, mapping_profile_repo, run_repo, zoho_repo

# publish_run return type carries per-run counters
from typing import TypedDict


class PublishResult(TypedDict):
    published: int
    failed: int
    zoho_status: str  # "published" | "partial" | "failed"
from app.zoho import client as zoho_client
from app.zoho.formula_eval import eval_formula

logger = get_logger(__name__)

EPS = 0.001


def passes_condition(canonical_row: dict, rule: MappingRule) -> bool:
    expr = rule.condition_expr
    if not expr:
        return True
    if not isinstance(expr, dict):
        return True
    field = expr.get("field")
    op = expr.get("op")
    value = expr.get("value")
    if field is None or op is None:
        return True
    raw = canonical_row.get(field)
    if raw is None:
        return False
    op_str = str(op).strip()
    try:
        rv, cv = float(raw), float(value)
        if op_str == "=":
            return rv == cv
        if op_str == "!=":
            return rv != cv
        if op_str == ">":
            return rv > cv
        if op_str == "<":
            return rv < cv
        if op_str == ">=":
            return rv >= cv
        if op_str == "<=":
            return rv <= cv
    except (ValueError, TypeError):
        sv = str(raw).strip()
        cv_s = str(value).strip() if value is not None else ""
        if op_str == "=":
            return sv == cv_s
        if op_str == "!=":
            return sv != cv_s
        if op_str == "contains":
            return cv_s in sv
    return True


def load_rules_for_run(db: Session, run_id: uuid.UUID, source_key: str) -> dict[str, MappingRule]:
    run = run_repo.get_run(db, run_id)
    if not run:
        raise ValueError("Run not found")
    profile = None
    if run.profile_id:
        profile = mapping_profile_repo.get_profile(db, run.profile_id)
    if not profile:
        profile = mapping_profile_repo.get_default_profile_for_source(db, source_key)
    if not profile:
        raise ValueError(f"No mapping profile for source_key={source_key!r}")
    return mapping_profile_repo.rules_as_dict(db, profile.id)


def _rule_account_name(rule: MappingRule) -> str | None:
    n = (rule.zoho_account_name or "").strip()
    return n if n else None


def _account_name_for_id(rules: dict[str, MappingRule], account_id: str) -> str | None:
    for rule in rules.values():
        if str(rule.zoho_account_id) == str(account_id):
            return _rule_account_name(rule)
    return None


def build_execution_plan(canonical_row: dict, rules: dict[str, MappingRule]) -> dict[str, Any]:
    plan: dict[str, Any] = {
        "invoice_lines": [],
        "journal_entries": [],
        "credit_note_lines": [],
        "payment": None,
    }
    for _key, rule in sorted(rules.items(), key=lambda x: (x[1].sort_order, x[0])):
        if rule.document_kind == "skip":
            continue
        raw_value = canonical_row.get(rule.canonical_key, 0)
        if not passes_condition(canonical_row, rule):
            continue
        try:
            value = eval_formula(raw_value, rule)
        except Exception as ex:
            logger.warning("Formula error key=%s: %s", rule.canonical_key, ex)
            continue
        if abs(value) < EPS:
            continue

        line = {
            "canonical_key": rule.canonical_key,
            "account_id": rule.zoho_account_id,
            "account_name": _rule_account_name(rule),
            "amount": abs(value),
            "signed_amount": value,
            "label": rule.label,
            "tax_rate": rule.tax_rate,
        }

        dk = rule.document_kind
        if dk in ("invoice_line", "tax_invoice_line"):
            plan["invoice_lines"].append({**line, "kind": dk})
        elif dk == "cn_line":
            plan["credit_note_lines"].append(line)
        elif dk in ("journal_debit", "journal_credit", "tax_journal"):
            side = (
                "debit"
                if dk == "journal_debit"
                else ("credit" if dk == "journal_credit" else "debit")
            )
            plan["journal_entries"].append({**line, "debit_or_credit": side})
        elif dk == "payment_amount":
            plan["payment"] = {
                "amount": abs(value),
                "account_id": rule.zoho_account_id,
                "account_name": _rule_account_name(rule),
            }
    return plan


def _journal_entries_balanced_display(
    journal_entries: list[dict], rules: dict[str, MappingRule]
) -> list[dict[str, Any]]:
    """Balanced journal lines (incl. clearing) with display names for dry-run UI."""
    if not journal_entries:
        return []
    balanced = _balance_journal_lines(journal_entries)
    out: list[dict[str, Any]] = []
    for entry in balanced:
        desc = str(entry.get("description") or "")
        acc_id = str(entry["account_id"])
        if desc == "Clearing":
            acc_name: str | None = "Clearing account"
        else:
            acc_name = _account_name_for_id(rules, acc_id)
        side = entry.get("debit_or_credit", "debit")
        out.append(
            {
                "account_id": acc_id,
                "account_name": acc_name,
                "label": desc,
                "amount": float(entry["amount"]),
                "debit_or_credit": side,
                "is_clearing_line": desc == "Clearing",
            }
        )
    return out


def _balance_journal_lines(jlines: list[dict]) -> list[dict]:
    """Return Zoho journal line_items: balanced debits/credits."""
    s = get_settings()
    clearing = (s.zoho_clearing_account_id or "").strip()
    debits = []
    credits = []
    for jl in jlines:
        amt = float(jl["amount"])
        side = jl.get("debit_or_credit", "debit")
        entry = {
            "account_id": jl["account_id"],
            "amount": amt,
            "description": jl.get("label", ""),
        }
        if side == "debit":
            debits.append({**entry, "debit_or_credit": "debit"})
        else:
            credits.append({**entry, "debit_or_credit": "credit"})
    sum_d = sum(float(x["amount"]) for x in debits)
    sum_c = sum(float(x["amount"]) for x in credits)
    diff = round(sum_d - sum_c, 4)
    if abs(diff) >= EPS and clearing:
        if diff > 0:
            credits.append(
                {"account_id": clearing, "amount": abs(diff), "debit_or_credit": "credit", "description": "Clearing"}
            )
        else:
            debits.append(
                {"account_id": clearing, "amount": abs(diff), "debit_or_credit": "debit", "description": "Clearing"}
            )
    return debits + credits


def build_invoice_payload(contact_id: str, lines: list[dict]) -> dict:
    line_items = []
    for li in lines:
        line_items.append(
            {
                "account_id": li["account_id"],
                "rate": float(li["amount"]),
                "quantity": 1,
                "description": li.get("label", li["canonical_key"])[:200],
            }
        )
    return {"customer_id": contact_id, "line_items": line_items}


def build_credit_note_payload(contact_id: str, lines: list[dict]) -> dict:
    line_items = []
    for li in lines:
        line_items.append(
            {
                "account_id": li["account_id"],
                "rate": float(li["amount"]),
                "quantity": 1,
                "description": li.get("label", "")[:200],
            }
        )
    return {"customer_id": contact_id, "line_items": line_items}


def build_journal_payload(lines: list[dict]) -> dict:
    balanced = _balance_journal_lines(lines)
    return {"line_items": balanced}


def _post_invoice(db: Session, row: dict, row_id: str, lines: list[dict], contact_id: str) -> str | None:
    if not lines:
        return None
    idem_key = f"invoice:{row_id}"
    existing = zoho_repo.get_by_idempotency_key(db, idem_key)
    if existing and existing.status == "success":
        return existing.zoho_entity_id
    rec = zoho_repo.create(
        db,
        {
            "csv_row_id": uuid.UUID(row_id),
            "zoho_entity_type": "invoice",
            "idempotency_key": idem_key,
            "status": "pending",
        },
    )
    try:
        payload = build_invoice_payload(contact_id, lines)
        resp = zoho_client.zoho_post("invoices", payload)
        inv_id = (resp.get("invoice") or {}).get("invoice_id") or ""
        zoho_repo.update_success(db, rec.id, inv_id, resp)
        return inv_id
    except ZohoAPIException as e:
        zoho_repo.update_failed(db, rec.id, str(e), 1)
        raise


def _post_credit_note(db: Session, row: dict, row_id: str, lines: list[dict], contact_id: str) -> str | None:
    if not lines:
        return None
    idem_key = f"creditnote:{row_id}"
    existing = zoho_repo.get_by_idempotency_key(db, idem_key)
    if existing and existing.status == "success":
        return existing.zoho_entity_id
    rec = zoho_repo.create(
        db,
        {
            "csv_row_id": uuid.UUID(row_id),
            "zoho_entity_type": "creditnote",
            "idempotency_key": idem_key,
            "status": "pending",
        },
    )
    try:
        payload = build_credit_note_payload(contact_id, lines)
        resp = zoho_client.zoho_post("creditnotes", payload)
        cn_id = (resp.get("creditnote") or {}).get("creditnote_id") or ""
        zoho_repo.update_success(db, rec.id, cn_id, resp)
        return cn_id
    except ZohoAPIException as e:
        zoho_repo.update_failed(db, rec.id, str(e), 1)
        raise


def _post_journal(db: Session, row: dict, row_id: str, lines: list[dict]) -> str | None:
    if not lines:
        return None
    idem_key = f"journal:{row_id}"
    existing = zoho_repo.get_by_idempotency_key(db, idem_key)
    if existing and existing.status == "success":
        return existing.zoho_entity_id
    rec = zoho_repo.create(
        db,
        {
            "csv_row_id": uuid.UUID(row_id),
            "zoho_entity_type": "journal",
            "idempotency_key": idem_key,
            "status": "pending",
        },
    )
    try:
        payload = build_journal_payload(lines)
        resp = zoho_client.zoho_post("journals", payload)
        j_id = (resp.get("journal") or {}).get("journal_id") or ""
        zoho_repo.update_success(db, rec.id, j_id, resp)
        return j_id
    except ZohoAPIException as e:
        zoho_repo.update_failed(db, rec.id, str(e), 1)
        raise


def _post_payment(
    db: Session, row: dict, row_id: str, payment: dict, invoice_id: str, contact_id: str
) -> None:
    idem_key = f"payment:{row_id}"
    existing = zoho_repo.get_by_idempotency_key(db, idem_key)
    if existing and existing.status == "success":
        return
    rec = zoho_repo.create(
        db,
        {
            "csv_row_id": uuid.UUID(row_id),
            "zoho_entity_type": "customerpayment",
            "idempotency_key": idem_key,
            "status": "pending",
        },
    )
    try:
        payload = {
            "customer_id": contact_id,
            "invoices": [{"invoice_id": invoice_id, "amount_applied": float(payment["amount"])}],
            "amount": float(payment["amount"]),
            "payment_mode": "others",
            "account_id": payment.get("account_id"),
        }
        resp = zoho_client.zoho_post("customerpayments", payload)
        p_id = (resp.get("payment") or {}).get("payment_id") or ""
        zoho_repo.update_success(db, rec.id, p_id, resp)
    except ZohoAPIException as e:
        zoho_repo.update_failed(db, rec.id, str(e), 1)
        raise


def publish_row(db: Session, row: dict, row_id: str, rules: dict[str, MappingRule], source_key: str) -> None:
    plan = build_execution_plan(row, rules)
    contact_id = zoho_client.get_or_create_contact(db, source_key)
    invoice_id = None

    if plan["invoice_lines"]:
        invoice_id = _post_invoice(db, row, row_id, plan["invoice_lines"], contact_id)
    if plan["credit_note_lines"]:
        _post_credit_note(db, row, row_id, plan["credit_note_lines"], contact_id)
    if plan["journal_entries"]:
        _post_journal(db, row, row_id, plan["journal_entries"])
    if plan["payment"] and invoice_id:
        _post_payment(db, row, row_id, plan["payment"], invoice_id, contact_id)


def publish_run(db: Session, run_id: uuid.UUID, source_key: str) -> PublishResult:
    rules = load_rules_for_run(db, run_id, source_key)
    rows = csv_row_repo.get_clean_rows(db, run_id)
    published = 0
    failed = 0
    for r in rows:
        data = r.mapped_data or {}
        try:
            publish_row(db, data, str(r.id), rules, source_key)
            published += 1
        except Exception as exc:
            failed += 1
            logger.error("publish_row failed run=%s row=%s: %s", run_id, r.id, exc)

    if failed == 0:
        zoho_status = "published"
    elif published == 0:
        zoho_status = "failed"
    else:
        zoho_status = "partial"

    run_repo.set_zoho_status(db, run_id, zoho_status, processed=published)
    return PublishResult(published=published, failed=failed, zoho_status=zoho_status)


def dry_run_plan_for_row(canonical_row: dict, rules: dict[str, MappingRule]) -> dict[str, Any]:
    """Return execution plan JSON without Zoho calls."""
    plan = build_execution_plan(canonical_row, rules)
    if plan["journal_entries"]:
        plan["journal_entries_balanced"] = _journal_entries_balanced_display(plan["journal_entries"], rules)
    return plan


def dry_run_run(db: Session, run_id: uuid.UUID, source_key: str, max_rows: int = 50) -> list[dict]:
    rules = load_rules_for_run(db, run_id, source_key)
    rows = csv_row_repo.get_clean_rows(db, run_id)[:max_rows]
    out = []
    for r in rows:
        data = r.mapped_data or {}
        plan = dry_run_plan_for_row(data, rules)
        oid = data.get("order_id")
        if oid is not None and not isinstance(oid, (str, int, float, bool)):
            oid = str(oid)
        out.append({"row_id": str(r.id), "order_id": oid, "plan": plan})
    return out
