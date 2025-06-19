import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("📩 Digest handler started");

  try {
    // ✅ Join submissions with users to fetch email
    type SubmissionRow = {
      user_id: string;
      users: { email: string }[] | { email: string } | null;
    };

    const { data: submissions, error: userError } = await supabase
      .from('submissions')
      .select('user_id, users(email)')
      .neq('users.email', null);

    if (userError) {
      console.error("❌ Error fetching users:", userError.message);
      return res.status(500).json({ error: userError.message });
    }

    if (!submissions || submissions.length === 0) {
      console.warn("⚠️ No users found");
      return res.status(200).json({ message: "No users to process" });
    }

    // ✅ Extract unique user_id → email map
    const usersMap = new Map<string, string>();
    for (const row of submissions as SubmissionRow[]) {
      const userId = row.user_id;
      let email: string | undefined;
      if (Array.isArray(row.users)) {
        email = row.users[0]?.email;
      } else if (row.users && typeof row.users === 'object') {
        email = row.users.email;
      }

      if (userId && email && !usersMap.has(userId)) {
        usersMap.set(userId, email);
      }
    }

    // ✅ Send digest to each user
    for (const [userId, email] of usersMap.entries()) {
      const { data: history, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error || !history || history.length === 0) {
        console.warn(`⚠️ Skipping user ${email} due to no submission data`);
        continue;
      }

      const totalIncome = history.reduce((sum, row) => sum + (row.income || 0), 0);
      const totalExpenses = history.reduce(
        (sum, row) =>
          sum + (row.mortgage || 0) + (row.utilities || 0) + (row.carPayments || 0),
        0
      );
      const savings = totalIncome - totalExpenses;

      const summaryText = `
Hi ${email},

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
          to: email,
          subject: 'Your Weekly Financial Digest',
          text: summaryText,
        });
        console.log(`✅ Sent email to ${email}`);
      } catch (emailError) {
        console.error(`❌ Failed to send email to ${email}:`, emailError);
      }
    }

    return res.status(200).json({ message: 'Digest emails processed.' });
  } catch (err: any) {
    console.error("💥 Unhandled exception:", err.message);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
