# React + TypeScript + Vite

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
- Weekly and monthly digest routes require Vercel's `Authorization: Bearer <CRON_SECRET>` header. Per-user delivery claims and Resend idempotency keys prevent duplicate cron invocations from sending duplicate paid emails. Each run processes at most 100 recipients by default.
- Stripe billing-portal requests require a valid Supabase access token, use the authenticated user's Stripe customer, and are rate-limited.
- CSV imports are limited to 1 MB and 250 rows in the browser. PostgreSQL independently limits authenticated users to 500 new finance records and 20 feedback records per day, validates ownership, and rejects oversized values or text.
- History screens fetch at most 1,000 records, monthly reports process at most 100 records per user, and external chart requests time out after 8 seconds.

Apply `supabase/migrations/20260923000000_add_cost_abuse_protection.sql` before deploying these API changes:

```bash
npx supabase db push
```

Add a random `CRON_SECRET` of at least 16 characters to the Vercel Production environment before deploying. Vercel automatically sends it to configured cron routes. The OpenAI limits can optionally be adjusted with `OPENAI_USER_HOURLY_LIMIT`, `OPENAI_USER_DAILY_LIMIT`, `OPENAI_IP_DAILY_LIMIT`, and `OPENAI_GLOBAL_DAILY_LIMIT`. `DIGEST_RECIPIENT_LIMIT` can adjust the per-run email cap from 1 to 1,000; its safe default is 100.

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
