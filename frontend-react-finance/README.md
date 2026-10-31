# React + TypeScript + Vite

## Pull-request verification

`.github/workflows/ci.yml` runs the existing regression tests and production build
for every pull request targeting `main`, every push to `main`, and manual runs.
It uses Node 24 from `.nvmrc` and the committed npm lockfile. There are no path
filters, so documentation-only pull requests also receive a check result.

To reproduce the checks locally from `frontend-react-finance` with Node 24:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run build
```

The tests mock external dependencies; no Supabase, OpenAI, Gmail, Stripe, or
Vercel credentials are supplied to CI. The build also compiles the email
template and runs `tsc --noEmit`. These checks do not exercise a live database,
send real email, or deploy the application. Vercel preview status is a separate
check and must still be reviewed before merging.

The workflow has read-only repository permissions, does not persist checkout
credentials, pins actions to commit SHAs, and skips dependency install scripts.
Its npm download cache is keyed by the lockfile. Superseded runs are cancelled
and each job is limited to ten minutes. Review upstream releases before updating
the pinned action SHAs.

CI reports failures but does not itself prevent merging. After the first
successful run, a repository administrator can require the check
`Tests and build (Node 24)` in the `main` branch rules. Branch rules are not
changed by this workflow. A failing PR must not be merged; revert the workflow
commit if the workflow itself needs to be removed.

`npm run lint` is not part of this initial CI check: the unchanged baseline on
2026-10-31 has five errors and two warnings. Those existing findings need a
separate cleanup before lint can be required; no lint rules are disabled here.

## OpenAI API cost setting

The app generates financial suggestions in `api/generate-suggestions.ts` with OpenAI's Responses API.

- Primary model used: `gpt-5.6-luna`
- Fallback model: `gpt-4.1-nano`, used only if the OpenAI project cannot access `gpt-5.6-luna`
- Why: OpenAI Docs list GPT-5.6 Luna as the GPT-5.6 model optimized for cost-sensitive workloads and the lowest-priced general text model in the GPT-5.6 family. The fallback keeps production working for OpenAI projects that do not yet have access to that model.
- Vercel environment variable required: `OPENAI_API_KEY`
- Vercel environment variable no longer needed: `OPENAI_MODEL`

After deploying, remove any `OPENAI_MODEL` variable from Vercel to avoid confusion. The app now pins the suggestion endpoint to the low-cost model list in code.

## API security for suggestions

The `/api/generate-suggestions` endpoint requires a Supabase access token before it calls OpenAI. This protects the paid OpenAI API key from unauthenticated browser requests.

- Frontend: `FinanceForm` reads the current Supabase session before generating suggestions.
- Request: `generateFinancialSuggestions` sends `Authorization: Bearer <access_token>`.
- Backend: `api/generate-suggestions.ts` validates the token with Supabase Auth.
- Required Vercel environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY`.

## Cost-abuse protection

Paid and resource-intensive operations are protected on the server and in PostgreSQL rather than relying on hidden or disabled browser controls.

- OpenAI suggestion requests require a valid Supabase session, strict numeric financial data, an `application/json` body no larger than 10 KB, and database-backed limits. Defaults are 5 requests per user per hour, 20 per user per day, 50 per IP fingerprint per day, and 200 total requests per day.
- OpenAI output is capped at 500 tokens. Automatic SDK retries are disabled so one application request cannot silently multiply into several paid requests.
- Weekly and monthly digest routes require Vercel's `Authorization: Bearer <CRON_SECRET>` header. Per-user database claims block concurrent or repeated sends for the same reporting period. Gmail delivery with an uncertain outcome remains claimed for manual review instead of automatically retrying. Each run processes at most 100 recipients by default.
- Stripe billing-portal requests require a valid Supabase access token, use the authenticated user's Stripe customer, and are rate-limited.
- CSV imports are limited to 1 MB and 250 rows in the browser. PostgreSQL independently limits authenticated users to 500 new finance records and 20 feedback records per day, validates ownership, and rejects oversized values or text.
- History screens fetch at most 1,000 records, monthly reports process at most 100 records per user, and external chart requests time out after 8 seconds.

Apply `supabase/migrations/20260923000000_add_cost_abuse_protection.sql` before deploying these API changes:

```bash
npx supabase db push
```

Add a random `CRON_SECRET` of at least 16 characters to the Vercel Production environment before deploying. Vercel automatically sends it to configured cron routes. The OpenAI limits can optionally be adjusted with `OPENAI_USER_HOURLY_LIMIT`, `OPENAI_USER_DAILY_LIMIT`, `OPENAI_IP_DAILY_LIMIT`, and `OPENAI_GLOBAL_DAILY_LIMIT`. `DIGEST_RECIPIENT_LIMIT` can adjust the per-run email cap from 1 to 1,000; its safe default is 100.

## Gmail digest delivery

Weekly and monthly jobs send through Gmail SMTP as **PennyWize <gapisgod@gmail.com>**. The website can remain at `https://pennywize.vercel.app`; no custom email domain or Resend account is required. Both the authenticated Google account and the From address are fixed to the requested Gmail account.

### Setup

1. Sign into `gapisgod@gmail.com` and enable Google 2-Step Verification.
2. Open [Google App Passwords](https://myaccount.google.com/apppasswords), create an App Password named **PennyWize**, and copy it directly to Vercel **Settings → Environment Variables** as `GMAIL_APP_PASSWORD`. Use an App Password, not your normal Google password. Do not put it in source code or chat.
3. Set the variable for **Production** and, if testing a preview, **Preview**. Google displays the 16-character password in groups; the server accepts it with or without the spaces. No `GMAIL_USER` or `DIGEST_FROM_EMAIL` setting is needed.
4. Keep `CRON_SECRET` (at least 16 characters), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the existing delivery-tracking database migration. Weekly unsubscribe links also need `UNSUBSCRIBE_SIGNING_SECRET` (at least 32 characters).
5. Deploy this updated source after saving the variable. Vercel environment changes only affect new deployments. `RESEND_API_KEY` is no longer used by either job, and the Resend dependency has been removed.

Google may not offer App Passwords for accounts with certain security policies; if the App Passwords page is unavailable, the integration needs Google OAuth authorization instead. Gmail also enforces sending limits; use this setup for a small opted-in mailing list. The existing recipient limit defaults to 100 per job.

### Verify and run

All requests need the `Authorization: Bearer <CRON_SECRET>` header:

- `GET /api/send-digest?dryRun=1` or `/api/send-monthly-report?dryRun=1`: check cron authentication only; no Gmail connection, database access, or email sends.
- `GET /api/send-digest?verify=1` or `/api/send-monthly-report?verify=1`: authenticate to Gmail and verify its SMTP connection, then return without database access or sending email. This confirms credentials/connectivity, not inbox delivery.
- `GET /api/send-digest` or `/api/send-monthly-report`: verify Gmail, select opted-in recipients, and send their reports. The existing Vercel schedules remain unchanged. Vercel **Settings → Cron Jobs → Run** executes this real delivery path.

Missing or malformed credentials return HTTP 503 before creating delivery claims. A Gmail authentication/connection failure also stops the job before database work. SMTP uses TLS on port 465 with bounded connection and socket inactivity timeouts, and every send is awaited before the function responds.

### Delivery results and retries

The response reports `sent`, `failed`, `deliveryUncertain`, and `duplicatesSkipped`. `sent` means Gmail accepted the message for delivery; it does not guarantee inbox delivery. Email logs store `provider: gmail` and the message ID. HTML, CSV/PDF attachments, and the weekly unsubscribe link are preserved.

SMTP has no provider idempotency key. A timeout or disconnect after submission may mean Gmail accepted the message even though the server did not receive confirmation. Those attempts remain `running` with `last_error: delivery_outcome_unknown`; the existing weekly eight-day and monthly 32-day claim leases prevent automatic repeats during the same reporting period. Review Gmail's Sent folder before deciding how to recover an uncertain delivery. A stable Message-ID helps trace the message but does not guarantee deduplication.

Failures before submission and explicit Gmail rejection remain retryable. Once Gmail confirms acceptance, a later database/logging error never marks the delivery as retryable. App-password values, raw SMTP responses, and message contents are not logged by the mailer.

## Free feature access

All PennyWize features are available to every authenticated user without a paid subscription. This includes detailed AI suggestions, goal progress, financial-history editing, CSV import/export, PDF export, feedback, monthly reports, and CSV/PDF digest attachments.

New Stripe checkout sessions are disabled. The billing portal remains available to users with an existing active subscription so they can review or cancel it.

## Audit logging

The `/api/generate-suggestions` endpoint writes structured audit events to Vercel function logs for bounded, meaningful events such as validation failures, model fallback, server failures, and successful suggestion generation. Expected authentication and rate-limit rejections are not logged individually so an attacker cannot create an unbounded log-ingestion bill.

Financial input values are not written to audit logs.

## Database indexing

The app includes a Supabase/PostgreSQL migration at `supabase/migrations/20260814000000_add_core_query_indexes.sql` for the highest-traffic query patterns.

Apply it with:

```bash
supabase db push
```

The migration adds indexes for finance history lookups, preference reads, digest recipient discovery, goal reads, and Stripe customer lookups.

## Query optimization

Client-side Supabase reads use explicit column projections for the finance, goals, and preferences screens. Single-record reads use `maybeSingle()` where missing rows are valid, which avoids one-row arrays and prevents "no row" responses from being treated as exceptional.

## ETL CSV import

All authenticated users can import financial history from CSV on the Financial History page. The client-side pipeline extracts CSV rows, transforms headers, dates, and numeric values into normalized finance records, validates malformed data, and loads valid rows into Supabase.

## Reporting dashboard

The app includes a Financial Dashboard that combines recent finance submissions, goals, expense totals, cash-flow trends, savings buckets, and the latest AI suggestion into a single reporting view. The dashboard helps users quickly understand their current financial health and highlights the next practical action based on their latest data.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```
