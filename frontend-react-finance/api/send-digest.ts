import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("📩 Digest handler started");

  try {
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('wants_digest', true);

    if (userError || !users) {
      console.error("❌ Error fetching users:", userError?.message);
      return res.status(500).json({ error: userError?.message || 'No users found' });
    }

    for (const user of users) {
      const { data: history, error: historyError } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (historyError || !history || history.length === 0) continue;

      const totalIncome = history.reduce((sum, row) => sum + (row.income || 0), 0);
      const totalExpenses = history.reduce(
        (sum, row) =>
          sum + (row.mortgage || 0) + (row.utilities || 0) + (row.carPayments || 0),
        0
      );
      const savings = totalIncome - totalExpenses;

      const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({
        type: 'bar',
        data: {
          labels: history.map(row => new Date(row.created_at).toLocaleDateString()),
          datasets: [
            {
              label: 'Income',
              data: history.map(row => row.income || 0),
              backgroundColor: 'rgba(54, 162, 235, 0.6)'
            },
            {
              label: 'Expenses',
              data: history.map(row =>
                (row.mortgage || 0) + (row.utilities || 0) + (row.carPayments || 0)
              ),
              backgroundColor: 'rgba(255, 99, 132, 0.6)'
            }
          ]
        }
      }))}`;

      function convertToCSV(rows: any[]): string {
        if (!rows.length) return '';

        const headers = Object.keys(rows[0]);
        const escape = (value: any) => `"${String(value).replace(/"/g, '""')}"`;

        const headerLine = headers.join(',');
        const lines = rows.map(row => headers.map(h => escape(row[h])).join(','));

        return [headerLine, ...lines].join('\n');
      }

      const csvContent = convertToCSV(history);

      const aiTips = `💡 AI Tip: Consider reducing discretionary expenses next month to increase savings.`;

      const htmlContent = `
        <div style="font-family: sans-serif">
          <p>Hi ${user.name || user.email},</p>
          <p>Here’s your weekly financial digest:</p>
          <ul>
            <li><strong>📥 Total Income:</strong> $${totalIncome.toFixed(2)}</li>
            <li><strong>💸 Total Expenses:</strong> $${totalExpenses.toFixed(2)}</li>
            <li><strong>💰 Estimated Savings:</strong> $${savings.toFixed(2)}</li>
          </ul>
          <p><img src="${chartUrl}" alt="Financial Chart" /></p>
          <p>${aiTips}</p>
          <p><small>To unsubscribe, update your preferences at stingyhubby.com.</small></p>
        </div>
      `;

      try {
        const response = await resend.emails.send({
          from: 'digest@stingyhubby.xyz',
          to: user.email,
          subject: 'Your Weekly Financial Digest',
          html: htmlContent,
          attachments: [
            {
              filename: 'history.csv',
              content: csvContent,
            }
          ]
        });

        await supabase.from('email_logs').insert({
          user_id: user.id,
          email: user.email,
          status: 'sent',
          metadata: JSON.stringify(response),
        });

        console.log(`✅ Sent email to ${user.email}`);
      } catch (emailError) {
        console.error(`❌ Failed to send email to ${user.email}:`, emailError);
      }
    }

    return res.status(200).json({ message: 'Digest emails sent successfully' });
  } catch (err: any) {
    console.error("💥 Unhandled error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
