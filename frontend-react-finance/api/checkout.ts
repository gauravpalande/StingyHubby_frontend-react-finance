// /api/checkout.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-08-27.basil' });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { userId, email } = req.body as { userId: string; email: string };
    if (!userId || !email) return res.status(400).json({ error: 'Missing userId/email' });

    // Ensure Stripe customer exists (idempotent)
    const { data: u } = await supabase.from('users').select('stripe_customer_id').eq('id', userId).single();
    let customerId = u?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;
      await supabase.from('users').update({ stripe_customer_id: customerId }).eq('id', userId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID_099!, quantity: 1 }],
      success_url: `${req.headers.origin}/app/preferences?upgrade=success`,
      cancel_url: `${req.headers.origin}/app/preferences?upgrade=cancelled`,
      metadata: { supabase_user_id: userId },
      allow_promotion_codes: true,
    });

    return res.status(200).json({ url: session.url });
  } catch (e: any) {
    console.error('Checkout error', e.message);
    return res.status(500).json({ error: 'Checkout failed' });
  }
}
