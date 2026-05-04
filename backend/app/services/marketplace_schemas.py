"""CSV column → canonical key maps per marketplace (v1 hardcoded)."""

from __future__ import annotations

WALMART_SCHEMA: dict[str, str] = {
    "Product price": "line_amount",
    "Line Shipping Charge": "line_shipping_charge",
    "Line Fee": "line_fee",
    "Line Tax": "line_tax",
    "PST/QST Remit by Walmart": "pst_qst_walmart",
    "GST/HST Remit by Walmart": "gst_hst_walmart",
    "Referral Amount on Item": "referral_amount_on_item",
    "Referral Amount on shipping": "referral_amount_on_shipping",
    "Referral Tax Amount": "referral_tax_amount",
    "WFS Fee Amount": "wfs_fee",
    "WFS PST/QST": "wfs_pst_qst",
    "WFS GST/HST": "wfs_gst_hst",
    "Payable To Partner": "payable_to_partner",
    "Sales Order ID": "order_id",
    "Transaction Date": "transaction_date",
}

AMAZON_CA_SCHEMA: dict[str, str] = {
    "product sales": "product_sales",
    "product sales tax": "product_sales_tax",
    "shipping credits": "shipping_credits",
    "shipping credits tax": "shipping_credits_tax",
    "gift wrap credits": "gift_wrap_credits",
    "giftwrap credits tax": "giftwrap_credits_tax",
    "regulatory fee": "regulatory_fee",
    "tax on regulatory fee": "tax_on_regulatory_fee",
    "promotional rebates": "promotional_rebates",
    "promotional rebates tax": "promotional_rebates_tax",
    "marketplace withheld tax": "marketplace_withheld_tax",
    "selling fees": "selling_fees",
    "fba fees": "fba_fees",
    "other transaction fees": "other_transaction_fees",
    "other": "other",
    "total": "total",
    "order id": "order_id",
    "date/time": "settlement_date",
    "settlement id": "settlement_id",
}

ONBUY_SCHEMA: dict[str, str] = {
    "sale": "sale_amount",
    "commission": "commission",
    "boost fee": "boost_fee",
    "delivery charge": "delivery_charge",
    "cashback": "cashback",
    "refund": "refund_amount",
    "order id": "order_id",
    "date": "transaction_date",
    "total": "total",
}

AMAZON_USA_SCHEMA: dict[str, str] = {
    "product sales": "product_sales",
    "product sales tax": "product_sales_tax",
    "shipping credits": "shipping_credits",
    "shipping credits tax": "shipping_credits_tax",
    "gift wrap credits": "gift_wrap_credits",
    "giftwrap credits tax": "giftwrap_credits_tax",
    "regulatory fee": "regulatory_fee",
    "tax on regulatory fee": "tax_on_regulatory_fee",
    "promotional rebates": "promotional_rebates",
    "promotional rebates tax": "promotional_rebates_tax",
    "marketplace withheld tax": "marketplace_withheld_tax",
    "selling fees": "selling_fees",
    "fba fees": "fba_fees",
    "other transaction fees": "other_transaction_fees",
    "other": "other",
    "total": "total",
    "order id": "order_id",
    "date/time": "settlement_date",
    "settlement id": "settlement_id",
}

# Normalized CSV header (strip + casefold) → canonical key
_SCHEMA_LOOKUP: dict[str, dict[str, str]] = {}
_SOURCE_ALIASES: dict[str, str] = {
    "amazon_us": "amazon_usa",
    "amazon_canada": "amazon_ca",
}


def _build_lookup(schema: dict[str, str]) -> dict[str, str]:
    return {k.strip().casefold(): v for k, v in schema.items()}


def normalize_source_key(source_key: str) -> str:
    sk = source_key.lower().strip().replace("-", "_")
    return _SOURCE_ALIASES.get(sk, sk)


SCHEMA_BY_SOURCE: dict[str, dict[str, str]] = {
    "walmart": WALMART_SCHEMA,
    "amazon_usa": AMAZON_USA_SCHEMA,
    "amazon_ca": AMAZON_CA_SCHEMA,
    "onbuy": ONBUY_SCHEMA,
}

for _sk, _schema in SCHEMA_BY_SOURCE.items():
    _SCHEMA_LOOKUP[_sk] = _build_lookup(_schema)


def get_schema_map(source_key: str) -> dict[str, str] | None:
    sk = normalize_source_key(source_key)
    return SCHEMA_BY_SOURCE.get(sk)


def canonical_keys_for_source(source_key: str) -> list[str]:
    schema = get_schema_map(source_key)
    if not schema:
        return []
    return sorted(set(schema.values()))


def map_header_to_canonical(source_key: str, header: str) -> str | None:
    sk = normalize_source_key(source_key)
    lookup = _SCHEMA_LOOKUP.get(sk)
    if not lookup:
        return None
    return lookup.get(header.strip().casefold())
