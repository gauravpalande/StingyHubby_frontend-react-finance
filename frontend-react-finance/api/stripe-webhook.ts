// /api/stripe-webhook.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import type { Readable } from 'node:stream';

export const config = { api: { bodyParser: false } }; // raw body needed

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-08-27.basil' });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const MAX_WEBHOOK_BYTES = 1_000_000;

async function buffer(readable: Readable) {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for await (const chunk of readable) {
    const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk);
    totalBytes += bytes.length;
    if (totalBytes > MAX_WEBHOOK_BYTES) throw new Error('Webhook payload is too large');
    chunks.push(bytes);
  }

  return Buffer.concat(chunks);
}

function getCurrentPeriodEnd(subscription: Stripe.Subscription) {
  const value = (subscription as Stripe.Subscription & { current_period_end?: number })
    .current_period_end;
  return typeof value === 'number' ? new Date(value * 1000).toISOString() : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const signatureHeader = req.headers['stripe-signature'];
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (!signature) return res.status(400).send('Missing Stripe signature');

  const contentLengthHeader = req.headers['content-length'];
  const contentLength = Number(Array.isArray(contentLengthHeader) ? contentLengthHeader[0] : contentLengthHeader);
  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BYTES) {
    return res.status(413).send('Webhook payload is too large');
  }

  let payload: Buffer;
  try {
    payload = await buffer(req);
  } catch {
    return res.status(413).send('Webhook payload is too large');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return res.status(400).send('Webhook signature verification failed');
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
            current_period_end: getCurrentPeriodEnd(subscription),
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
            current_period_end: getCurrentPeriodEnd(sub),
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown webhook error';
    console.error('Webhook handling error', message);
    return res.status(500).json({ error: 'Webhook failed' });
  }
}
