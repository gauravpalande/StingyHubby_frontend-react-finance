import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { z } from 'zod';
import {
  enforceRateLimits,
  getClientFingerprint,
  RateLimitExceededError,
  RateLimitUnavailableError,
  type RateLimitRule,
} from './_lib/rateLimit';

const MAX_FINANCIAL_AMOUNT = 1_000_000_000_000;
const MAX_REQUEST_BYTES = 10_000;

const amountSchema = z.number().finite().min(-MAX_FINANCIAL_AMOUNT).max(MAX_FINANCIAL_AMOUNT);
const financialInputSchema = z.object({
  income: amountSchema,
  checking: amountSchema,
  emergency: amountSchema,
  health: amountSchema,
  retirement: amountSchema,
  creditCards: amountSchema,
  mortgage: amountSchema,
  carPayments: amountSchema,
  utilities: amountSchema,
}).strict();
const goalsInputSchema = z.object({
  emergency: amountSchema,
  retirement: amountSchema,
  health: amountSchema,
}).strict();
const suggestionRequestSchema = z.object({
  latest: financialInputSchema,
  goals: goalsInputSchema.nullish(),
}).strict();

type FinancialInput = z.infer<typeof financialInputSchema>;
type GoalsInput = z.infer<typeof goalsInputSchema>;

type SuggestionKey =
  | 'short_term_suggestion'
  | 'long_term_suggestion'
  | 'goal_suggestion'
  | 'oneline_suggestion';

type FinancialSuggestions = Record<SuggestionKey, string>;

type AuditEvent =
  | 'suggestions.validation_failed'
  | 'suggestions.model_fallback'
  | 'suggestions.generated'
  | 'suggestions.request_failed';

type AuditMetadata = Record<string, string | number | boolean | undefined>;

class ApiError extends Error {
  constructor(
    message: string,
    public statusCode = 500
  ) {
    super(message);
  }
}

const OPENAI_SUGGESTION_MODELS = ['gpt-5.6-luna', 'gpt-4.1-nano'] as const;
const MAX_SUGGESTION_OUTPUT_TOKENS = 500;

let openai: OpenAI | null = null;
let supabase: SupabaseClient | null = null;

function createRequestId(req: VercelRequest) {
  const vercelRequestId = req.headers['x-vercel-id'];
  const requestId = Array.isArray(vercelRequestId) ? vercelRequestId[0] : vercelRequestId;

  return requestId || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function writeAuditLog(event: AuditEvent, metadata: AuditMetadata = {}) {
  console.info(
    '[audit]',
    JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      ...metadata,
    })
  );
}

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new ApiError(
      'OPENAI_API_KEY is missing on the server. Add it to Vercel Environment Variables for Production, then redeploy.',
      500
    );
  }

  if (!openai) {
    openai = new OpenAI({ apiKey, maxRetries: 0, timeout: 20_000 });
  }

  return openai;
}

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new ApiError(
      'Supabase server credentials are missing. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Vercel, then redeploy.',
      500
    );
  }

  if (!supabase) {
    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  return supabase;
}

function getBearerToken(req: VercelRequest) {
  const header = req.headers.authorization;
  const authorization = Array.isArray(header) ? header[0] : header;
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  return match?.[1];
}

function readLimit(name: string, fallback: number) {
  const configured = Number(process.env[name]);
  return Number.isInteger(configured) && configured > 0 && configured <= 100_000
    ? configured
    : fallback;
}

function getRequestByteLength(req: VercelRequest) {
  const rawContentLength = Array.isArray(req.headers['content-length'])
    ? req.headers['content-length'][0]
    : req.headers['content-length'];
  const contentLength = Number(rawContentLength);
  const parsedLength = Buffer.byteLength(JSON.stringify(req.body ?? null), 'utf8');

  return Number.isFinite(contentLength)
    ? Math.max(contentLength, parsedLength)
    : parsedLength;
}

function buildSuggestionRateLimits(req: VercelRequest, userId: string): RateLimitRule[] {
  const fingerprint = getClientFingerprint(req);
  const rules: RateLimitRule[] = [
    {
      key: `suggestions:user:${userId}:hour`,
      limit: readLimit('OPENAI_USER_HOURLY_LIMIT', 5),
      windowSeconds: 60 * 60,
    },
    {
      key: `suggestions:user:${userId}:day`,
      limit: readLimit('OPENAI_USER_DAILY_LIMIT', 20),
      windowSeconds: 24 * 60 * 60,
    },
  ];

  if (fingerprint) {
    rules.push({
      key: `suggestions:ip:${fingerprint}:day`,
      limit: readLimit('OPENAI_IP_DAILY_LIMIT', 50),
      windowSeconds: 24 * 60 * 60,
    });
  }

  rules.push({
    key: 'suggestions:global:day',
    limit: readLimit('OPENAI_GLOBAL_DAILY_LIMIT', 200),
    windowSeconds: 24 * 60 * 60,
  });

  return rules;
}

async function requireAuthenticatedUser(req: VercelRequest) {
  const token = getBearerToken(req);

  if (!token) {
    throw new ApiError('You must be logged in to generate financial suggestions.', 401);
  }

  if (token.length > 4096 || token.split('.').length !== 3) {
    throw new ApiError('Your session expired. Sign in again to generate financial suggestions.', 401);
  }

  const {
    data: { user },
    error,
  } = await getSupabase().auth.getUser(token);

  if (error || !user) {
    throw new ApiError('Your session expired. Sign in again to generate financial suggestions.', 401);
  }

  return user;
}

function value(source: FinancialInput | GoalsInput | null | undefined, key: string) {
  return source?.[key] ?? 0;
}

function buildFinancialSummary(latest: FinancialInput, goals: GoalsInput | null | undefined) {
  return `
Financial data:
- Income: ${value(latest, 'income')}
- Checking: ${value(latest, 'checking')}
- Mortgage: ${value(latest, 'mortgage')}
- Car Payments: ${value(latest, 'carPayments')}
- Utilities: ${value(latest, 'utilities')}
- Emergency: ${value(latest, 'emergency')}
- Health: ${value(latest, 'health')}
- Retirement: ${value(latest, 'retirement')}
- Credit Cards: ${value(latest, 'creditCards')}
- Emergency Goal: ${value(goals, 'emergency')}
- Retirement Goal: ${value(goals, 'retirement')}
- Health Goal: ${value(goals, 'health')}
`.trim();
}

function buildPrompt(financialSummary: string) {
  return `
${financialSummary}

Create personalized financial suggestions for this user.
Use simple, user-friendly language.
Base advice on common United States personal finance guidance, including the income/spending priority flowchart concept: essentials first, high-interest debt, emergency savings, retirement, then longer-term goals.
Do not include disclaimers. Do not mention GPT or AI.

Return only valid JSON with exactly these string keys:
{
  "short_term_suggestion": "One detailed short-term, actionable financial suggestion.",
  "long_term_suggestion": "One detailed long-term, actionable financial suggestion.",
  "goal_suggestion": "One detailed, actionable suggestion about progress toward each goal. Focus only on goals.",
  "oneline_suggestion": "Exactly one concise sentence with the most important financial suggestion."
}
`.trim();
}

function getObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function isModelAccessError(error: unknown) {
  const openAIError = getObject(error);
  const status = openAIError.status;
  const code = openAIError.code;

  return status === 403 || status === 404 || code === 'model_not_found';
}

function getOpenAIErrorMessage(error: unknown, model: string) {
  const openAIError = getObject(error);
  const status = openAIError.status;
  const code = openAIError.code;
  const message = typeof openAIError.message === 'string' ? openAIError.message : '';

  if (status === 401) {
    return 'OpenAI rejected the server API key. Verify the Vercel variable is named exactly OPENAI_API_KEY, uses a valid OpenAI API key, is enabled for Production, and redeploy.';
  }

  if (status === 403) {
    return `OpenAI refused access to the configured model (${model}). Grant the project access to this model, then redeploy.`;
  }

  if (status === 404 || code === 'model_not_found') {
    return `OpenAI could not find or access the configured model (${model}). Grant the project access to this model, then redeploy.`;
  }

  if (status === 429) {
    return 'OpenAI rate limit or quota was reached. Check the OpenAI project billing, usage limits, and rate limits.';
  }

  if (message) {
    return `OpenAI request failed: ${message}`;
  }

  return 'Failed to generate financial suggestions. Check the Vercel function logs for /api/generate-suggestions.';
}

function requireSuggestion(parsed: Partial<FinancialSuggestions>, key: SuggestionKey) {
  const value = parsed[key];

  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(`OpenAI response was missing ${key}.`, 502);
  }

  return value.trim();
}

function parseSuggestions(raw: string): FinancialSuggestions {
  const withoutCodeFence = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  const parsed = JSON.parse(withoutCodeFence) as Partial<FinancialSuggestions>;

  return {
    short_term_suggestion: requireSuggestion(parsed, 'short_term_suggestion'),
    long_term_suggestion: requireSuggestion(parsed, 'long_term_suggestion'),
    goal_suggestion: requireSuggestion(parsed, 'goal_suggestion'),
    oneline_suggestion: requireSuggestion(parsed, 'oneline_suggestion'),
  };
}

async function generateSuggestions(financialSummary: string, requestId: string, userId: string) {
  for (const model of OPENAI_SUGGESTION_MODELS) {
    try {
      const response = await getOpenAI().responses.create({
        model,
        input: buildPrompt(financialSummary),
        max_output_tokens: MAX_SUGGESTION_OUTPUT_TOKENS,
      });

      return parseSuggestions(response.output_text);
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;

      const shouldTryNextModel = isModelAccessError(error) && model !== OPENAI_SUGGESTION_MODELS.at(-1);
      if (shouldTryNextModel) {
        writeAuditLog('suggestions.model_fallback', {
          requestId,
          userId,
          model,
          fallbackModel: OPENAI_SUGGESTION_MODELS[1],
          reason: getOpenAIErrorMessage(error, model),
        });
        continue;
      }

      throw new ApiError(getOpenAIErrorMessage(error, model), 502);
    }
  }

  throw new ApiError('Failed to generate financial suggestions. No OpenAI suggestion model was available.', 502);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = createRequestId(req);
  const startedAt = Date.now();

  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const contentType = Array.isArray(req.headers['content-type'])
    ? req.headers['content-type'][0]
    : req.headers['content-type'];
  if (!contentType?.toLowerCase().includes('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json.' });
  }

  if (getRequestByteLength(req) > MAX_REQUEST_BYTES) {
    return res.status(413).json({ error: 'Suggestion request is too large.' });
  }

  try {
    const user = await requireAuthenticatedUser(req);
    await enforceRateLimits(getSupabase(), buildSuggestionRateLimits(req, user.id));

    const parsedRequest = suggestionRequestSchema.safeParse(req.body);
    if (!parsedRequest.success) {
      writeAuditLog('suggestions.validation_failed', { requestId, userId: user.id, reason: 'invalid_financial_data', statusCode: 400 });
      return res.status(400).json({ error: 'Financial data must contain valid numeric values.' });
    }

    const { latest, goals } = parsedRequest.data;
    const suggestions = await generateSuggestions(buildFinancialSummary(latest, goals), requestId, user.id);

    writeAuditLog('suggestions.generated', {
      requestId,
      userId: user.id,
      durationMs: Date.now() - startedAt,
      statusCode: 200,
    });
    return res.status(200).json(suggestions);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = error instanceof ApiError
      ? error.statusCode
      : error instanceof RateLimitExceededError || error instanceof RateLimitUnavailableError
        ? error.statusCode
        : 500;

    if (error instanceof RateLimitExceededError) {
      res.setHeader('Retry-After', String(error.retryAfterSeconds));
    }

    if (statusCode >= 500) {
      console.error('[generate-suggestions] Error:', message);
      writeAuditLog('suggestions.request_failed', {
        requestId,
        durationMs: Date.now() - startedAt,
        statusCode,
        reason: message,
      });
    }
    return res.status(statusCode).json({ error: message });
  }
}
