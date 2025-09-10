// /api/send-monthly-digest.ts  (replace your existing monthly file)
// - Embeds QuickChart PNG and AI suggestions into a PDF (pdfkit)
// - Keeps CSV + PDF attachments for paid users
// - Uses previous calendar month as the period

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import PDFDocument from 'pdfkit';

// ---------- Singletons ----------
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

// ---------- Helpers ----------
function toUSD(n: number) {
  return `$${(n || 0).toFixed(2)}`;
}

// Build QuickChart URL (larger image for crisp PDF)
type HistoryRow = {
  created_at: string;
  income?: number;
  mortgage?: number;
  utilities?: number;
  carPayments?: number;
  creditCards?: number;
};

function buildChartUrl(history: HistoryRow[]) {
  const labels = history.map((row) =>
    new Date(row.created_at).toLocaleDateString()
  );

  const incomeData = history.map((row) => row.income || 0);

  const expenseData = history.map(
    (row) =>
      (row.mortgage || 0) +
      (row.utilities || 0) +
      (row.carPayments || 0) +
      (row.creditCards || 0)
  );

  const config = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Income', data: incomeData },
        { label: 'Expenses', data: expenseData },
      ],
    },
    options: {
      plugins: {
        title: { display: true, text: 'Income vs. Expenses (Last Month)' },
        legend: { display: true },
      },
      scales: { y: { beginAtZero: true } },
    },
  };

  const u = new URL('https://quickchart.io/chart');
  u.searchParams.set('c', JSON.stringify(config));
  u.searchParams.set('format', 'png');
  u.searchParams.set('width', '1200');
  u.searchParams.set('height', '600');
  return u.toString();
}

// AI Suggestions text from your stored DB fields
type User = {
  paid_user: boolean;
  name?: string;
  email?: string;
  // Add other relevant fields if needed
};

type Submission = {
  created_at: string;
  short_term_suggestion?: string;
  long_term_suggestion?: string;
  goal_suggestion?: string;
  oneline_suggestion?: string;
  // Add other relevant fields if needed
};

function buildAiSuggestionText(user: User, history: Submission[]): string {
  const latest = history[0];
  if (user.paid_user) {
    const st = latest?.short_term_suggestion?.trim();
    const lt = latest?.long_term_suggestion?.trim();
    const goal = latest?.goal_suggestion?.trim();

    const ST = st || 'Consider reducing discretionary expenses next month to increase savings.';
    const LT = lt || 'Consider contributing more towards your retirement savings.';
    const GO = goal || 'Consider contributing more towards your financial goals.';

    return [
      'AI Suggestions:',
      `• Short term: ${ST}`,
      `• Long term: ${LT}`,
      `• Goal: ${GO}`,
    ].join('\n');
  } else {
    const one = latest?.oneline_suggestion?.trim() || 'Keep tracking your finances to get personalized insights.';
    return ['AI Suggestion:', `• ${one}`].join('\n');
  }
}

// CSV helper (unchanged logic)
function convertToCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const headerLine = headers.join(',');
  const lines = rows.map((row) => headers.map((h) => escape(row[h])).join(','));
  return [headerLine, ...lines].join('\n');
}

// Build a PDF with totals + chart image + AI tips
async function buildDigestPdfBuffer(params: {
  title: string;
  displayName: string;
  totalIncome: number;
  totalExpenses: number;
  savings: number;
  periodLabel: string;
  chartPng?: Buffer | null;
  aiText: string;
  dates: string[];
}): Promise<Buffer> {
  const {
    title,
    displayName,
    totalIncome,
    totalExpenses,
    savings,
    periodLabel,
    chartPng,
    aiText,
    dates,
  } = params;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Header
    doc.fontSize(20).text(title, { align: 'left' });
    doc.moveDown(0.2);
    doc.fontSize(11).fillColor('#666').text(`Recipient: ${displayName}`);
    doc.moveDown(0.2);
    doc.fontSize(11).fillColor('#666').text(`Period: ${periodLabel}`);
    doc.moveDown(0.8);
    doc.fillColor('#000');

    // Totals
    doc.fontSize(13).text('Summary', { underline: false });
    doc.moveDown(0.35);
    doc.fontSize(11);
    doc.text(`• Total Income: ${toUSD(totalIncome)}`);
    doc.text(`• Total Expenses: ${toUSD(totalExpenses)}`);
    doc.text(`• Estimated Savings: ${toUSD(savings)}`);
    doc.moveDown(0.8);

    // Chart
    if (chartPng && chartPng.length) {
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      doc.fontSize(13).text('Chart', { underline: false });
      doc.moveDown(0.3);
      doc.image(chartPng, { fit: [pageWidth, 320], align: 'center' });
      doc.moveDown(0.8);
    }

    // Included Dates
    if (dates.length) {
      doc.fontSize(13).text('Included Dates', { underline: false });
      doc.moveDown(0.3);
      doc.fontSize(11);
      dates.forEach((d) => doc.text(`• ${d}`));
      doc.moveDown(0.8);
    }

    // AI Suggestions
    doc.fontSize(13).text('AI Suggestions', { underline: false });
    doc.moveDown(0.3);
    doc.fontSize(11).text(aiText, { align: 'left' });

    doc.end();
  });
}

// ---------- Handler ----------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('📩 Monthly Digest handler started');

  try {
    // Step 1: Get preferences where email_monthly_digest = true
    const { data: prefs, error: prefError } = await supabase
      .from('preferences')
      .select('user_id')
      .eq('email_monthly_digest', true);

    if (prefError) {
      console.error('❌ Error fetching preferences:', prefError.message);
      return res.status(500).json({ error: prefError.message });
    }

    if (!prefs?.length) {
      console.log('ℹ️ No opted-in users found.');
      return res.status(200).json({ message: 'No opted-in users' });
    }

    const userIds = prefs.map((p) => p.user_id);

    // Step 2: Fetch matching users including paid flag
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, name, paid_user')
      .in('id', userIds);

    if (userError || !users) {
      console.error('❌ Error fetching users:', userError?.message);
      return res.status(500).json({ error: userError?.message || 'No users found' });
    }

    // Step 3: Loop through users and send digests
    for (const user of users) {
      // Previous calendar month
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

      if (historyError) {
        console.error(`❌ History fetch error for ${user.email}:`, historyError.message);
        continue;
      }
      if (!history || history.length === 0) {
        console.log(`ℹ️ No monthly history for ${user.email}, skipping.`);
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

      // Chart for email (img tag) and for PDF (buffer)
      const chartUrl = buildChartUrl(history);
      let chartBuffer: Buffer | undefined;
      try {
        const resp = await fetch(chartUrl);
        const arr = await resp.arrayBuffer();
        chartBuffer = Buffer.from(arr);
      } catch (e) {
        console.error(`⚠️ Chart fetch failed for ${user.email}:`, (e as Error)?.message || e);
        chartBuffer = undefined; // PDF will omit chart section if unavailable
      }

      // AI Suggestions
      const aiText = buildAiSuggestionText(user, history);

      // Email HTML
      const displayName = user.name || user.email;
      const periodLabel = `${firstDayPrevMonth.toLocaleDateString()} — ${lastDayPrevMonth.toLocaleDateString()}`;

      const htmlContent = `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto; line-height:1.5;">
          <p>Hi ${displayName},</p>
          <p>Here’s your monthly financial digest (${periodLabel}):</p>
          <ul>
            <li><strong>📥 Total Income:</strong> ${toUSD(totalIncome)}</li>
            <li><strong>💸 Total Expenses:</strong> ${toUSD(totalExpenses)}</li>
            <li><strong>💰 Estimated Savings:</strong> ${toUSD(savings)}</li>
          </ul>
          <p><img src="${chartUrl}" alt="Financial Chart" style="max-width: 100%; height: auto;" /></p>
          <pre style="white-space: pre-wrap; font-family: inherit">${aiText}</pre>
          <p><small>To unsubscribe, update your preferences at https://pennywize.vercel.app/.</small></p>
        </div>
      `;

      // Dates shown in the PDF's "Included Dates" section
      const datesForPdf = history
        .slice()
        .reverse()
        .map((row) => new Date(row.created_at).toLocaleDateString());

      // Build PDF with chart + AI tips (only for paid users; set to true to send to all)
      const shouldAttachPdf = !!user.paid_user;
      let pdfBuffer: Buffer | undefined;

      if (shouldAttachPdf) {
        pdfBuffer = await buildDigestPdfBuffer({
          title: 'Monthly Financial Digest',
          displayName,
          totalIncome,
          totalExpenses,
          savings,
          periodLabel,
          chartPng: chartBuffer,
          aiText,
          dates: datesForPdf,
        });
      }

      // Attachments: CSV + PDF for paid users (your existing policy)
      const attachments: Array<{
        filename: string;
        content: string | Buffer;
        contentType?: string;
      }> = [];

      if (user.paid_user) {
        const csv = convertToCSV(history);
        attachments.push({ filename: 'history.csv', content: csv });
        if (pdfBuffer) {
          attachments.push({
            filename: 'digest.pdf',
            content: pdfBuffer,
            contentType: 'application/pdf',
          });
        }
      }

      try {
        const response = await resend.emails.send({
          from: 'digest@stingyhubby.xyz',
          to: user.email,
          subject: 'Your Monthly Financial Digest',
          html: htmlContent,
          ...(attachments.length ? { attachments } : {}),
        });

        await supabase.from('email_logs').insert({
          user_id: user.id,
          email: user.email,
          status: 'sent',
          metadata: response ?? null,
        });

        console.log(`✅ Sent monthly email to ${user.email}`);
      } catch (emailError) {
        console.error(`❌ Failed to send email to ${user.email}:`, emailError);
      }
    }

    return res.status(200).json({ message: 'Monthly Digest emails sent successfully' });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('💥 Unhandled error:', errorMessage);
    return res.status(500).json({ error: errorMessage });
  }
}
