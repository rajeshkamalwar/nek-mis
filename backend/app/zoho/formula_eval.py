"""Safe formula evaluation using simpleeval (server-side only)."""

from __future__ import annotations

from simpleeval import simple_eval

def apply_sign(value: float, sign_hint: str) -> float:
    sh = (sign_hint or "auto").lower()
    if sh == "positive":
        return abs(value)
    if sh == "negative":
        return -abs(value)
    return value


def eval_formula(raw_value, rule) -> float:
    base = 0.0
    try:
        if raw_value is None or raw_value == "":
            base = 0.0
        else:
            base = float(str(raw_value).replace(",", "").strip() or 0)
    except (TypeError, ValueError):
        base = 0.0

    if not rule.formula_expr or not str(rule.formula_expr).strip():
        return apply_sign(base, rule.sign_hint or "auto")

    ctx = {"value": base, "abs": abs, "round": round, "min": min, "max": max}
    out = simple_eval(str(rule.formula_expr), names=ctx)
    return float(out)


def validate_formula_syntax(expr: str | None) -> None:
    if not expr or not str(expr).strip():
        return
    simple_eval(str(expr), names={"value": 0.0, "abs": abs, "round": round, "min": min, "max": max})
