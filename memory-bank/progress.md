# Progress

**Implemented (initial drop):**

- Alembic initial migration (mapping + pipeline core + `profile_id` on runs).
- SQLAlchemy models, seed Walmart profile from `WALMART_LINE_DEFS`, admin seed endpoint.
- `unified_publisher` + dry-run helpers; Zoho client (HTTP); CoA cache with dev fallback.
- FastAPI routes: mapping profiles CRUD + rules, runs apply-profile/dry-run/publish, connectors canonical-keys.
- Celery task `publish_zoho_run` → `publish_run`.
- Frontend: Mapping Studio page, React Flow canvas, profile selector, rule sidebar, dry-run panel.

**Next:** Harden Zoho payload shapes against live Books API; wire real CSV ingest + `source_key` on runs; expand connectors; remove placeholders for production account IDs.
