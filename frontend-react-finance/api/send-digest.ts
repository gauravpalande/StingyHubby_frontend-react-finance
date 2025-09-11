// /api/send-digest.ts
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import PDFDocument from 'pdfkit';
import { render } from '@react-email/render';
import WeeklyDigestEmail from '../emails/WeeklyDigest';

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

function convertToCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const headerLine = headers.join(',');
  const lines = rows.map((row) => headers.map((h) => escape(row[h])).join(','));
  return [headerLine, ...lines].join('\n');
}

type SubmissionHistory = {
  created_at: string;
  income?: number;
  mortgage?: number;
  utilities?: number;
  carPayments?: number;
  creditCards?: number;
  short_term_suggestion?: string;
  long_term_suggestion?: string;
  goal_suggestion?: string;
  oneline_suggestion?: string;
};

function buildChartUrl(history: SubmissionHistory[]) {
  const labels = history.slice().reverse()
    .map((row) => new Date(row.created_at).toLocaleDateString());

  const incomeData = history.slice().reverse().map((row) => row.income || 0);
  const expenseData = history.slice().reverse().map(
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
      plugins: { title: { display: true, text: 'Income vs. Expenses' } },
      scales: { y: { beginAtZero: true } },
    },
  };

  const u = new URL('https://quickchart.io/chart');
  u.searchParams.set('c', JSON.stringify(config));
  u.searchParams.set('format', 'png');
  u.searchParams.set('width', '1000');
  u.searchParams.set('height', '500');
  return u.toString();
}

type User = {
  id: string;
  email: string;
  name?: string;
  paid_user?: boolean;
};

function buildAiSuggestionText(user: User, history: SubmissionHistory[]): string {
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

async function buildDigestPdfBuffer(params: {
  title: string;
  displayName: string;
  totalIncome: number;
  totalExpenses: number;
  savings: number;
  chartPng?: Buffer | null;
  aiText: string;
  recentDates: string[];
}): Promise<Buffer> {
  const {
    title, displayName, totalIncome, totalExpenses, savings,
    chartPng, aiText, recentDates,
  } = params;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(20).text(title, { align: 'left' });
    doc.moveDown(0.2);
    doc.fontSize(11).fillColor('#666').text(`Recipient: ${displayName}`);
    doc.moveDown(0.8).fillColor('#000');

    doc.fontSize(13).text('Summary');
    doc.moveDown(0.35);
    doc.fontSize(11);
    doc.text(`• Total Income: ${toUSD(totalIncome)}`);
    doc.text(`• Total Expenses: ${toUSD(totalExpenses)}`);
    doc.text(`• Estimated Savings: ${toUSD(savings)}`);
    doc.moveDown(0.8);

    if (chartPng && chartPng.length) {
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      doc.fontSize(13).text('Chart');
      doc.moveDown(0.3);
      doc.image(chartPng, { fit: [pageWidth, 320], align: 'center' });
      doc.moveDown(0.8);
    }

    if (recentDates.length) {
      doc.fontSize(13).text('Recent Entries');
      doc.moveDown(0.3);
      doc.fontSize(11);
      recentDates.forEach((d) => doc.text(`• ${d}`));
      doc.moveDown(0.8);
    }

    doc.fontSize(13).text('AI Suggestions');
    doc.moveDown(0.3);
    doc.fontSize(11).text(aiText, { align: 'left' });

    doc.end();
  });
}

// ---------- Handler ----------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('📩 Digest handler started');

  try {
    // 1) opted-in users
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

    // 2) users
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, name, paid_user')
      .in('id', userIds);

    if (userError || !users?.length) {
      console.error('❌ Error fetching users:', userError?.message);
      return res.status(500).json({ error: userError?.message || 'No users found' });
    }

    const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pennywize.vercel.app').replace(/\/$/, '');
    const logoUrl = `${site}/pennywize-logo.svg`; // put SVG into /public

    // 3) per user
    for (const user of users) {
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

      // metrics
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

      // chart
      const chartUrl = buildChartUrl(history);
      let chartBuffer: Buffer | undefined;
      try {
        const resp = await fetch(chartUrl);
        const arr = await resp.arrayBuffer();
        chartBuffer = Buffer.from(arr);
      } catch (e) {
        console.error(`⚠️ Chart fetch failed for ${user.email}:`, (e as Error)?.message || e);
        chartBuffer = undefined;
      }

      // AI text
      const aiText = buildAiSuggestionText(user, history);

      // --------- React Email HTML ----------
      const displayName = user.name || user.email;
      const html = render(
        WeeklyDigestEmail({
          logoUrl,
          siteUrl: site,
          displayName,
          chartUrl,
          aiText,
          totalIncome: toUSD(totalIncome),
          totalExpenses: toUSD(totalExpenses),
          savings: toUSD(savings),
        }),
        { pretty: true }
      );

      // --------- PDF attachment (paid users only; keep your policy) ----------
      const recentDates = history.slice().reverse()
        .map((row) => new Date(row.created_at).toLocaleDateString());

      const shouldAttachPdf = !!user.paid_user;
      let pdfBuffer: Buffer | undefined;

      if (shouldAttachPdf) {
        pdfBuffer = await buildDigestPdfBuffer({
          title: 'Weekly Financial Digest',
          displayName,
          totalIncome,
          totalExpenses,
          savings,
          chartPng: chartBuffer,
          aiText,
          recentDates,
        });
      }

      const attachments: Array<{ filename: string; content: string | Buffer; contentType?: string; }> = [];
      if (user.paid_user) {
        const csv = convertToCSV(history);
        attachments.push({ filename: 'history.csv', content: csv });
        if (pdfBuffer) attachments.push({ filename: 'digest.pdf', content: pdfBuffer, contentType: 'application/pdf' });
      }

      try {
        const response = await resend.emails.send({
          from: 'PennyWize <digest@stingyhubby.xyz>',
          to: user.email,
          subject: 'Your Weekly Financial Digest',
          html,
          ...(attachments.length ? { attachments } : {}),
        });

        await supabase.from('email_logs').insert({
          user_id: user.id,
          email: user.email,
          status: 'sent',
          metadata: response ?? null,
        });

        console.log(`✅ Sent email to ${user.email}`);
      } catch (emailError) {
        console.error(`❌ Failed to send email to ${user.email}:`, emailError);
      }
    }

    return res.status(200).json({ message: 'Digest emails sent successfully' });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('💥 Unhandled error:', errorMessage);
    return res.status(500).json({ error: errorMessage || 'Failed to send digest' });
  }
}
