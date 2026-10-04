import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL('../src/utils/suggestions.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { generateFinancialSuggestions } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`
);

const validSuggestions = {
  short_term_suggestion: 'Review this month’s spending.',
  long_term_suggestion: 'Review retirement contributions.',
  goal_suggestion: 'Track progress toward your goals.',
  oneline_suggestion: 'Start by reviewing your monthly budget.',
};

function respond(t, body, options = {}) {
  return t.mock.method(globalThis, 'fetch', async () => new Response(body, options));
}

test('sends the authenticated request and returns all four valid suggestions', async (t) => {
  const fetchMock = respond(t, JSON.stringify(validSuggestions));
  const latest = { income: 1000 };
  const goals = { emergency: 5000 };

  assert.deepEqual(await generateFinancialSuggestions(latest, goals, 'test-token'), validSuggestions);
  assert.deepEqual(fetchMock.mock.calls[0].arguments, ['/api/generate-suggestions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ latest, goals }),
  }]);
});

test('preserves actionable backend JSON errors', async (t) => {
  const error = 'Your session expired. Sign in again to generate financial suggestions.';
  respond(t, JSON.stringify({ error }), { status: 401 });

  await assert.rejects(generateFinancialSuggestions({}, null, 'test-token'), { message: error });
});

test('reports Vercel runtime failures without exposing the error page', async (t) => {
  respond(t, '<html>Private runtime details</html>', {
    status: 500,
    headers: {
      'content-type': 'text/html',
      'x-vercel-error': 'FUNCTION_INVOCATION_FAILED',
      'x-vercel-id': 'sfo1::iad1::sample-123',
    },
  });

  await assert.rejects(generateFinancialSuggestions({}, null, 'test-token'), (error) => {
    assert.match(error.message, /HTTP 500/);
    assert.match(error.message, /FUNCTION_INVOCATION_FAILED/);
    assert.match(error.message, /Request reference: sfo1::iad1::sample-123/);
    assert.match(error.message, /share these details with support/);
    assert.doesNotMatch(error.message, /html|Private runtime details/);
    return true;
  });
});

test('uses the HTTP status when a failure has no structured error or diagnostics', async (t) => {
  respond(t, JSON.stringify({ error: { details: 'Internal details' } }), { status: 502 });

  await assert.rejects(generateFinancialSuggestions({}, null, 'test-token'), (error) => {
    assert.match(error.message, /HTTP 502/);
    assert.doesNotMatch(error.message, /Internal details|\[object Object\]/);
    return true;
  });
});

test('ignores malformed diagnostic headers', async (t) => {
  respond(t, 'Private error text', {
    status: 503,
    headers: {
      'x-vercel-error': '<script>unexpected</script>',
      'x-vercel-id': 'unexpected request details',
    },
  });

  await assert.rejects(generateFinancialSuggestions({}, null, 'test-token'), (error) => {
    assert.match(error.message, /HTTP 503/);
    assert.doesNotMatch(error.message, /unexpected|Private error text|Error code:|Request reference:/);
    return true;
  });
});

test('shows the server-provided rate limit wait time', async (t) => {
  respond(t, '{}', { status: 429, headers: { 'Retry-After': '125' } });

  await assert.rejects(generateFinancialSuggestions({}, null, 'test-token'), {
    message: 'Suggestion request limit reached. Try again in about 3 minute(s).',
  });
});

for (const retryAfter of [undefined, '', 'invalid', '-60']) {
  test(`does not invent a rate limit wait time for Retry-After ${JSON.stringify(retryAfter)}`, async (t) => {
    const headers = retryAfter === undefined ? {} : { 'Retry-After': retryAfter };
    respond(t, '{}', { status: 429, headers });

    await assert.rejects(generateFinancialSuggestions({}, null, 'test-token'), {
      message: 'Suggestion request limit reached.',
    });
  });
}

const malformedResponses = [
  ['an HTML fallback page', '<html>Fallback page</html>'],
  ['null', 'null'],
  ['an array', '[]'],
  ['an empty object', '{}'],
  ['an error object', JSON.stringify({ error: 'Unexpected success status' })],
  ...Object.keys(validSuggestions).flatMap((key) => [
    [`missing ${key}`, JSON.stringify({ ...validSuggestions, [key]: undefined })],
    [`blank ${key}`, JSON.stringify({ ...validSuggestions, [key]: ' \n ' })],
    [`non-string ${key}`, JSON.stringify({ ...validSuggestions, [key]: 42 })],
  ]),
];

for (const [label, body] of malformedResponses) {
  test(`rejects a successful response containing ${label}`, async (t) => {
    respond(t, body);

    await assert.rejects(generateFinancialSuggestions({}, null, 'test-token'), {
      message: 'The suggestion service returned an incomplete or invalid response. Please try again.',
    });
  });
}
