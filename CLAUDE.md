# ANASA Command Center — instructions for Claude Code

Read this file first in every session. The full product requirements are in `docs/SPEC.md` (paste the master prompt there). Business rules already decided are in `docs/DECISIONS.md` and must not be changed without the user's approval.

## Working style
- Build one roadmap phase per session. Stop at the end of the phase and report: files changed, migrations added, tests run and their results, open issues, recommended next step.
- Never report untested work as done. Never claim a deployment or live database connection you did not verify.
- Never deploy to production or run migrations against the real Supabase project without explicit approval.

## Stack and conventions
- Next.js 15 App Router, TypeScript strict, Tailwind 4 tokens in `src/app/globals.css` (use `bg-surface`, `text-muted`, `border-line`, `bg-accent`, etc. — no raw hex in components).
- Data access: Server Components and Server Actions using `createClient()` from `src/lib/supabase/server.ts`. No Supabase calls from client components.
- Every Server Action: `requireCapability(...)` first, then Zod validation (`src/lib/validation`), then the database call. Return `ActionState`.
- Money: Postgres `NUMERIC`, `decimal.js` in TS (`src/lib/money.ts`), pass amounts as strings. Never use JS floats for money.
- Document numbers are shown with `<DocRef value=… />`.
- Pin exact dependency versions.

## Database rules
- New schema changes go in a new file `supabase/migrations/<timestamp>_<name>.sql`. Never edit an applied migration.
- Every new table: enable RLS, `revoke all … from anon, authenticated`, then grant only what is needed and add policies using `is_internal()`, `has_role()`, `can_view_costs()`. Supabase grants broad default privileges to new tables, so the revoke is mandatory.
- Numbered documents are created only by `SECURITY DEFINER` functions that use the counter tables (`next_document_number('REQ'|'SRFQ'|'SPO'|'SVC')` exists for global numbers). Never compute numbers in the app or from row counts.
- Approved/issued records are immutable; changes create a new revision or change order.
- Link records with foreign keys, never by matching document-number text.
- Add audit triggers (`audit_row()`) to every business table.
- Add database tests for new rules to `supabase/tests/` and run `npm run test:db`.

## Checks before finishing a phase
`npm run typecheck && npm test && npm run build && npm run test:db`

## Language (English / Spanish)
- Never hard-code screen text. Add the key to `en` in `src/lib/i18n/dictionaries.ts`, then the Spanish text to `es` (the build fails if it is missing).
- Server Components: `const { t } = await getT()` from `@/lib/i18n/server`. Client Components: `const t = useT()` from `@/lib/i18n/client`.
- New English messages returned by server actions or database exceptions need a Spanish entry in `src/lib/i18n/messages.ts`.
- Pass `t.localeTag` to `formatDate` and `formatMoney`.
- Forms submit with `useActionForm` (`@/lib/use-action-form`) so inputs are kept after a validation error; pass `pending` to `SubmitButton`.
