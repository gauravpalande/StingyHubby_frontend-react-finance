export type FinancialSuggestions = {
  short_term_suggestion: string;
  long_term_suggestion: string;
  goal_suggestion: string;
  oneline_suggestion: string;
};

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

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After'));
      const waitMessage = Number.isFinite(retryAfter)
        ? ` Try again in about ${Math.max(1, Math.ceil(retryAfter / 60))} minute(s).`
        : '';
      throw new Error(`Suggestion request limit reached.${waitMessage}`);
    }

    throw new Error(body?.error || 'Failed to generate financial suggestions');
  }

  return body as FinancialSuggestions;
}
