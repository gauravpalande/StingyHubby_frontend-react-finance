// frontend-react-finance/api/send-digest.cjs
// CommonJS entry so Vercel can require() it safely

module.exports.config = { runtime: "nodejs" };

const PDFDocument = require("pdfkit");
const { PassThrough } = require("stream");

// -------- Helpers --------
function toUSD(n) {
  return `$${(n || 0).toFixed(2)}`;
}

function convertToCSV(rows) {
  if (!rows || !rows.length) return "";
  const headers = Object.keys(rows[0] || {});
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const headerLine = headers.join(",");
  const lines = rows.map((r) => headers.map((h) => esc(r[h])).join(","));
  return [headerLine, ...lines].join("\n");
}

function buildChartUrl(history) {
  const fwd = history.slice().reverse();
  const labels = fwd.map((r) => new Date(r.created_at).toLocaleDateString());
  const incomeData = fwd.map((r) => r.income || 0);
  const expenseData = fwd.map(
    (r) => (r.mortgage || 0) + (r.utilities || 0) + (r.carPayments || 0) + (r.creditCards || 0)
  );

  const config = {
    type: "bar",
    data: { labels, datasets: [{ label: "Income", data: incomeData }, { label: "Expenses", data: expenseData }] },
    options: { plugins: { title: { display: true, text: "Income vs. Expenses" } }, scales: { y: { beginAtZero: true } } }
  };

  const u = new URL("https://quickchart.io/chart");
  u.searchParams.set("c", JSON.stringify(config));
  u.searchParams.set("format", "png");
  u.searchParams.set("width", "1000");
  u.searchParams.set("height", "500");
  return u.toString();
}

function buildAiSuggestionText(user, history) {
  const latest = history[0];
  if (user.paid_user) {
    const st = (latest?.short_term_suggestion || "").trim() || "Consider reducing discretionary expenses next month to increase savings.";
    const lt = (latest?.long_term_suggestion || "").trim() || "Consider contributing more towards your retirement savings.";
    const goal = (latest?.goal_suggestion || "").trim() || "Consider contributing more towards your financial goals.";
    return ["AI Suggestions:", `• Short term: ${st}`, `• Long term: ${lt}`, `• Goal: ${goal}`].join("\n");
  } else {
    const one = (latest?.oneline_suggestion || "").trim() || "Keep tracking your finances to get personalized insights.";
    return ["AI Suggestion:", `• ${one}`].join("\n");
  }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function generateEmailHtml({ logoUrl, siteUrl, displayName, chartUrl, aiText, totalIncome, totalExpenses, savings }) {
  const yellow = "#FFD54D", pink = "#E91E63", green = "#14B85A", black = "#111111";

  return `<!doctype html>
<html>
<head>
  <meta charSet="utf-8" />
  <title>Your weekly PennyWize digest is ready</title>
  <meta name="color-scheme" content="light only">
</head>
<body style="margin:0;padding:0;background-color:#fff8e1;">
  <div style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #f1f1f1;">
    <div style="padding:20px 24px;background:${yellow};">
      <img src="${logoUrl}" alt="PennyWize" width="180" style="display:block" />
    </div>
    <div style="padding:20px 24px 0;">
      <p style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:22px;font-weight:800;color:${black};">
        Hi ${escapeHtml(displayName)},
      </p>
      <p style="margin:6px 0 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:14px;color:#374151;">
        Here’s your weekly financial digest:
      </p>
    </div>
    <div style="padding:16px 24px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tbody>
          <tr>
            <td style="background:#f7f7f7;padding:12px;border-radius:10px;width:33.33%;text-align:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:13px;color:${black};font-weight:600;">
              📥 Income<br/><span style="color:${green};font-weight:800">${escapeHtml(totalIncome)}</span>
            </td>
            <td style="width:12px"></td>
            <td style="background:#f7f7f7;padding:12px;border-radius:10px;width:33.33%;text-align:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:13px;color:${black};font-weight:600;">
              💸 Expenses<br/><span style="color:${pink};font-weight:800">${escapeHtml(totalExpenses)}</span>
            </td>
            <td style="width:12px"></td>
            <td style="background:#f7f7f7;padding:12px;border-radius:10px;width:33.33%;text-align:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:13px;color:${black};font-weight:600;">
              💰 Savings<br/><span style="color:${black};font-weight:800">${escapeHtml(savings)}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div style="padding:16px 24px 0;">
      <img src="${chartUrl}" width="552" alt="Income vs. Expenses" style="width:100%;height:auto;border-radius:10px;border:1px solid #eee;" />
    </div>
    <div style="padding:16px 24px;">
      <p style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;font-weight:800;color:${black};">
        🤖 AI Suggestions
      </p>
      <pre style="white-space:pre-wrap;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:14px;color:#111;margin:8px 0 0;">
${escapeHtml(aiText)}
      </pre>
    </div>
    <hr style="border:0;border-top:1px solid #eee;margin:0" />
    <div style="padding:16px 24px 24px;">
      <p style="margin:0 0 6px 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:12px;color:#6b7280;">
        Sent by PennyWize
      </p>
      <p style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:12px;color:#6b7280;">
        <a href="\${siteUrl}/app/preferences" style="color:#6b7280;text-decoration:underline;">Manage preferences</a> ·
        <a href="\${siteUrl}/unsubscribe" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function buildDigestPdfBuffer({ title, displayName, totalIncome, totalExpenses, savings, chartPng, aiText, recentDates }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 48 });
    const stream = new PassThrough();
    const chunks = [];

    stream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));

    doc.pipe(stream);

    doc.fontSize(20).text(title, undefined, undefined, { align: "left" });
    doc.moveDown(0.2);
    doc.fontSize(11).fillColor("#666").text(`Recipient: ${displayName}`);
    doc.moveDown(0.8);
    doc.fillColor("#000");

    doc.fontSize(13).text("Summary");
    doc.moveDown(0.35);
    doc.fontSize(11);
    doc.text(`• Total Income: ${toUSD(totalIncome)}`);
    doc.text(`• Total Expenses: ${toUSD(totalExpenses)}`);
    doc.text(`• Estimated Savings: ${toUSD(savings)}`);
    doc.moveDown(0.8);

    if (chartPng && chartPng.length) {
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      doc.fontSize(13).text("Chart");
      doc.moveDown(0.3);
      doc.image(chartPng, undefined, undefined, { fit: [pageWidth, 320], align: "center" });
      doc.moveDown(0.8);
    }

    if (recentDates && recentDates.length) {
      doc.fontSize(13).text("Recent Entries");
      doc.moveDown(0.3);
      doc.fontSize(11);
      for (const d of recentDates) doc.text(`• ${d}`);
      doc.moveDown(0.8);
    }

    doc.fontSize(13).text("AI Suggestions");
    doc.moveDown(0.3);
    doc.fontSize(11).text(aiText, undefined, undefined, { align: "left" });

    doc.end();
  });
}

// -------- Handler (CJS + dynamic import for ESM libs) --------
module.exports = async (req, res) => {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const { Resend } = await import("resend");

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const resend = new Resend(process.env.RESEND_API_KEY);

    // 1) opted-in users
    const { data: prefs, error: prefError } = await supabase
      .from("preferences")
      .select("user_id")
      .eq("email_weekly_digest", true);

    if (prefError) return res.status(500).json({ error: prefError.message });
    if (!prefs || !prefs.length) return res.status(200).json({ message: "No opted-in users" });

    const userIds = prefs.map((p) => p.user_id);

    // 2) users
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, email, name, paid_user")
      .in("id", userIds);

    if (userError || !users || !users.length) {
      return res.status(500).json({ error: userError?.message || "No users found" });
    }

    const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://pennywize.vercel.app").replace(/\/$/, "");
    const logoUrl = (process.env.NEXT_PUBLIC_LOGO_URL || `${site}/brand/pennywize-logo.png`).replace(/\/$/, "");

    for (const user of users) {
      const { data: history, error: historyError } = await supabase
        .from("submissions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (historyError || !history || !history.length) continue;

      const totalIncome = history.reduce((sum, r) => sum + (r.income || 0), 0);
      const totalExpenses = history.reduce(
        (sum, r) => sum + (r.mortgage || 0) + (r.utilities || 0) + (r.carPayments || 0) + (r.creditCards || 0),
        0
      );
      const savings = totalIncome - totalExpenses;

      const chartUrl = buildChartUrl(history);
      let chartBuffer;
      try {
        const img = await fetch(chartUrl);
        chartBuffer = Buffer.from(await img.arrayBuffer());
      } catch {
        chartBuffer = undefined;
      }

      const aiText = buildAiSuggestionText(user, history);
      const displayName = user.name || user.email;

      const html = generateEmailHtml({
        logoUrl,
        siteUrl: site,
        displayName,
        chartUrl,
        aiText,
        totalIncome: toUSD(totalIncome),
        totalExpenses: toUSD(totalExpenses),
        savings: toUSD(savings),
      });

      const recentDates = history.slice().reverse().map((row) => new Date(row.created_at).toLocaleDateString());
      let pdfBuffer;
      if (user.paid_user) {
        pdfBuffer = await buildDigestPdfBuffer({
          title: "Weekly Financial Digest",
          displayName,
          totalIncome,
          totalExpenses,
          savings,
          chartPng: chartBuffer,
          aiText,
          recentDates,
        });
      }

      const attachments = [];
      if (user.paid_user) {
        attachments.push({ filename: "history.csv", content: convertToCSV(history) });
        if (pdfBuffer) {
          attachments.push({ filename: "digest.pdf", content: pdfBuffer, contentType: "application/pdf" });
        }
      }

      await resend.emails.send({
        from: "PennyWize <digest@stingyhubby.xyz>",
        to: user.email,
        subject: "Your Weekly Financial Digest",
        html,
        ...(attachments.length ? { attachments } : {}),
      });

      await supabase.from("email_logs").insert({
        user_id: user.id,
        email: user.email,
        status: "sent",
        metadata: { type: "weekly" },
      });
    }

    return res.status(200).json({ message: "Digest emails sent successfully" });
  } catch (err) {
    console.error("💥 Unhandled error:", err);
    const msg = (err && typeof err === "object" && "message" in err) ? err.message : String(err);
    return res.status(500).json({ error: msg || "Failed to send digest" });
  }
};
