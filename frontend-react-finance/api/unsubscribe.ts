import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../src/supabaseClient';

module.exports = async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = req.query.user as string;

  if (!userId) {
    return res.status(400).send('Missing user id');
  }

  const { error } = await supabase
    .from("users")
    .update({ wants_digest: false })
    .eq("id", userId);

  if (error) {
    return res.status(500).send(error.message);
  }

  res.setHeader("Content-Type", "text/html");
  return res.status(200).send(`
    <html>
      <body style="font-family: sans-serif; padding: 40px;">
        <h2>You have been unsubscribed</h2>
        <p>You will no longer receive the weekly PennyWize digest.</p>
      </body>
    </html>
  `);
};
