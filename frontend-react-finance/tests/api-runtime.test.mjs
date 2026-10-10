import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
let outputDirectory;

before(async () => {
  outputDirectory = await mkdtemp(join(tmpdir(), 'pennywize-api-test-'));
  await writeFile(join(outputDirectory, 'package.json'), '{"type":"module"}');
  await symlink(join(projectRoot, 'node_modules'), join(outputDirectory, 'node_modules'), 'dir');

  // Keep imports intact: bundling would hide the ESM resolution error seen on Vercel.
  await build({
    absWorkingDir: projectRoot,
    entryPoints: ['api/generate-suggestions.ts', 'api/portal.ts', 'api/_lib/rateLimit.ts'],
    outbase: 'api',
    outdir: outputDirectory,
    bundle: false,
    platform: 'node',
    format: 'esm',
    target: 'node20',
  });
});

after(async () => {
  if (outputDirectory) await rm(outputDirectory, { recursive: true, force: true });
});

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

for (const route of ['generate-suggestions', 'portal']) {
  test(`${route} starts as native ESM and rejects GET with JSON`, async () => {
    const { default: handler } = await import(pathToFileURL(join(outputDirectory, `${route}.js`)).href);
    const response = createResponse();

    await handler({ method: 'GET', headers: {} }, response);

    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.Allow, 'POST');
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.deepEqual(response.body, { error: 'Method not allowed' });
  });

  test(`${route} rejects unauthenticated POST without calling external services`, async (context) => {
    const { default: handler } = await import(pathToFileURL(join(outputDirectory, `${route}.js`)).href);
    const fetchMock = context.mock.method(globalThis, 'fetch', () => {
      throw new Error('Unauthenticated requests must not call external services');
    });
    const response = createResponse();

    await handler({ method: 'POST', headers: { 'content-type': 'application/json' }, body: {} }, response);

    assert.equal(response.statusCode, 401);
    assert.match(response.body.error, /logged in/);
    assert.equal(fetchMock.mock.callCount(), 0);
  });
}

const publicServiceError = 'The suggestion service is temporarily unavailable. Please try again.';
const requestId = 'sfo1::test-request';
const accessToken = 'private.test.session';
const privateDiagnostic = 'private-provider-diagnostic: key=secret-value; project=internal-project';
const validRequestBody = {
  latest: {
    income: 123456.78,
    checking: 1000,
    emergency: 500,
    health: 200,
    retirement: 2500,
    creditCards: 400,
    mortgage: 600,
    carPayments: 150,
    utilities: 75,
  },
  goals: { emergency: 5000, retirement: 50000, health: 1000 },
};
const validSuggestions = {
  short_term_suggestion: 'Review this month’s spending.',
  long_term_suggestion: 'Review retirement contributions.',
  goal_suggestion: 'Track progress toward your goals.',
  oneline_suggestion: 'Start by reviewing your monthly budget.',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function suggestionScenario(context, options = {}) {
  const environment = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'private-service-role-key',
    OPENAI_API_KEY: 'private-openai-key',
    OPENAI_BASE_URL: undefined,
    ...options.environment,
  };
  const previousEnvironment = Object.fromEntries(
    Object.keys(environment).map((name) => [name, process.env[name]])
  );
  context.after(() => {
    for (const [name, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  for (const [name, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  const infoLog = context.mock.method(console, 'info', () => {});
  const errorLog = context.mock.method(console, 'error', () => {});
  const fetchMock = context.mock.method(globalThis, 'fetch', async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url ?? input.toString());
    if (url.origin === 'https://test.supabase.co' && url.pathname === '/auth/v1/user') {
      return options.authResponse?.() ?? jsonResponse({ id: 'test-user', email: 'user@example.com' });
    }
    if (url.origin === 'https://test.supabase.co' && url.pathname === '/rest/v1/rpc/consume_api_rate_limit') {
      return options.rateLimitResponse?.() ?? jsonResponse({ allowed: true, remaining: 4, retry_after_seconds: 0 });
    }
    if (url.origin === 'https://api.openai.com' && url.pathname === '/v1/responses') {
      return options.openAIResponse?.(JSON.parse(init.body)) ?? jsonResponse({
        object: 'response',
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(validSuggestions) }] }],
      });
    }
    throw new Error(`Unexpected external request in test: ${url.origin}${url.pathname}`);
  });

  // Each scenario needs fresh cached clients so its mocked environment stays isolated.
  const moduleUrl = pathToFileURL(join(outputDirectory, 'generate-suggestions.js'));
  moduleUrl.searchParams.set('scenario', context.name);
  const { default: handler } = await import(moduleUrl.href);
  const response = createResponse();
  const request = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
      'x-vercel-id': requestId,
    },
    body: structuredClone(validRequestBody),
  };
  return {
    handler,
    request,
    response,
    fetchMock,
    errorLog,
    auditEvents: () => infoLog.mock.calls
      .filter(({ arguments: args }) => args[0] === '[audit]')
      .map(({ arguments: args }) => JSON.parse(args[1])),
    loggedText: () => JSON.stringify([
      ...infoLog.mock.calls.map(({ arguments: args }) => args),
      ...errorLog.mock.calls.map(({ arguments: args }) => args),
    ]),
  };
}

function assertSafeFailure(scenario, statusCode, reason) {
  assert.equal(scenario.response.statusCode, statusCode);
  assert.deepEqual(scenario.response.body, { error: publicServiceError });
  const failures = scenario.auditEvents().filter(({ event }) => event === 'suggestions.request_failed');
  assert.equal(failures.length, 1);
  assert.equal(failures[0].requestId, requestId);
  assert.equal(failures[0].statusCode, statusCode);
  assert.equal(failures[0].reason, reason);
  assert.ok(Number.isFinite(failures[0].durationMs) && failures[0].durationMs >= 0);
  assert.doesNotMatch(scenario.loggedText(), /private-provider-diagnostic|private-error-code|secret-value|internal-project|private\.test\.session|private-service-role-key|private-openai-key|123456\.78/);
}

test('suggestions returns all four suggestions for a valid authenticated request', async (context) => {
  const scenario = await suggestionScenario(context);
  await scenario.handler(scenario.request, scenario.response);

  assert.equal(scenario.response.statusCode, 200);
  assert.deepEqual(scenario.response.body, validSuggestions);
  assert.equal(Object.keys(scenario.response.body).length, 4);
  assert.equal(scenario.auditEvents().find(({ event }) => event === 'suggestions.generated').requestId, requestId);
});

test('suggestions preserves the actionable message for a rejected session', async (context) => {
  const scenario = await suggestionScenario(context, {
    authResponse: () => jsonResponse({ message: privateDiagnostic }, 401),
  });
  await scenario.handler(scenario.request, scenario.response);

  assert.equal(scenario.response.statusCode, 401);
  assert.deepEqual(scenario.response.body, {
    error: 'Your session expired. Sign in again to generate financial suggestions.',
  });
  assert.equal(scenario.fetchMock.mock.callCount(), 1);
});

test('suggestions preserves the validation message for invalid financial input', async (context) => {
  const scenario = await suggestionScenario(context);
  scenario.request.body.latest.income = 'invalid financial amount';
  await scenario.handler(scenario.request, scenario.response);

  assert.equal(scenario.response.statusCode, 400);
  assert.deepEqual(scenario.response.body, { error: 'Financial data must contain valid numeric values.' });
  assert.equal(scenario.auditEvents()[0].reason, 'invalid_financial_data');
  assert.ok(scenario.fetchMock.mock.calls.every(({ arguments: args }) => !String(args[0]).includes('api.openai.com')));
});

test('suggestions preserves the rate limit message and Retry-After header', async (context) => {
  const scenario = await suggestionScenario(context, {
    rateLimitResponse: () => jsonResponse({ allowed: false, remaining: 0, retry_after_seconds: 125 }),
  });
  await scenario.handler(scenario.request, scenario.response);

  assert.equal(scenario.response.statusCode, 429);
  assert.deepEqual(scenario.response.body, { error: 'Too many requests. Please wait before trying again.' });
  assert.equal(scenario.response.headers['Retry-After'], '125');
  assert.equal(scenario.fetchMock.mock.callCount(), 2);
});

for (const providerStatus of [401, 403, 404, 429, 500]) {
  test(`suggestions hides OpenAI HTTP ${providerStatus} errors from responses and logs`, async (context) => {
    const scenario = await suggestionScenario(context, {
      openAIResponse: () => jsonResponse({ error: { message: privateDiagnostic, code: 'private-error-code' } }, providerStatus),
    });
    await scenario.handler(scenario.request, scenario.response);

    assertSafeFailure(scenario, 502, 'upstream_service_failure');
    assert.equal(scenario.errorLog.mock.callCount(), 0);
  });
}

test('suggestions hides unexpected server exceptions from responses and logs', async (context) => {
  const scenario = await suggestionScenario(context);
  Object.defineProperty(scenario.request.headers, 'authorization', {
    get() { throw new Error(privateDiagnostic); },
  });
  await scenario.handler(scenario.request, scenario.response);

  assertSafeFailure(scenario, 500, 'unexpected_server_error');
  assert.equal(scenario.errorLog.mock.callCount(), 0);
  assert.equal(scenario.fetchMock.mock.callCount(), 0);
});

test('suggestions hides a rate limit service failure and its database diagnostics', async (context) => {
  const scenario = await suggestionScenario(context, {
    rateLimitResponse: () => jsonResponse({ message: privateDiagnostic, details: privateDiagnostic }, 500),
  });
  await scenario.handler(scenario.request, scenario.response);

  assertSafeFailure(scenario, 503, 'rate_limit_unavailable');
  assert.equal(scenario.fetchMock.mock.callCount(), 2);
});

for (const name of ['OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  test(`suggestions hides missing ${name} configuration details`, async (context) => {
    const scenario = await suggestionScenario(context, { environment: { [name]: undefined } });
    await scenario.handler(scenario.request, scenario.response);

    assertSafeFailure(scenario, 500, 'unexpected_server_error');
    assert.doesNotMatch(scenario.loggedText(), /OPENAI_API_KEY|SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|redeploy/);
    assert.equal(scenario.errorLog.mock.callCount(), 0);
  });
}

test('suggestions falls back to the second model with a safe audit reason', async (context) => {
  let providerCalls = 0;
  const scenario = await suggestionScenario(context, {
    openAIResponse: () => {
      providerCalls += 1;
      if (providerCalls === 1) {
        return jsonResponse({ error: { message: privateDiagnostic, code: 'model_not_found' } }, 404);
      }
      return jsonResponse({ status: 'completed', output_text: JSON.stringify(validSuggestions) });
    },
  });
  await scenario.handler(scenario.request, scenario.response);

  assert.equal(providerCalls, 2);
  assert.equal(scenario.response.statusCode, 200);
  assert.deepEqual(scenario.response.body, validSuggestions);
  const fallback = scenario.auditEvents().find(({ event }) => event === 'suggestions.model_fallback');
  assert.equal(fallback.requestId, requestId);
  assert.equal(fallback.reason, 'model_access_unavailable');
  assert.doesNotMatch(scenario.loggedText(), /private-provider-diagnostic|secret-value|internal-project/);
  assert.equal(scenario.errorLog.mock.callCount(), 0);
});

for (const [label, responseBody] of [
  ['malformed', { status: 'completed', output_text: privateDiagnostic }],
  ['incomplete', { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }],
]) {
  test(`suggestions returns a generic error when the OpenAI response is ${label}`, async (context) => {
    const scenario = await suggestionScenario(context, { openAIResponse: () => jsonResponse(responseBody) });
    await scenario.handler(scenario.request, scenario.response);

    assertSafeFailure(scenario, 502, 'upstream_service_failure');
    assert.equal(scenario.errorLog.mock.callCount(), 0);
  });
}
