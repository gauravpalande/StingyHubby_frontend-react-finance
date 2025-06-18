export const config = {
  runtime: 'nodejs',
};

// api/send-digest.ts
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Setup clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Get users with email (and optionally wants_digest = true)
    const { data: users, error: userError } = await supabase
      .from('submissions')
      .select('user_id, email')
      .neq('email', null);

    if (userError || !users) {
      return res.status(500).json({ error: userError?.message || 'No users found' });
    }

    // Loop over each user
    for (const user of users) {
      const { data: history, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error || !history || history.length === 0) continue;

      const totalIncome = history.reduce((sum, row) => sum + (row.income || 0), 0);
      const totalExpenses = history.reduce(
        (sum, row) =>
          sum +
          (row.mortgage || 0) +
          (row.utilities || 0) +
          (row.carPayments || 0),
        0
      );
      const savings = totalIncome - totalExpenses;

      const summaryText = `
Hi ${user.email},

Here's your weekly financial digest from StingyHubby:

📥 Total Income: $${totalIncome.toFixed(2)}
💸 Total Expenses: $${totalExpenses.toFixed(2)}
💰 Estimated Savings: $${savings.toFixed(2)}

Stay stingy. Stay smart.
— StingyHubby Team
      `.trim();

      // Send email
      await resend.emails.send({
        from: 'digest@stingyhubby.com',
        to: user.email,
        subject: 'Your Weekly Financial Digest',
        text: summaryText
      });
    }

    return res.status(200).json({ message: 'Emails sent successfully' });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}
