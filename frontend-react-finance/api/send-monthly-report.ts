// /api/send-monthly-digest.ts  (replace your existing monthly file)
// - Embeds QuickChart PNG and AI suggestions into a PDF (pdfkit)
// - Includes CSV + PDF attachments for every opted-in user
// - Uses previous calendar month as the period

export const config = {
  runtime: "nodejs",   // ✅ valid values: "nodejs" | "edge" | "experimental-edge"
  maxDuration: 60,
  memory: 1024
};

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import PDFDocument from 'pdfkit';
import { timingSafeEqual } from 'node:crypto';

const MONTHLY_DIGEST_TYPE = 'monthly';
const DEFAULT_DIGEST_RECIPIENT_LIMIT = 100;

// ---------- Singletons ----------
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

function firstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getDigestRecipientLimit() {
  const configured = Number(process.env.DIGEST_RECIPIENT_LIMIT);
  return Number.isInteger(configured) && configured > 0 && configured <= 1000
    ? configured
    : DEFAULT_DIGEST_RECIPIENT_LIMIT;
}

function hasValidCronSecret(req: VercelRequest, cronSecret: string) {
  const authorization = firstHeaderValue(req.headers.authorization) || '';
  const actualBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(`Bearer ${cronSecret}`);

  return actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer);
}

function getPreviousMonthPeriod(date: Date) {
  const previousMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  return previousMonth.toISOString().slice(0, 7);
}

async function updateDeliveryStatus(
  periodKey: string,
  userId: string,
  status: 'sent' | 'skipped' | 'failed',
  error?: string
) {
  const { error: updateError } = await supabase
    .from('scheduled_email_deliveries')
    .update({
      status,
      completed_at: new Date().toISOString(),
      last_error: error ? error.slice(0, 500) : null,
    })
    .eq('digest_type', MONTHLY_DIGEST_TYPE)
    .eq('period_key', periodKey)
    .eq('user_id', userId);

  if (updateError) {
    console.error('[monthly-digest] Failed to update delivery status:', updateError.message);
  }
}

// ---------- Helpers ----------
function toUSD(n: number) {
  return `$${(n || 0).toFixed(2)}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
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

type Submission = {
  created_at: string;
  short_term_suggestion?: string;
  long_term_suggestion?: string;
  goal_suggestion?: string;
  oneline_suggestion?: string;
  // Add other relevant fields if needed
};

function buildAiSuggestionText(history: Submission[]): string {
  const latest = history[0];
  const shortTerm = latest?.short_term_suggestion?.trim() ||
    'Consider reducing discretionary expenses next month to increase savings.';
  const longTerm = latest?.long_term_suggestion?.trim() ||
    'Consider contributing more towards your retirement savings.';
  const goal = latest?.goal_suggestion?.trim() ||
    'Consider contributing more towards your financial goals.';

  return [
    'AI Suggestions:',
    `• Short term: ${shortTerm}`,
    `• Long term: ${longTerm}`,
    `• Goal: ${goal}`,
  ].join('\n');
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
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.length < 16) {
    return res.status(503).json({ error: 'Scheduled job authentication is unavailable' });
  }

  if (!hasValidCronSecret(req, cronSecret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { error: cleanupError } = await supabase.rpc('cleanup_cost_protection_data');
    if (cleanupError) {
      throw new Error(`Unable to clean cost-protection data: ${cleanupError.message}`);
    }

    // Step 1: Get preferences where email_monthly_digest = true
    const { data: prefs, error: prefError } = await supabase
      .from('preferences')
      .select('user_id')
      .eq('email_monthly_digest', true)
      .limit(getDigestRecipientLimit());

    if (prefError) {
      console.error('❌ Error fetching preferences:', prefError.message);
      return res.status(500).json({ error: prefError.message });
    }

    if (!prefs?.length) {
      return res.status(200).json({ message: 'No opted-in users' });
    }

    const userIds = prefs.map((p) => p.user_id);

    // Step 2: Fetch matching users
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .in('id', userIds);

    if (userError || !users) {
      console.error('❌ Error fetching users:', userError?.message);
      return res.status(500).json({ error: userError?.message || 'No users found' });
    }

    const periodKey = getPreviousMonthPeriod(new Date());
    let sentCount = 0;
    let duplicateCount = 0;

    // Step 3: Loop through users and send digests
    for (const user of users) {
      const { data: claimed, error: claimError } = await supabase.rpc(
        'claim_scheduled_email_delivery',
        {
          p_digest_type: MONTHLY_DIGEST_TYPE,
          p_period_key: periodKey,
          p_user_id: user.id,
          p_stale_after_seconds: 32 * 24 * 60 * 60,
        }
      );

      if (claimError) {
        throw new Error(`Unable to claim monthly delivery: ${claimError.message}`);
      }

      if (!claimed) {
        duplicateCount += 1;
        continue;
      }

      try {
      // Previous calendar month
      const now = new Date();
      const firstDayPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const firstDayCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const lastDayPrevMonth = new Date(firstDayCurrentMonth.getTime() - 1);

      const { data: history, error: historyError } = await supabase
        .from('submissions')
        .select(
          'id, created_at, income, checking, emergency, health, retirement, creditCards, mortgage, carPayments, utilities, short_term_suggestion, long_term_suggestion, goal_suggestion, oneline_suggestion'
        )
        .eq('user_id', user.id)
        .gte('created_at', firstDayPrevMonth.toISOString())
        .lte('created_at', lastDayPrevMonth.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (historyError) {
        throw new Error(historyError.message);
      }
      if (!history || history.length === 0) {
        await updateDeliveryStatus(periodKey, user.id, 'skipped');
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
        const resp = await fetch(chartUrl, { signal: AbortSignal.timeout(8_000) });
        const arr = await resp.arrayBuffer();
        chartBuffer = Buffer.from(arr);
      } catch (e) {
        console.error(`⚠️ Chart fetch failed for ${user.email}:`, (e as Error)?.message || e);
        chartBuffer = undefined; // PDF will omit chart section if unavailable
      }

      // AI Suggestions
      const aiText = buildAiSuggestionText(history);

      // Email HTML
      const displayName = String(user.name || user.email || 'PennyWize user').slice(0, 200);
      const periodLabel = `${firstDayPrevMonth.toLocaleDateString()} — ${lastDayPrevMonth.toLocaleDateString()}`;
      const safeDisplayName = escapeHtml(displayName);
      const safeAiText = escapeHtml(aiText);

      const htmlContent = `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto; line-height:1.5;">
          <p>Hi ${safeDisplayName},</p>
          <p>Here’s your monthly financial digest (${periodLabel}):</p>
          <ul>
            <li><strong>📥 Total Income:</strong> ${toUSD(totalIncome)}</li>
            <li><strong>💸 Total Expenses:</strong> ${toUSD(totalExpenses)}</li>
            <li><strong>💰 Estimated Savings:</strong> ${toUSD(savings)}</li>
          </ul>
          <p><img src="${chartUrl}" alt="Financial Chart" style="max-width: 100%; height: auto;" /></p>
          <pre style="white-space: pre-wrap; font-family: inherit">${safeAiText}</pre>
          <p><small>To unsubscribe, update your preferences at https://pennywize.vercel.app/.</small></p>
        </div>
      `;

      // Dates shown in the PDF's "Included Dates" section
      const datesForPdf = history
        .slice()
        .reverse()
        .map((row) => new Date(row.created_at).toLocaleDateString());

      let pdfBuffer: Buffer | undefined;

      try {
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
      } catch (error) {
        console.error(`PDF generation failed for ${user.email}:`, (error as Error)?.message || error);
      }

      const attachments: Array<{
        filename: string;
        content: string | Buffer;
        contentType?: string;
      }> = [
        { filename: 'history.csv', content: convertToCSV(history), contentType: 'text/csv' },
      ];

      if (pdfBuffer) {
        attachments.push({
          filename: 'digest.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
        });
      }

      const response = await resend.emails.send(
        {
          from: 'digest@stingyhubby.xyz',
          to: user.email,
          subject: 'Your Monthly Financial Digest',
          html: htmlContent,
          ...(attachments.length ? { attachments } : {}),
        },
        { idempotencyKey: `pennywize-monthly:${periodKey}:${user.id}` }
      );

      if (response.error) {
        throw new Error(response.error.message || 'Resend rejected the monthly digest');
      }

      await supabase.from('email_logs').insert({
        user_id: user.id,
        email: user.email,
        status: 'sent',
        metadata: { type: 'monthly', resendId: response.data?.id },
      });

      await updateDeliveryStatus(periodKey, user.id, 'sent');
      sentCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await updateDeliveryStatus(periodKey, user.id, 'failed', message);
        console.error(`[monthly-digest] Failed for user ${user.id}:`, message);
      }
    }

    return res.status(200).json({
      message: 'Monthly Digest run finished',
      sent: sentCount,
      duplicatesSkipped: duplicateCount,
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('💥 Unhandled error:', errorMessage);
    return res.status(500).json({ error: errorMessage });
  }
}
