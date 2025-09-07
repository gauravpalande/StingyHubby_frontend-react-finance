import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

// --- Minimal inline PDF generator (one page, Helvetica) ---
function escapePdfText(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
function makeDigestPdf(params: {
  title: string;
  totalIncome: number;
  totalExpenses: number;
  savings: number;
  dates: string[];
}) {
  const { title, totalIncome, totalExpenses, savings, dates } = params;

  const lines = [
    title,
    '',
    `Total Income: $${totalIncome.toFixed(2)}`,
    `Total Expenses: $${totalExpenses.toFixed(2)}`,
    `Estimated Savings: $${savings.toFixed(2)}`,
    '',
    'Included Dates:',
    ...dates.map((d) => `- ${d}`),
  ].map(escapePdfText);

  const content =
    'BT\n' +
    '/F1 18 Tf\n' +
    '72 760 Td\n' +
    `(${lines[0] || ''}) Tj\n` +
    '/F1 12 Tf\n' +
    lines.slice(1).map(() => '0 -18 Td').join('\n') +
    '\n' +
    lines.slice(1).map((t) => `(${t}) Tj`).join('\n') +
    '\nET';

  const objects: string[] = [];
  objects[1] = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  objects[2] = '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n';
  objects[3] =
    '3 0 obj\n' +
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]\n' +
    '   /Resources << /Font << /F1 4 0 R >> >>\n' +
    '   /Contents 5 0 R >>\n' +
    'endobj\n';
  objects[4] =
    '4 0 obj\n' +
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n' +
    'endobj\n';
  objects[5] =
    `5 0 obj\n<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n` +
    content +
    '\nendstream\nendobj\n';

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 1; i <= 5; i++) {
    offsets[i] = Buffer.byteLength(pdf, 'utf8');
    pdf += objects[i];
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += 'xref\n';
  pdf += `0 6\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) {
    const off = offsets[i].toString().padStart(10, '0');
    pdf += `${off} 00000 n \n`;
  }
  pdf += 'trailer\n';
  pdf += '<< /Size 6 /Root 1 0 R >>\n';
  pdf += 'startxref\n';
  pdf += `${xrefStart}\n`;
  pdf += '%%EOF\n';

  return Buffer.from(pdf, 'utf8');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("📩 Monthly Digest handler started");

  try {
    // ✅ Step 1: Get preferences where email_monthly_digest = true
    const { data: prefs, error: prefError } = await supabase
      .from('preferences')
      .select('user_id')
      .eq('email_monthly_digest', true);

    if (prefError) {
      console.error("❌ Error fetching preferences:", prefError.message);
      return res.status(500).json({ error: prefError.message });
    }

    if (!prefs?.length) {
      console.log("ℹ️ No opted-in users found.");
      return res.status(200).json({ message: 'No opted-in users' });
    }

    const userIds = prefs.map((p) => p.user_id);

    // ✅ Step 2: Fetch matching users including paid flag
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, name, paid_user')
      .in('id', userIds);

    if (userError || !users) {
      console.error("❌ Error fetching users:", userError?.message);
      return res.status(500).json({ error: userError?.message || 'No users found' });
    }

    // CSV helper
    function convertToCSV(rows: Record<string, unknown>[]): string {
      if (!rows.length) return '';
      const headers = Object.keys(rows[0]);
      const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const headerLine = headers.join(',');
      const lines = rows.map((row) => headers.map((h) => escape(row[h])).join(','));
      return [headerLine, ...lines].join('\n');
    }

    // ✅ Step 3: Loop through users and send digests
    for (const user of users) {
      // Get all submissions for previous month
      const now = new Date();
      const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      const { data: history, error: historyError } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', firstDayPrevMonth.toISOString())
        .lte('created_at', lastDayPrevMonth.toISOString())
        .order('created_at', { ascending: false });

      if (historyError || !history || history.length === 0) continue;

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

      const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(
        JSON.stringify({
          type: 'bar',
          data: {
            labels: history.map((row) =>
              new Date(row.created_at).toLocaleDateString()
            ),
            datasets: [
              {
                label: 'Income',
                data: history.map((row) => row.income || 0),
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
              },
              {
                label: 'Expenses',
                data: history.map(
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

      // ✅ Suggestion logic
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

      // Build HTML email
      const htmlContent = `
        <div style="font-family: sans-serif">
          <p>Hi ${user.name || user.email},</p>
          <p>Here’s your monthly financial digest:</p>
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

      // Build PDF for paid users
      const datesForPdf = history.map((row) => new Date(row.created_at).toLocaleDateString());
      const pdfBuffer = user.paid_user
        ? makeDigestPdf({
            title: 'Monthly Financial Digest',
            totalIncome,
            totalExpenses,
            savings,
            dates: datesForPdf,
          })
        : undefined;

      // ✅ Attach CSV + PDF only for paid users
      const attachments =
        user.paid_user
          ? [
              { filename: 'history.csv', content: convertToCSV(history) },
              ...(pdfBuffer
                ? [{ filename: 'digest.pdf', content: pdfBuffer, contentType: 'application/pdf' as const }]
                : []),
            ]
          : undefined;

      try {
        const response = await resend.emails.send({
          from: 'digest@stingyhubby.xyz',
          to: user.email,
          subject: 'Your Monthly Financial Digest',
          html: htmlContent,
          ...(attachments ? { attachments } : {}),
        });

        await supabase.from('email_logs').insert({
          user_id: user.id,
          email: user.email,
          status: 'sent',
          metadata: response ?? null, // keep existing behavior
        });

        console.log(`✅ Sent email to ${user.email}`);
      } catch (emailError) {
        console.error(`❌ Failed to send email to ${user.email}:`, emailError);
      }
    }

    return res.status(200).json({ message: 'Monthly Digest emails sent successfully' });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown error occurred';
    console.error("💥 Unhandled error:", errorMessage);
    return res.status(500).json({ error: errorMessage });
  }
}
