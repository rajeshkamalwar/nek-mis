# Product context

Non-developers configure **mapping rules** in a visual studio: canonical marketplace numeric keys connect to Zoho chart-of-accounts lines with a **document kind** (invoice line, journal debit/credit, payment, skip) and optional **formula** (`simpleeval` on server).

Successful flows: choose profile → edit graph → dry-run per pipeline run → Celery publish with idempotent Zoho posts.
