# ANASA Command Center

CRM, procurement, quotation, order and service management platform for ANASA.

**Status: Phase 1 (foundation).** This phase includes authentication and roles, customers (with permanent company codes), suppliers, and quotations. Quotations get company-specific numbering, Rev 00/01/02 revisions and approval locking. The database already contains the full quote → customer PO → sales order relationship, including transaction-safe conversion. The conversion screens arrive in Phase 6.

Stack: Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS) · Zod · decimal.js · Vitest · Vercel.

---

## 1. What you need

- A GitHub account
- A Supabase account (free tier is fine to start) — https://supabase.com
- A Vercel account linked to GitHub — https://vercel.com
- Node.js 20.18+ and npm, if you want to run it on your own computer
- Optional: the Supabase CLI (`npm i -g supabase`), to push migrations from the command line

## 2. Put the code on GitHub

```bash
unzip anasa-command-center.zip && cd anasa-command-center
git init
git add .
git commit -m "ANASA Command Center: Phase 1 foundation"
git branch -M main
# Create an EMPTY private repo on github.com first (no README), then:
git remote add origin https://github.com/<your-org>/anasa-command-center.git
git push -u origin main
```

Keep the repository **private**. The `.gitignore` already excludes `.env.local` and other secrets.

## 3. Create the Supabase project and database

1. In Supabase, create a new project. Pick the region closest to your users and save the database password.
2. Apply the three migrations in `supabase/migrations/` **in filename order**. Use one of these two methods.

   **Method A, the SQL Editor (no tools needed).** Open Supabase → SQL Editor → New query. Paste the contents of each file, run it, then do the next:
   - `20261110000001_foundation.sql`
   - `20261110000002_commercial_core.sql`
   - `20261110000003_security.sql`

   **Method B, the Supabase CLI:**
   ```bash
   supabase login
   supabase init            # creates supabase/config.toml; keep the existing migrations folder
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

   Do **not** run anything in `supabase/tests/` against your real project. Those scripts are for a throwaway local database.

3. Configure Auth: go to Supabase → Authentication → URL Configuration.
   - Site URL: your Vercel URL, e.g. `https://anasa-command-center.vercel.app`
   - Redirect URLs: add `https://<your-vercel-url>/auth/confirm` and `http://localhost:3000/auth/confirm`

4. Copy the API keys from Supabase → Project Settings → API:
   - Project URL
   - `anon` / publishable key. This key is safe in the browser because RLS protects every table.
   - Do **not** copy the `service_role` key into the app. Phase 1 does not use it.

## 4. Deploy on Vercel

1. In Vercel, select Add New → Project → import the GitHub repo. The framework is detected as Next.js.
2. Under Environment Variables, add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon / publishable key |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-vercel-url>` |

3. Deploy. If the variables are missing, the app shows a setup page instead of crashing.
4. Every later `git push` to `main` redeploys automatically. Pull requests get preview deployments.

## 5. First login: become the administrator

1. Open the deployed app and select **Create account**.
2. **The very first account created becomes Super Administrator.** Create yours before sharing the link.
3. Everyone who signs up afterwards starts as *Awaiting access* and can see nothing. Assign their role under **Administration**.
4. Recommended: once your team has accounts, go to Supabase → Authentication → Providers → Email and turn off "Allow new users to sign up". From then on, invite users from the Supabase dashboard.
5. Under **Administration → Settings**, confirm two things:
   - The business timezone, which decides the year in document numbers. The default is America/Chicago.
   - Whether self-approval of quotations is allowed. The default is allowed, so a one-person team isn't blocked.

## 6. Run locally

```bash
cp .env.example .env.local     # fill in the same three values
npm install
npm run dev                    # http://localhost:3000
```

## 7. Tests

| Command | What it checks |
|---|---|
| `npm test` | Pricing formulas (markup, margin, target margin < 100%, decimal safety) and customer-code suggestions |
| `npm run typecheck` | TypeScript strict mode |
| `npm run build` | Production build |
| `npm run test:db` | Runs every migration on a throwaway local PostgreSQL database, then runs the spec's Section 32 tests 1, 2, 3, 4, 5, 10 and 11 (concurrency) at database level |

`npm run test:db` needs `psql` and a local PostgreSQL 15+ that you can reach as a superuser:

```bash
PGURL=postgres://postgres:postgres@localhost:5432/postgres npm run test:db
```

GitHub Actions (`.github/workflows/ci.yml`) runs all four checks on every push and pull request.

## 8. Project layout

```
src/
  app/
    (app)/            signed-in area: dashboard, customers, suppliers, quotations, admin
    login/ pending/ setup/ auth/confirm/
  components/         UI kit, app shell, DocRef (document-number display)
  lib/
    supabase/         server + middleware clients
    auth.ts           current user, role guards for Server Actions
    permissions.ts    role → capability map (UI only; the DB enforces)
    money.ts          decimal-safe pricing formulas
    customer-code.ts  code suggestion
    validation/       Zod schemas
  middleware.ts       session refresh + redirect to login
supabase/
  migrations/         schema, functions, RLS (apply in order)
  tests/              local-only database tests
docs/DECISIONS.md     business rules chosen for numbering, approval, codes
CLAUDE.md             instructions for Claude Code when building later phases
```

## 9. Security model (summary)

- RLS is on for every table. Anonymous users have no table access.
- Numbered documents (quotations, sales orders) can **only** be created through database functions. Direct inserts are refused, so the numbering cannot be bypassed from the browser.
- Supplier costs live in `quotation_line_costs`. Only these roles can read them: Super Administrator, Director, Operations Manager, Procurement Manager, Sales Representative and Finance Manager.
- Approved revisions are locked by a trigger, which holds even for database administrators. Changes require a new revision.
- Customer codes can be changed only by a Super Administrator or a Director, and only with a reason. Every code ever issued stays reserved for the company it was issued to.
- Every change to customers, suppliers, quotations, revisions, lines, POs, orders, users and settings is written to `audit_logs`.

## 10. What's next

Phase 2 finishes customer and supplier management. After that, Phase 3 adds customer requests (`ANA-REQ-YYYY-NNNNN`) and the documents center with private Supabase Storage. See `CLAUDE.md` for how to continue with Claude Code.
