import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import {
  enforceRateLimits,
  getClientFingerprint,
  RateLimitExceededError,
  RateLimitUnavailableError,
  type RateLimitRule,
} from './_lib/rateLimit.js';

class PortalError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
  }
}

let stripe: Stripe | null = null;
let supabase: SupabaseClient | null = null;

function requireEnvironmentVariable(name: string) {
  const value = process.env[name];
  if (!value) throw new PortalError('Billing management is temporarily unavailable.', 503);
  return value;
}

function getStripe() {
  if (!stripe) {
    stripe = new Stripe(requireEnvironmentVariable('STRIPE_SECRET_KEY'), {
      apiVersion: '2025-08-27.basil',
      maxNetworkRetries: 0,
      timeout: 10_000,
    });
  }
  return stripe;
}

function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      requireEnvironmentVariable('SUPABASE_URL'),
      requireEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } }
    );
  }
  return supabase;
}

function getBearerToken(req: VercelRequest) {
  const header = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization;
  return header?.match(/^Bearer\s+(.+)$/i)?.[1];
}

async function requireAuthenticatedUser(req: VercelRequest) {
  const token = getBearerToken(req);
  if (!token || token.length > 4096 || token.split('.').length !== 3) {
    throw new PortalError('You must be logged in to manage billing.', 401);
  }

  const {
    data: { user },
    error,
  } = await getSupabase().auth.getUser(token);

  if (error || !user) throw new PortalError('Your session has expired. Please sign in again.', 401);
  return user;
}

function getReturnUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (!siteUrl) throw new PortalError('Billing management is temporarily unavailable.', 503);

  const url = new URL('/app/preferences', siteUrl);
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new PortalError('Billing management is temporarily unavailable.', 503);
  }

  return url.toString();
}

function buildPortalRateLimits(req: VercelRequest, userId: string): RateLimitRule[] {
  const fingerprint = getClientFingerprint(req);
  const rules: RateLimitRule[] = [
    { key: `billing-portal:user:${userId}:hour`, limit: 5, windowSeconds: 60 * 60 },
  ];

  if (fingerprint) {
    rules.push({
      key: `billing-portal:ip:${fingerprint}:hour`,
      limit: 20,
      windowSeconds: 60 * 60,
    });
  }

  rules.push({ key: 'billing-portal:global:day', limit: 200, windowSeconds: 24 * 60 * 60 });
  return rules;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuthenticatedUser(req);
    await enforceRateLimits(getSupabase(), buildPortalRateLimits(req, user.id));

    const { data: billingUser, error } = await getSupabase()
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw new PortalError('Unable to load billing information.', 500);
    if (!billingUser?.stripe_customer_id) {
      throw new PortalError('No Stripe customer exists for this account.', 404);
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: billingUser.stripe_customer_id,
      return_url: getReturnUrl(),
    });

    return res.status(200).json({ url: session.url });
  } catch (error: unknown) {
    const statusCode = error instanceof PortalError
      ? error.statusCode
      : error instanceof RateLimitExceededError || error instanceof RateLimitUnavailableError
        ? error.statusCode
        : 500;
    const message = error instanceof Error ? error.message : 'Billing portal failed.';

    if (error instanceof RateLimitExceededError) {
      res.setHeader('Retry-After', String(error.retryAfterSeconds));
    }

    if (statusCode >= 500) console.error('[billing-portal] Error:', message);
    return res.status(statusCode).json({
      error: statusCode >= 500 ? 'Billing management is temporarily unavailable.' : message,
    });
  }
}
