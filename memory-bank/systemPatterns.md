# System patterns

- **DB:** `mapping_profiles`, `mapping_rules`; runs reference `profile_id`; rules keyed by `canonical_key` per profile.
- **Publisher:** `app/zoho/unified_publisher.py` loads rules, `build_execution_plan`, idempotent `zoho_repo` per entity POST.
- **Formulas:** `simpleeval` only, server-side (`formula_eval.py`).
- **API:** `/api/mapping-profiles`, `/api/runs/.../apply-profile`, `/api/runs/.../dry-run`, `/api/zoho/chart-of-accounts`.
- **Frontend:** React Flow edges = rules; connect → POST upsert rule; sidebar edits rule + dry-run JSON.
