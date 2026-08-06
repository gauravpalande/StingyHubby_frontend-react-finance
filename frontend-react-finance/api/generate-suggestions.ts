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

const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna';

let openai: OpenAI | null = null;

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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

function buildPrompt(kind: SuggestionKey, financialSummary: string) {
  const shared = `
Use simple, user-friendly language.
Base advice on common United States personal finance guidance, including the income/spending priority flowchart concept: essentials first, high-interest debt, emergency savings, retirement, then longer-term goals.
Do not include disclaimers. Do not mention GPT or AI.
`.trim();

  const taskByKind: Record<SuggestionKey, string> = {
    short_term_suggestion:
      'Give one detailed short-term, actionable financial suggestion.',
    long_term_suggestion:
      'Give one detailed long-term, actionable financial suggestion.',
    goal_suggestion:
      'Give one detailed, actionable suggestion about progress toward each goal. Focus only on goals; do not include short-term or long-term summaries.',
    oneline_suggestion:
      'Give exactly one concise sentence with the most important financial suggestion.',
  };

  return `${financialSummary}\n\n${taskByKind[kind]}\n${shared}`;
}

async function generateSuggestion(kind: SuggestionKey, financialSummary: string) {
  const response = await getOpenAI().responses.create({
    model,
    input: buildPrompt(kind, financialSummary),
    max_output_tokens: kind === 'oneline_suggestion' ? 80 : 350,
  });

  return response.output_text.trim();
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

    const financialSummary = buildFinancialSummary(latest, goals);
    const [
      short_term_suggestion,
      long_term_suggestion,
      goal_suggestion,
      oneline_suggestion,
    ] = await Promise.all([
      generateSuggestion('short_term_suggestion', financialSummary),
      generateSuggestion('long_term_suggestion', financialSummary),
      generateSuggestion('goal_suggestion', financialSummary),
      generateSuggestion('oneline_suggestion', financialSummary),
    ]);

    return res.status(200).json({
      short_term_suggestion,
      long_term_suggestion,
      goal_suggestion,
      oneline_suggestion,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[generate-suggestions] Error:', message);
    return res.status(500).json({ error: 'Failed to generate financial suggestions' });
  }
}
