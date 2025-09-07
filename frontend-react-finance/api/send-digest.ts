import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('📩 Digest handler started');

  try {
    // ✅ 1) Get users who opted in to weekly digest
    const { data: prefs, error: prefError } = await supabase
      .from('preferences')
      .select('user_id')
      .eq('email_weekly_digest', true);

    if (prefError) {
      console.error('❌ Error fetching preferences:', prefError.message);
      return res.status(500).json({ error: prefError.message });
    }

    if (!prefs?.length) {
      console.log('ℹ️ No opted-in users found.');
      return res.status(200).json({ message: 'No opted-in users' });
    }

    const userIds = prefs.map((p) => p.user_id);

    // ✅ 2) Fetch matching users including paid flag
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, name, paid_user')
      .in('id', userIds);

    if (userError || !users?.length) {
      console.error('❌ Error fetching users:', userError?.message);
      return res
        .status(500)
        .json({ error: userError?.message || 'No users found' });
    }

    // Helper: basic CSV from rows
    function convertToCSV(rows: Record<string, unknown>[]): string {
      if (!rows.length) return '';
      const headers = Object.keys(rows[0]);
      const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const headerLine = headers.join(',');
      const lines = rows.map((row) => headers.map((h) => escape(row[h])).join(','));
      return [headerLine, ...lines].join('\n');
    }

    // ✅ 3) Loop through users and send digests
    for (const user of users) {
      // Pull the 10 most recent entries
      const { data: history, error: historyError } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (historyError) {
        console.error(`❌ History fetch error for ${user.email}:`, historyError.message);
        continue;
      }
      if (!history || history.length === 0) {
        console.log(`ℹ️ No history for ${user.email}, skipping.`);
        continue;
      }

      // Metrics
      const totalIncome = history.reduce((sum, row) => sum + (row.income || 0), 0);
      const totalExpenses = history.reduce(
        (sum, row) =>
          sum +
          (row.mortgage || 0) +
          (row.utilities || 0) +
          (row.carPayments || 0) +
          (row.creditCards || 0),
        0
      );
      const savings = totalIncome - totalExpenses;

      // Chart
      const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(
        JSON.stringify({
          type: 'bar',
          data: {
            labels: history
              .slice() // clone
              .reverse() // show oldest->newest left->right
              .map((row) => new Date(row.created_at).toLocaleDateString()),
            datasets: [
              {
                label: 'Income',
                data: history
                  .slice()
                  .reverse()
                  .map((row) => row.income || 0),
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
              },
              {
                label: 'Expenses',
                data: history
                  .slice()
                  .reverse()
                  .map(
                    (row) =>
                      (row.mortgage || 0) +
                      (row.utilities || 0) +
                      (row.carPayments || 0) +
                      (row.creditCards || 0)
                  ),
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
              },
            ],
          },
        })
      )}`;

      // ✅ Suggestions block (paid vs free)
      let suggestionHTML = '';
      if (user.paid_user) {
        const latest = history[0];
        const st = latest?.short_term_suggestion?.trim();
        const lt = latest?.long_term_suggestion?.trim();
        const goal = latest?.goal_suggestion?.trim();

        const STAITips = st
          ? `💡 Short Term AI Tip: ${st}`
          : `💡 Short Term AI Tip: Consider reducing discretionary expenses next month to increase savings.`;
        const LTAITips = lt
          ? `💡 Long Term AI Tip: ${lt}`
          : `💡 Long Term AI Tip: Consider contributing more towards your retirement savings.`;
        const GoalAITips = goal
          ? `💡 Goal AI Tip: ${goal}`
          : `💡 Goal AI Tip: Consider contributing more towards your goals.`;

        suggestionHTML = `<p>${STAITips}</p><p>${LTAITips}</p><p>${GoalAITips}</p>`;
      } else {
        const latest = history[0];
        const one = latest?.oneline_suggestion?.trim();
        const oneLineTip = one
          ? `💡 AI Tip: ${one}`
          : `💡 AI Tip: Keep tracking your finances to get personalized insights.`;
        suggestionHTML = `<p>${oneLineTip}</p>`;
      }

      // Email HTML
      const displayName = user.name || user.email;
      const htmlContent = `
        <div style="font-family: sans-serif">
          <p>Hi ${displayName},</p>
          <p>Here’s your weekly financial digest:</p>
          <ul>
            <li><strong>📥 Total Income:</strong> $${totalIncome.toFixed(2)}</li>
            <li><strong>💸 Total Expenses:</strong> $${totalExpenses.toFixed(2)}</li>
            <li><strong>💰 Estimated Savings:</strong> $${savings.toFixed(2)}</li>
          </ul>
          <p><img src="${chartUrl}" alt="Financial Chart" /></p>
          ${suggestionHTML}
          <p><small>To unsubscribe, update your preferences at https://pennywize.vercel.app/.</small></p>
        </div>
      `;

      // ✅ Attach CSV only for paid users (keep exports premium)
      const attachments = user.paid_user
        ? [
            {
              filename: 'history.csv',
              content: convertToCSV(history),
            },
          ]
        : undefined;

      try {
        const response = await resend.emails.send({
          from: 'digest@stingyhubby.xyz',
          to: user.email,
          subject: 'Your Weekly Financial Digest',
          html: htmlContent,
          ...(attachments ? { attachments } : {}),
        });

        // ⬇️ Minimal change: store only the message ID (clean string) in metadata
        await supabase.from('email_logs').insert({
          user_id: user.id,
          email: user.email,
          status: 'sent',
          metadata: response?.data?.id ?? null, // was: JSON.stringify(response)
        });

        console.log(`✅ Sent email to ${user.email}`);
      } catch (emailError) {
        console.error(`❌ Failed to send email to ${user.email}:`, emailError);
      }
    }

    return res.status(200).json({ message: 'Digest emails sent successfully' });
  } catch (err: unknown) {
    const errorMessage =
      typeof err === 'object' && err !== null && 'message' in err
        ? (err as { message: string }).message
        : String(err);
    console.error('💥 Unhandled error:', errorMessage);
    return res.status(500).json({ error: errorMessage });
  }
}
