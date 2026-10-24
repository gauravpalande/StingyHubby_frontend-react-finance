import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import nodemailer from 'nodemailer';
import {
  createDigestMailer,
  GMAIL_CONFIGURATION_ERROR,
  GMAIL_SENDER_EMAIL,
  GmailConfigurationError,
  GmailConnectionError,
  GmailDeliveryError,
} from '../api/_lib/digestMailer.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const realCreateTransport = nodemailer.createTransport.bind(nodemailer);
const cronSecret = 'fictional-cron-secret-for-digest-tests';
const userId = '123e4567-e89b-42d3-a456-426614174000';
const recipient = 'fictional-recipient@example.invalid';
const privateDiagnostic = 'private SMTP diagnostic containing credentials and recipient details';
let outputDirectory;

before(async () => {
  outputDirectory = await mkdtemp(join(tmpdir(), 'pennywize-gmail-test-'));
  await writeFile(join(outputDirectory, 'package.json'), '{"type":"module"}');
  await symlink(join(projectRoot, 'node_modules'), join(outputDirectory, 'node_modules'), 'dir');
  await mkdir(join(outputDirectory, '_lib'));
  await Promise.all([
    ...['digestMailer.mjs', 'unsubscribeToken.mjs'].map((name) => copyFile(
      join(projectRoot, 'api', '_lib', name), join(outputDirectory, '_lib', name)
    )),
    build({
      absWorkingDir: projectRoot,
      entryPoints: ['api/send-digest.js', 'api/send-monthly-report.ts'],
      outdir: outputDirectory,
      bundle: false,
      platform: 'node',
      format: 'esm',
      target: 'node20',
    }),
    // Keep real template rendering independent of a prior application build.
    build({
      absWorkingDir: projectRoot,
      entryPoints: ['api/emails/WeeklyDigest.tsx'],
      outfile: join(outputDirectory, '.compiled', 'WeeklyDigest.mjs'),
      bundle: true,
      packages: 'external',
      platform: 'node',
      format: 'esm',
      target: 'node20',
      jsx: 'automatic',
    }),
  ]);
});

after(async () => {
  if (outputDirectory) await rm(outputDirectory, { recursive: true, force: true });
});

function setEnvironment(context, values) {
  const previous = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  context.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

function createResponse() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function createRequest(route, query = '', authorization = `Bearer ${cronSecret}`) {
  return { method: 'GET', url: `/api/${route}${query}`, headers: { authorization, host: 'preview.example.invalid' } };
}

function jsonResponse(body, status = 200) {
  return new Response(body === undefined ? undefined : JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

function smtpError(code, command, responseCode) {
  return Object.assign(new Error(privateDiagnostic), { code, command, responseCode });
}

const connectionFailures = [
  ['authentication rejection', 'EAUTH', 'gmail_authentication_failed'],
  ['connection timeout', 'ETIMEDOUT', 'gmail_connection_timeout'],
  ['network connection failure', 'ECONNECTION', 'gmail_connection_failed'],
  ['TLS certificate failure', 'CERT_HAS_EXPIRED', 'gmail_connection_failed'],
];

function privateConnectionError(code) {
  return Object.assign(new Error(`${privateDiagnostic}; password=abcdefghijklmnop`), { code });
}

function mockTransport(context, options = {}) {
  const events = options.events ?? [];
  const calls = { configurations: [], messages: [], verifications: 0, closed: 0 };
  context.mock.method(nodemailer, 'createTransport', (configuration) => {
    calls.configurations.push(configuration);
    return {
      async verify() {
        calls.verifications += 1;
        events.push('smtp_verify');
        if (options.verifyError) throw options.verifyError;
        return true;
      },
      async sendMail(message) {
        calls.messages.push(message);
        events.push('smtp_send');
        if (options.sendError) throw options.sendError;
        return options.sendResult ?? { messageId: message.messageId, accepted: [message.to], rejected: [] };
      },
      close() { calls.closed += 1; },
    };
  });
  return calls;
}

const mail = { to: recipient, subject: 'Fictional financial digest', html: '<p>Fictional financial digest</p>', deliveryKey: 'weekly:fictional-period:fictional-user' };

for (const [label, password] of [['missing', undefined], ['blank', ' '], ['short', 'a'.repeat(15)], ['long', 'a'.repeat(17)], ['punctuation', `${'a'.repeat(15)}!`]]) {
  test(`Gmail rejects a ${label} app password before creating a transport`, (context) => {
    setEnvironment(context, { GMAIL_APP_PASSWORD: password });
    const calls = mockTransport(context);
    assert.throws(() => createDigestMailer(), { message: GMAIL_CONFIGURATION_ERROR });
    assert.throws(() => createDigestMailer(), GmailConfigurationError);
    assert.equal(calls.configurations.length, 0);
  });
}

test('Gmail uses the fixed account, normalized password, TLS, and bounded private transport settings', async (context) => {
  setEnvironment(context, { GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop', GMAIL_USER: 'ignored-other-account@example.invalid', DIGEST_FROM_EMAIL: 'ignored-legacy-sender@example.invalid' });
  const calls = mockTransport(context);
  const mailer = createDigestMailer();
  await mailer.verify();
  await mailer.sendMail(mail);
  mailer.close();

  const configuration = calls.configurations[0];
  assert.equal(GMAIL_SENDER_EMAIL, 'gapisgod@gmail.com');
  assert.deepEqual(configuration.auth, { user: 'gapisgod@gmail.com', pass: 'abcdefghijklmnop' });
  assert.equal(configuration.host, 'smtp.gmail.com');
  assert.equal(configuration.port, 465);
  assert.equal(configuration.secure, true);
  for (const setting of ['pool', 'logger', 'debug']) assert.equal(configuration[setting], false);
  for (const setting of ['disableFileAccess', 'disableUrlAccess']) assert.equal(configuration[setting], true);
  for (const setting of ['connectionTimeout', 'greetingTimeout', 'socketTimeout', 'dnsTimeout']) assert.ok(configuration[setting] > 0 && configuration[setting] <= 60000);
  assert.deepEqual(calls.messages[0].from, { name: 'PennyWize', address: 'gapisgod@gmail.com' });
  assert.equal(calls.verifications, 1);
  assert.equal(calls.closed, 1);
});

for (const [label, code, reason] of connectionFailures) {
  test(`Gmail classifies ${label} without exposing SMTP diagnostics or credentials`, async (context) => {
    setEnvironment(context, { GMAIL_APP_PASSWORD: 'abcdefghijklmnop' });
    mockTransport(context, { verifyError: privateConnectionError(code) });
    const mailer = createDigestMailer();
    await assert.rejects(mailer.verify(), (error) => {
      assert.ok(error instanceof GmailConnectionError);
      assert.equal(error.reason, reason);
      assert.equal(error.message, new GmailConnectionError(reason).message);
      assert.doesNotMatch(`${error.message} ${JSON.stringify(error)}`, /private SMTP|credentials and recipient|abcdefghijklmnop/);
      return true;
    });
    mailer.close();
  });
}

for (const [label, to] of [['multiple recipients', `${recipient},other@example.invalid`], ['header injection', `${recipient}\r\nBcc: other@example.invalid`], ['address array', [recipient]]]) {
  test(`Gmail rejects ${label} before SMTP submission`, async (context) => {
    setEnvironment(context, { GMAIL_APP_PASSWORD: 'abcdefghijklmnop' });
    const calls = mockTransport(context);
    const mailer = createDigestMailer();
    await assert.rejects(mailer.sendMail({ ...mail, to }), (error) => error instanceof GmailDeliveryError && error.uncertain === false && error.reason === 'invalid_recipient');
    assert.equal(calls.messages.length, 0);
    mailer.close();
  });
}

for (const [label, failure, uncertain, reason] of [
  ['explicit recipient rejection', smtpError('EENVELOPE', 'RCPT TO', 550), false, 'gmail_rejected'],
  ['authentication rejection', smtpError('EAUTH', 'AUTH', 535), false, 'gmail_rejected'],
  ['timeout awaiting DATA acknowledgment', smtpError('ETIMEDOUT', 'DATA'), true, 'delivery_outcome_unknown'],
  ['unclassified connection loss', smtpError('ECONNECTION'), true, 'delivery_outcome_unknown'],
]) {
  test(`Gmail safely classifies ${label}`, async (context) => {
    setEnvironment(context, { GMAIL_APP_PASSWORD: 'abcdefghijklmnop' });
    mockTransport(context, { sendError: failure });
    const mailer = createDigestMailer();
    await assert.rejects(mailer.sendMail(mail), (error) => error instanceof GmailDeliveryError && error.uncertain === uncertain && error.reason === reason && !error.message.includes(privateDiagnostic));
    mailer.close();
  });
}

for (const [label, sendResult, uncertain] of [
  ['rejected recipient', { accepted: [], rejected: [recipient] }, false],
  ['missing acceptance information', {}, true],
  ['different accepted recipient', { accepted: ['other@example.invalid'], rejected: [] }, true],
]) {
  test(`Gmail does not report success for ${label}`, async (context) => {
    setEnvironment(context, { GMAIL_APP_PASSWORD: 'abcdefghijklmnop' });
    mockTransport(context, { sendResult });
    const mailer = createDigestMailer();
    await assert.rejects(mailer.sendMail(mail), (error) => error instanceof GmailDeliveryError && error.uncertain === uncertain);
    mailer.close();
  });
}

test('Gmail traces repeated delivery keys consistently without leaking the key in Message-ID', async (context) => {
  setEnvironment(context, { GMAIL_APP_PASSWORD: 'abcdefghijklmnop' });
  const calls = mockTransport(context);
  const mailer = createDigestMailer();
  await mailer.sendMail(mail); await mailer.sendMail(mail);
  await mailer.sendMail({ ...mail, deliveryKey: 'different-period' });
  assert.equal(calls.messages[0].messageId, calls.messages[1].messageId);
  assert.notEqual(calls.messages[0].messageId, calls.messages[2].messageId);
  assert.match(calls.messages[0].messageId, /^<pennywize-[a-f0-9]{64}@gmail\.com>$/);
  mailer.close();
});

// Decode only leaf MIME parts produced by Nodemailer's real stream transport.
function mimeParts(message) {
  const raw = message.toString('utf8');
  const boundaries = [...raw.matchAll(/boundary="([^"]+)"/g)].map((match) => match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return raw.split(new RegExp(`\\r\\n--(?:${boundaries.join('|')})(?:--)?\\r\\n`)).flatMap((candidate) => {
    const index = candidate.indexOf('\r\n\r\n');
    if (index < 0) return [];
    const headers = candidate.slice(0, index).replace(/\r\n[ \t]+/g, ' ');
    const type = headers.match(/Content-Type: ([^;\r\n]+)/i)?.[1];
    if (!type || type.startsWith('multipart/')) return [];
    const transfer = headers.match(/Content-Transfer-Encoding: ([^\r\n]+)/i)?.[1];
    let body = candidate.slice(index + 4);
    if (transfer === 'base64') return [{ type, headers, bytes: Buffer.from(body.replace(/\r\n/g, ''), 'base64') }];
    if (transfer === 'quoted-printable') body = body.replace(/=\r\n/g, '').replace(/=([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return [{ type, headers, bytes: Buffer.from(body, transfer === 'quoted-printable' ? 'binary' : 'utf8') }];
  });
}

test('real Nodemailer MIME preserves UTF-8 HTML, CSV, PDF buffers, and the inline CID logo', async (context) => {
  setEnvironment(context, { GMAIL_APP_PASSWORD: 'abcdefghijklmnop' });
  const stream = realCreateTransport({ streamTransport: true, buffer: true, newline: 'windows', disableFileAccess: true, disableUrlAccess: true });
  let generated;
  context.mock.method(nodemailer, 'createTransport', () => ({
    verify: async () => true,
    async sendMail(message) { generated = await stream.sendMail(message); return { ...generated, accepted: [message.to], rejected: [] }; },
    close() { stream.close(); },
  }));
  const html = '<p>Fictional café recipient</p><img src="cid:pw-logo" />';
  const attachments = [
    { filename: 'history.csv', content: 'income,checking\n4200,1800', contentType: 'text/csv' },
    { filename: 'digest.pdf', content: Buffer.from('%PDF-1.4\nFictional PDF\n%%EOF'), contentType: 'application/pdf' },
    { filename: 'pennywize-logo.png', content: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64'), contentType: 'image/png', cid: 'pw-logo' },
  ];
  const mailer = createDigestMailer();
  await mailer.sendMail({ ...mail, html, attachments });
  const raw = generated.message.toString('utf8');
  assert.match(raw, /^From: PennyWize <gapisgod@gmail\.com>\r?$/m);
  assert.deepEqual(generated.envelope, { from: 'gapisgod@gmail.com', to: [recipient] });
  assert.match(raw, /Content-ID: <pw-logo>/);
  const parts = mimeParts(generated.message);
  assert.equal(parts.find(({ type }) => type === 'text/html').bytes.toString('utf8'), html);
  for (const attachment of attachments) {
    const part = parts.find(({ type }) => type === attachment.contentType);
    assert.ok(part.headers.includes(attachment.filename));
    assert.deepEqual(part.bytes, Buffer.from(attachment.content));
  }
  mailer.close();
});

async function handlerScenario(context, route, options = {}) {
  setEnvironment(context, {
    CRON_SECRET: cronSecret,
    GMAIL_APP_PASSWORD: options.password === undefined && !Object.hasOwn(options, 'password') ? 'abcdefghijklmnop' : options.password,
    GMAIL_USER: undefined, DIGEST_FROM_EMAIL: undefined, RESEND_API_KEY: undefined,
    SUPABASE_URL: 'https://digest-test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'fictional-service-role-key',
    UNSUBSCRIBE_SIGNING_SECRET: 'fictional-unsubscribe-signing-secret-for-tests',
    NEXT_PUBLIC_SITE_URL: 'https://preview.example.invalid',
  });
  const state = { delivery: undefined, events: [], statusWrites: [], emailLogs: [], ...options };
  const smtp = mockTransport(context, { ...options, events: state.events });
  const errorLog = context.mock.method(console, 'error', () => {});
  const fetchMock = context.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url ?? input.toString());
    if (url.origin === 'https://digest-test.supabase.co') {
      if (url.pathname === '/rest/v1/rpc/cleanup_cost_protection_data') { state.events.push('cleanup'); return jsonResponse(null); }
      if (url.pathname === '/rest/v1/preferences') return jsonResponse([{ user_id: userId }]);
      if (url.pathname === '/rest/v1/users') return jsonResponse([{ id: userId, email: recipient, name: 'Fictional Test Recipient' }]);
      if (url.pathname === '/rest/v1/rpc/claim_scheduled_email_delivery') {
        state.events.push('claim');
        if (state.delivery === 'running' || state.delivery === 'sent') return jsonResponse(false);
        state.delivery = 'running'; return jsonResponse(true);
      }
      if (url.pathname === '/rest/v1/submissions') {
        if (state.historyError) return jsonResponse({ message: privateDiagnostic }, 500);
        return jsonResponse([{
          id: 'fictional-submission', created_at: '2026-09-15T12:00:00Z', income: 4200,
          checking: 1000, emergency: 500, health: 200, retirement: 5000,
          creditCards: 100, mortgage: 1000, carPayments: 200, utilities: 150,
          short_term_suggestion: 'Review spending.', long_term_suggestion: 'Review retirement savings.',
          goal_suggestion: 'Track your savings goals.', oneline_suggestion: 'Keep reviewing your budget.',
        }]);
      }
      if (url.pathname === '/auth/v1/admin/generate_link') return jsonResponse({ action_link: 'https://preview.example.invalid/auth/callback', email_otp: '123456', hashed_token: 'fictional-token-hash', redirect_to: 'https://preview.example.invalid', verification_type: 'magiclink', id: userId });
      if (url.pathname === '/rest/v1/scheduled_email_deliveries') {
        const update = JSON.parse(init.body); state.statusWrites.push(update); state.events.push(`mark_${update.status}`);
        if (state.statusWriteError && update.status === 'sent') return jsonResponse({ message: privateDiagnostic }, 500);
        state.delivery = update.status; return jsonResponse(undefined, 204);
      }
      if (url.pathname === '/rest/v1/email_logs') {
        state.emailLogs.push(JSON.parse(init.body)); state.events.push('email_log');
        return state.emailLogError ? jsonResponse({ message: privateDiagnostic }, 500) : jsonResponse(undefined, 204);
      }
    }
    if (url.origin === 'https://quickchart.io') throw new Error('Tests omit the optional remote chart');
    throw new Error(`Unexpected external request: ${url.origin}${url.pathname}`);
  });
  const moduleUrl = pathToFileURL(join(outputDirectory, `${route}.js`));
  moduleUrl.searchParams.set('scenario', context.name);
  const { default: handler } = await import(moduleUrl.href);
  return {
    state, smtp, fetchMock, errorLog,
    async run(query = '', authorization) { const response = createResponse(); await handler(createRequest(route, query, authorization), response); return response; },
  };
}

for (const route of ['send-digest', 'send-monthly-report']) {
  for (const [label, password] of [['missing', undefined], ['malformed', 'private-invalid-password']]) {
    test(`${route} rejects ${label} Gmail credentials before SMTP or database writes`, async (context) => {
      const scenario = await handlerScenario(context, route, { password });
      const response = await scenario.run();
      assert.equal(response.statusCode, 503); assert.deepEqual(response.body, { error: GMAIL_CONFIGURATION_ERROR });
      assert.equal(scenario.fetchMock.mock.callCount(), 0); assert.equal(scenario.smtp.configurations.length, 0);
    });
  }
  test(`${route} dry run remains authenticated and does not need SMTP credentials`, async (context) => {
    const scenario = await handlerScenario(context, route, { password: undefined });
    const response = await scenario.run('?dryRun=1');
    assert.equal(response.statusCode, 200); assert.equal(response.body.ok, true);
    const unauthorized = await scenario.run('?dryRun=1', 'Bearer invalid');
    assert.equal(unauthorized.statusCode, 401);
    assert.equal(scenario.fetchMock.mock.callCount(), 0); assert.equal(scenario.smtp.configurations.length, 0);
  });
  test(`${route} verify mode authenticates to Gmail without reading users or sending mail`, async (context) => {
    const scenario = await handlerScenario(context, route);
    const response = await scenario.run('?verify=1');
    assert.equal(response.statusCode, 200); assert.equal(response.body.provider, 'gmail'); assert.equal(response.body.sender, 'gapisgod@gmail.com');
    assert.equal(scenario.smtp.verifications, 1); assert.equal(scenario.smtp.messages.length, 0); assert.equal(scenario.smtp.closed, 1);
    assert.equal(scenario.fetchMock.mock.callCount(), 0);
    const unauthorized = await scenario.run('?verify=1', 'Bearer invalid');
    assert.equal(unauthorized.statusCode, 401); assert.equal(scenario.smtp.verifications, 1);
  });
  for (const [label, code, reason] of connectionFailures) {
    test(`${route} returns a safe 503 reason for ${label} before cleanup or claims`, async (context) => {
      const scenario = await handlerScenario(context, route, { verifyError: privateConnectionError(code) });
      for (const query of ['', '?verify=1']) {
        const response = await scenario.run(query);
        assert.equal(response.statusCode, 503);
        assert.deepEqual(response.body, { error: new GmailConnectionError(reason).message, reason });
        assert.doesNotMatch(JSON.stringify(response.body), /private SMTP|credentials and recipient|abcdefghijklmnop/);
      }
      assert.equal(scenario.smtp.closed, 2);
      assert.equal(scenario.fetchMock.mock.callCount(), 0);
      assert.equal(scenario.smtp.messages.length, 0);
    });
  }
  test(`${route} sends Gmail HTML and CSV/PDF attachments then records accepted delivery before its log`, async (context) => {
    const scenario = await handlerScenario(context, route);
    const response = await scenario.run();
    assert.equal(response.statusCode, 200); assert.equal(response.body.sent, 1); assert.equal(response.body.failed, 0); assert.equal(response.body.deliveryUncertain, 0);
    const message = scenario.smtp.messages[0];
    assert.deepEqual(message.from, { name: 'PennyWize', address: 'gapisgod@gmail.com' }); assert.equal(message.to, recipient);
    assert.ok(message.html.includes('Fictional Test Recipient')); assert.ok(message.html.includes('Review spending.'));
    assert.equal(message.subject, route === 'send-digest' ? 'Your Weekly Financial Digest' : 'Your Monthly Financial Digest');
    const csv = message.attachments.find(({ filename }) => filename === 'history.csv');
    assert.equal(csv.contentType, 'text/csv'); assert.match(csv.content, /income/);
    const pdf = message.attachments.find(({ filename }) => filename === 'digest.pdf');
    assert.equal(pdf.contentType, 'application/pdf'); assert.ok(Buffer.isBuffer(pdf.content)); assert.equal(pdf.content.subarray(0, 4).toString(), '%PDF');
    assert.deepEqual(scenario.state.events, ['smtp_verify', 'cleanup', 'claim', 'smtp_send', 'mark_sent', 'email_log']);
    assert.equal(scenario.state.emailLogs[0].metadata.provider, 'gmail'); assert.equal(scenario.state.emailLogs[0].metadata.messageId, message.messageId);
    assert.equal(scenario.smtp.closed, 1);
  });
  test(`${route} uncertain DATA timeout leaves claim running and skips the next invocation`, async (context) => {
    const scenario = await handlerScenario(context, route, { sendError: smtpError('ETIMEDOUT', 'DATA') });
    const response = await scenario.run();
    assert.equal(response.body.sent, 0); assert.equal(response.body.failed, 0); assert.equal(response.body.deliveryUncertain, 1);
    assert.equal(scenario.state.delivery, 'running'); assert.equal(scenario.state.statusWrites[0].last_error, 'delivery_outcome_unknown'); assert.equal(scenario.state.statusWrites[0].completed_at, null);
    const repeated = await scenario.run();
    assert.equal(repeated.body.duplicatesSkipped, 1); assert.equal(scenario.smtp.messages.length, 1);
    assert.doesNotMatch(JSON.stringify(scenario.errorLog.mock.calls), /private SMTP diagnostic/);
  });
  test(`${route} definite SMTP rejection is retryable while raw diagnostics remain private`, async (context) => {
    const scenario = await handlerScenario(context, route, { sendError: smtpError('EENVELOPE', 'RCPT TO', 550) });
    const response = await scenario.run();
    assert.equal(response.body.failed, 1); assert.equal(response.body.deliveryUncertain, 0); assert.equal(scenario.state.delivery, 'failed');
    await scenario.run(); assert.equal(scenario.smtp.messages.length, 2);
    assert.ok(scenario.state.statusWrites.every(({ last_error }) => last_error === 'delivery_failed'));
    assert.doesNotMatch(JSON.stringify(scenario.errorLog.mock.calls), /private SMTP diagnostic/);
  });
  test(`${route} pre-send failure remains retryable without sending an email`, async (context) => {
    const scenario = await handlerScenario(context, route, { historyError: true });
    const response = await scenario.run();
    assert.equal(response.body.failed, 1); assert.equal(response.body.deliveryUncertain, 0); assert.equal(scenario.state.delivery, 'failed'); assert.equal(scenario.smtp.messages.length, 0);
    scenario.state.historyError = false;
    const retried = await scenario.run(); assert.equal(retried.body.sent, 1); assert.equal(scenario.smtp.messages.length, 1);
  });
  for (const failedWrite of ['statusWriteError', 'emailLogError']) {
    test(`${route} SMTP acceptance followed by ${failedWrite} never permits another send`, async (context) => {
      const scenario = await handlerScenario(context, route, { [failedWrite]: true });
      const response = await scenario.run();
      assert.equal(response.body.sent, 1); assert.equal(response.body.failed, 0); assert.equal(response.body.deliveryUncertain, 0);
      assert.ok(scenario.state.statusWrites.every(({ status }) => status === 'sent'));
      assert.equal(scenario.state.delivery, failedWrite === 'statusWriteError' ? 'running' : 'sent');
      const repeated = await scenario.run();
      assert.equal(repeated.body.duplicatesSkipped, 1); assert.equal(scenario.smtp.messages.length, 1);
    });
  }
}
