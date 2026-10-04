export type FinancialSuggestions = {
  short_term_suggestion: string;
  long_term_suggestion: string;
  goal_suggestion: string;
  oneline_suggestion: string;
};

const suggestionKeys = [
  'short_term_suggestion',
  'long_term_suggestion',
  'goal_suggestion',
  'oneline_suggestion',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFinancialSuggestions(value: unknown): value is FinancialSuggestions {
  return isRecord(value) && suggestionKeys.every(
    (key) => typeof value[key] === 'string' && value[key].trim().length > 0
  );
}

function serviceErrorMessage(response: Response) {
  const errorCode = response.headers.get('x-vercel-error');
  const requestId = response.headers.get('x-vercel-id');
  // Only show bounded diagnostic identifiers, never an HTML/plain-text error page.
  const codeMessage = errorCode && /^[A-Z][A-Z0-9_]{1,99}$/.test(errorCode)
    ? ` Error code: ${errorCode}.`
    : '';
  const referenceMessage = requestId && /^[A-Za-z0-9][A-Za-z0-9:._=-]{0,199}$/.test(requestId)
    ? ` Request reference: ${requestId}.`
    : '';

  return `The suggestion service could not complete the request (HTTP ${response.status}).${codeMessage} Please try again. If this continues, share these details with support.${referenceMessage}`;
}

export async function generateFinancialSuggestions(
  latest: object,
  goals: object | null,
  accessToken: string
): Promise<FinancialSuggestions> {
  const response = await fetch('/api/generate-suggestions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ latest, goals }),
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfter = retryAfterHeader !== null && /^\d+$/.test(retryAfterHeader)
        ? Number(retryAfterHeader)
        : NaN;
      const waitMessage = Number.isFinite(retryAfter)
        ? ` Try again in about ${Math.max(1, Math.ceil(retryAfter / 60))} minute(s).`
        : '';
      throw new Error(`Suggestion request limit reached.${waitMessage}`);
    }

    if (isRecord(body) && typeof body.error === 'string' && body.error.trim()) {
      throw new Error(body.error);
    }

    throw new Error(serviceErrorMessage(response));
  }

  if (!isFinancialSuggestions(body)) {
    throw new Error('The suggestion service returned an incomplete or invalid response. Please try again.');
  }

  return body;
}
