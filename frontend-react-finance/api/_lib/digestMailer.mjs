import { createHash } from 'node:crypto';
import nodemailer from 'nodemailer';
import { z } from 'zod';

export const GMAIL_SENDER_EMAIL = 'gapisgod@gmail.com';
export const GMAIL_CONFIGURATION_ERROR =
  'Set GMAIL_APP_PASSWORD to the Google App Password for gapisgod@gmail.com.';

export class GmailConfigurationError extends Error {
  constructor() { super(GMAIL_CONFIGURATION_ERROR); }
}

export class GmailConnectionError extends Error {
  constructor(reason = 'gmail_connection_failed') {
    super(reason === 'gmail_authentication_failed'
      ? 'Google rejected the Gmail login. Set GMAIL_APP_PASSWORD to an App Password created while signed into gapisgod@gmail.com.'
      : reason === 'gmail_connection_timeout'
        ? 'The connection to Gmail timed out. Please try again.'
        : 'Could not connect to Gmail. Check connectivity and the Google account security settings.');
    this.reason = reason;
  }
}

export class GmailDeliveryError extends Error {
  constructor({ uncertain, reason }) {
    super(uncertain
      ? 'Gmail delivery could not be confirmed. Automatic retry is blocked to prevent duplicate emails.'
      : 'Gmail did not accept the email. The delivery can be retried.');
    this.uncertain = uncertain;
    this.reason = reason;
  }
}

const recipientSchema = z.string().trim().email().max(254);

function gmailDeliveryError(error) {
  // A lost connection after DATA may mean the email was accepted. Only explicit
  // rejections or errors known to precede submission are safe to retry.
  const rejected = Number.isInteger(error?.responseCode) &&
    error.responseCode >= 400 && error.responseCode <= 599 &&
    /^(?:AUTH\b|MAIL FROM\b|RCPT TO\b|DATA$)/.test(error?.command || '');
  const beforeSubmission = ['EAUTH', 'ENOAUTH', 'EENVELOPE', 'EDNS', 'ECONFIG'].includes(error?.code);
  return new GmailDeliveryError({
    uncertain: !rejected && !beforeSubmission,
    reason: rejected || beforeSubmission ? 'gmail_rejected' : 'delivery_outcome_unknown',
  });
}

export function createDigestMailer() {
  const password = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
  if (!/^[a-zA-Z0-9]{16}$/.test(password)) throw new GmailConfigurationError();

  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    pool: false,
    auth: { user: GMAIL_SENDER_EMAIL, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 5_000,
    socketTimeout: 20_000,
    dnsTimeout: 5_000,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  });

  return {
    async verify() {
      try {
        await transport.verify();
      } catch (error) {
        // Classify only bounded error codes; raw SMTP responses can contain
        // account or authentication details and must not be returned or logged.
        throw new GmailConnectionError(error?.code === 'EAUTH'
          ? 'gmail_authentication_failed'
          : error?.code === 'ETIMEDOUT' ? 'gmail_connection_timeout' : 'gmail_connection_failed');
      }
    },
    async sendMail({ to, subject, html, attachments = [], deliveryKey }) {
      const recipient = recipientSchema.safeParse(to);
      if (!recipient.success) {
        throw new GmailDeliveryError({ uncertain: false, reason: 'invalid_recipient' });
      }

      let result;
      try {
        result = await transport.sendMail({
          from: { name: 'PennyWize', address: GMAIL_SENDER_EMAIL },
          to: recipient.data,
          subject,
          html,
          attachments,
          // This is a tracing identifier; Gmail does not guarantee deduplication.
          messageId: `<pennywize-${createHash('sha256').update(deliveryKey).digest('hex')}@gmail.com>`,
        });
      } catch (error) {
        throw gmailDeliveryError(error);
      }

      if (!result?.accepted?.some((address) =>
        typeof address === 'string' && address.toLowerCase() === recipient.data.toLowerCase()
      )) {
        throw new GmailDeliveryError({
          uncertain: !result?.rejected?.length,
          reason: result?.rejected?.length ? 'gmail_rejected' : 'delivery_outcome_unknown',
        });
      }
      return { messageId: result.messageId };
    },
    close() { transport.close(); },
  };
}
