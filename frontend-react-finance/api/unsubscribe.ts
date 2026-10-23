import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUnsubscribeToken } from './_lib/unsubscribeToken.mjs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method not allowed');
  }
  const secret = process.env.UNSUBSCRIBE_SIGNING_SECRET;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || secret.length < 32 || !url || !serviceKey) {
    return res.status(503).send('Unsubscribe temporarily unavailable');
  }
  const userId = verifyUnsubscribeToken(req.query.token, secret);
  if (!userId) return res.status(400).send('Invalid or expired unsubscribe link');
  try {
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await supabase.from('preferences').update({ email_weekly_digest: false }).eq('user_id', userId);
    if (error) throw error;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send('<!doctype html><html><body><h2>Unsubscribed</h2><p>You will no longer receive the weekly PennyWize digest.</p></body></html>');
  } catch (error) {
    console.error('[unsubscribe] preference update failed', error instanceof Error ? error.message : 'unknown error');
    return res.status(500).send('Unable to unsubscribe right now');
  }
}
