import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';

type RateLimitResult = {
  allowed: boolean;
  retry_after_seconds: number;
};

export type RateLimitRule = {
  key: string;
  limit: number;
  windowSeconds: number;
};

export class RateLimitExceededError extends Error {
  readonly statusCode = 429;

  constructor(public readonly retryAfterSeconds: number) {
    super('Too many requests. Please wait before trying again.');
  }
}

export class RateLimitUnavailableError extends Error {
  readonly statusCode = 503;

  constructor() {
    super('Request protection is temporarily unavailable. Please try again later.');
  }
}

function firstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function getClientFingerprint(req: VercelRequest) {
  const forwardedFor = firstHeaderValue(req.headers['x-forwarded-for']);
  const realIp = firstHeaderValue(req.headers['x-real-ip']);
  const address = forwardedFor?.split(',')[0]?.trim() || realIp?.trim();

  if (!address) return null;

  return createHash('sha256').update(address).digest('hex').slice(0, 32);
}

function parseRateLimitResult(data: unknown): RateLimitResult | null {
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null;

  const response = result as Record<string, unknown>;
  if (typeof response.allowed !== 'boolean') return null;

  if (response.allowed) {
    return { allowed: true, retry_after_seconds: 0 };
  }

  const retryAfterSeconds = response.retry_after_seconds;
  if (!Number.isSafeInteger(retryAfterSeconds) || (retryAfterSeconds as number) < 1) {
    return null;
  }

  return { allowed: false, retry_after_seconds: retryAfterSeconds as number };
}

export async function enforceRateLimits(
  supabase: SupabaseClient,
  rules: RateLimitRule[]
) {
  for (const rule of rules) {
    const { data, error } = await supabase.rpc('consume_api_rate_limit', {
      p_key: rule.key,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });

    if (error) {
      console.error('[rate-limit] Counter request failed');
      throw new RateLimitUnavailableError();
    }

    const result = parseRateLimitResult(data);
    if (!result) {
      console.error('[rate-limit] Counter returned an invalid response');
      throw new RateLimitUnavailableError();
    }

    if (!result.allowed) {
      throw new RateLimitExceededError(result.retry_after_seconds);
    }
  }
}
