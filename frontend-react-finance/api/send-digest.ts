import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("📩 Digest handler started");

  try {
    const { data: users, error: userError } = await supabase
      .from('submissions')
      .select('user_id, email')
      .neq('email', null);

    if (userError) {
      console.error("❌ Error fetching users:", userError.message);
      return res.status(500).json({ error: userError.message });
    }

    if (!users || users.length === 0) {
      console.warn("⚠️ No users found");
      return res.status(200).json({ message: "No users to process" });
    }

    for (const user of users) {
      const { data: history, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error || !history || history.length === 0) {
        console.warn(`⚠️ Skipping user ${user.email} due to no data`);
        continue;
      }

      const totalIncome = history.reduce((sum, row) => sum + (row.income || 0), 0);
      const totalExpenses = history.reduce((sum, row) =>
        sum + (row.mortgage || 0) + (row.utilities || 0) + (row.carPayments || 0), 0);
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

      try {
        await resend.emails.send({
          from: 'digest@stingyhubby.com',
          to: user.email,
          subject: 'Your Weekly Financial Digest',
          text: summaryText,
        });
        console.log(`✅ Sent email to ${user.email}`);
      } catch (emailError) {
        console.error(`❌ Failed to send email to ${user.email}:`, emailError);
      }
    }

    return res.status(200).json({ message: 'Digest emails processed.' });
  } catch (err: any) {
    console.error("💥 Unhandled exception:", err.message);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
