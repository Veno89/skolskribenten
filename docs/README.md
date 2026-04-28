# Documentation

Last updated: April 28, 2026.

This folder is the active documentation set for Skolskribenten. It intentionally excludes historical build prompts, completed phase logs, stale design notes, and one-off audit evidence that has already been folded back into the current docs.

## Active Docs

- `audit.md`: current production-readiness audit, remaining risks, and phased plan.
- `roadmap.md`: short operational roadmap.
- `billing-security.md`: Stripe, account entitlement, webhook, and billing reconciliation contract.
- `ai-governance.md`: AI request state model, streaming output guard, eval baseline, and AI operations.
- `operations.md`: support, planning sync, account lifecycle, data-rights, security-header, accessibility, and performance runbooks.

## Documentation Policy

- Keep implementation truth in code, migrations, and tests.
- Keep `audit.md` current when a risk is fixed, deferred, or newly discovered.
- Keep `roadmap.md` short; move detailed runbooks into `operations.md`, `billing-security.md`, or `ai-governance.md`.
- Do not keep completed phase work logs as active docs.
- Do not add archive prompts, speculative product briefs, or stale design snapshots to this folder.
- When a document stops describing the live app, update it or delete it.

## Generated Database Types

`types/database.ts` is generated from Supabase. Refresh it after schema changes with:

```bash
SUPABASE_PROJECT_ID=your-project-ref npm run db:types
```

For local or CI environments that use a direct database connection instead of a project ref:

```bash
SUPABASE_DB_URL=postgresql://... npm run db:types
```
