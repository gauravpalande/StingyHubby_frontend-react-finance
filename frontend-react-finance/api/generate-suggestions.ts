import { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

type SuggestionValue = number | string | null | undefined;
type FinancialInput = Record<string, SuggestionValue>;

type SuggestionRequest = {
  latest?: FinancialInput;
  goals?: FinancialInput | null;
};

type SuggestionKey =
  | 'short_term_suggestion'
  | 'long_term_suggestion'
  | 'goal_suggestion'
  | 'oneline_suggestion';

type FinancialSuggestions = Record<SuggestionKey, string>;

class ApiError extends Error {
  constructor(
    message: string,
    public statusCode = 500
  ) {
    super(message);
  }
}

const OPENAI_SUGGESTION_MODELS = ['gpt-5.6-luna', 'gpt-4.1-nano'] as const;
const MAX_SUGGESTION_OUTPUT_TOKENS = 800;

let openai: OpenAI | null = null;

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new ApiError(
      'OPENAI_API_KEY is missing on the server. Add it to Vercel Environment Variables for Production, then redeploy.',
      500
    );
  }

  if (!openai) {
    openai = new OpenAI({ apiKey });
  }

  return openai;
}

function value(source: FinancialInput | null | undefined, key: string) {
  return source?.[key] ?? 0;
}

function buildFinancialSummary(latest: FinancialInput, goals: FinancialInput | null | undefined) {
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

async function generateSuggestions(financialSummary: string) {
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
        console.warn(`[generate-suggestions] Falling back from ${model}:`, getOpenAIErrorMessage(error, model));
        continue;
      }

      throw new ApiError(getOpenAIErrorMessage(error, model), 502);
    }
  }

  throw new ApiError('Failed to generate financial suggestions. No OpenAI suggestion model was available.', 502);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { latest, goals } = (req.body ?? {}) as SuggestionRequest;

    if (!latest || typeof latest !== 'object') {
      return res.status(400).json({ error: 'Missing latest financial data' });
    }

    const suggestions = await generateSuggestions(buildFinancialSummary(latest, goals));

    return res.status(200).json(suggestions);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[generate-suggestions] Error:', message);
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    return res.status(statusCode).json({ error: message });
  }
}
