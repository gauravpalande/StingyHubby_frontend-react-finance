// /api/portal.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-08-27.basil' });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { userId } = req.body as { userId: string };
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const { data: u, error } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (error || !u?.stripe_customer_id) return res.status(400).json({ error: 'No Stripe customer' });

    const session = await stripe.billingPortal.sessions.create({
      customer: u.stripe_customer_id,
      return_url: `${req.headers.origin}/app/preferences`,
    });

    return res.status(200).json({ url: session.url });
  } catch (e: any) {
    console.error('Portal error', e.message);
    return res.status(500).json({ error: 'Portal failed' });
  }
}
