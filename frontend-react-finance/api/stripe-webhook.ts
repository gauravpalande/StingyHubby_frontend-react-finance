// /api/stripe-webhook.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } }; // raw body needed

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-08-27.basil' });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function buffer(readable: any) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of readable) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const sig = req.headers['stripe-signature']!;
  const buf = await buffer(req);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const subId = s.subscription as string | undefined;
        const custId = s.customer as string | undefined;
        const userId = (s.metadata?.supabase_user_id as string) || undefined;

        if (userId && subId && custId) {
          const subscriptionResponse = await stripe.subscriptions.retrieve(subId);
          const subscription = subscriptionResponse as Stripe.Subscription;
          await supabase.from('users').update({
            stripe_subscription_id: subId,
            stripe_customer_id: custId,
            stripe_price_id: subscription.items.data[0]?.price.id ?? null,
            stripe_status: subscription.status,
            current_period_end: subscription && 'current_period_end' in subscription
              ? new Date((subscription as any).current_period_end * 1000).toISOString()
              : null,
            paid_user: ['active', 'trialing', 'past_due'].includes(subscription.status), // keep bool in sync
          }).eq('id', userId);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const custId = sub.customer as string;

        // Find Supabase user by customer id
        const { data: rows } = await supabase.from('users').select('id').eq('stripe_customer_id', custId).limit(1);
        const userId = rows?.[0]?.id;
        if (userId) {
          await supabase.from('users').update({
            stripe_subscription_id: sub.id,
            stripe_price_id: sub.items.data[0]?.price.id ?? null,
            stripe_status: sub.status,
            current_period_end: 'current_period_end' in sub
              ? new Date((sub as any).current_period_end * 1000).toISOString()
              : null,
            paid_user: ['active', 'trialing', 'past_due'].includes(sub.status),
          }).eq('id', userId);
        }
        break;
      }
      default:
        // no-op
        break;
    }

    return res.json({ received: true });
  } catch (e: any) {
    console.error('Webhook handling error', e.message);
    return res.status(500).json({ error: 'Webhook failed' });
  }
}
