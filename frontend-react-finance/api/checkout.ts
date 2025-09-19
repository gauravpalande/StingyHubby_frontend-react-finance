// /api/checkout.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// --- Helpers ---
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getOrigin(req: VercelRequest): string {
  // Prefer explicit env if you set it (recommended on Vercel)
  const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (site) return site.replace(/\/$/, '');

  // Fallbacks from headers
  const fromHeader =
    (req.headers['origin'] as string | undefined) ||
    (req.headers['referer'] as string | undefined) ||
    '';
  if (fromHeader) {
    try {
      const u = new URL(fromHeader);
      return `${u.protocol}//${u.host}`;
    } catch {
      /* ignore */
    }
  }
  // Last resort (localhost dev default)
  return 'http://localhost:3000';
}

// --- Lazy singletons (avoid init at build time) ---
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = requireEnv('STRIPE_SECRET_KEY'); // sk_...
    _stripe = new Stripe(key, {
      // ✅ Use a valid, stable API version
      apiVersion: '2025-08-27.basil',
    });
    console.log(
      '[checkout] Stripe initialized (region=%s)',
      process.env.VERCEL_REGION || 'unknown'
    );
  }
  return _stripe;
}

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = requireEnv('SUPABASE_URL');
    const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY'); // server-only
    _supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
    console.log('[checkout] Supabase client initialized');
  }
  return _supabase;
}

// --- Handler ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate inputs
    const { userId, email } = (req.body ?? {}) as { userId?: string; email?: string };
    if (!userId || !email) {
      return res.status(400).json({ error: 'Missing userId/email' });
    }

    const stripePriceId = requireEnv('STRIPE_PRICE_ID_099'); // price_xxx from Stripe
    const origin = getOrigin(req);

    const supabase = getSupabase();
    const stripe = getStripe();

    // Get or create Stripe customer (idempotent)
    const { data: u, error: userFetchErr } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (userFetchErr) {
      console.error('[checkout] Supabase select error:', userFetchErr);
      return res.status(500).json({ error: 'Failed to fetch user' });
    }

    let customerId = u?.stripe_customer_id as string | undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;
      const { error: updateErr } = await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);

      if (updateErr) {
        console.error('[checkout] Supabase update error:', updateErr);
        // Not fatal for checkout session creation
      }
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${origin}/app/preferences?upgrade=success`,
      cancel_url: `${origin}/app/preferences?upgrade=cancelled`,
      metadata: { supabase_user_id: userId },
      allow_promotion_codes: true,
      locale: 'en', // ✅ Prevents dynamic './en' fetch error
    });

    if (!session.url) {
      console.error('[checkout] No session URL returned from Stripe');
      return res.status(500).json({ error: 'Stripe session did not return a URL' });
    }

    return res.status(200).json({ url: session.url });
  } catch (e: any) {
    console.error('[checkout] Error:', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Checkout failed' });
  }
}
