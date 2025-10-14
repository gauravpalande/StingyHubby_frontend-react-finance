// frontend-react-finance/api/send-digest.js
export const config = { runtime: "nodejs" };

import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

/* --------------------------- Helpers --------------------------- */
function toUSD(n) { return `$${(n || 0).toFixed(2)}`; }

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

/* -------------------- PDF rendering (overlap-safe) -------------------- */
function _ensureSpace(doc, needed) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) doc.addPage();
}

function buildDigestPdfBuffer({ title, displayName, totalIncome, totalExpenses, savings, chartPng, aiText, recentDates }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 36 });
    const stream = new PassThrough();
    const chunks = [];
    stream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    doc.pipe(stream);

    const cw = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Header
    doc.font("Helvetica-Bold").fontSize(20).fillColor("#111").text(title, { width: cw });
    doc.moveDown(0.25);
    doc.font("Helvetica").fontSize(11).fillColor("#666").text(`Recipient: ${displayName}`);
    doc.moveDown(1);

    // Summary
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#111").text("Summary", { width: cw });
    doc.moveDown(0.25);
    doc.font("Helvetica").fontSize(11);
    doc.text(`• Total Income: ${toUSD(totalIncome)}`);
    doc.text(`• Total Expenses: ${toUSD(totalExpenses)}`);
    doc.text(`• Estimated Savings: ${toUSD(savings)}`);
    doc.moveDown(1);

    // Chart
    if (chartPng && chartPng.length) {
      const maxH = 260;
      const bottomLimit = doc.page.height - doc.page.margins.bottom;
      if (doc.y + maxH > bottomLimit) doc.addPage();

      doc.font("Helvetica-Bold").fontSize(13).fillColor("#111").text("Chart", { width: cw });
      doc.moveDown(0.3);

      const chartY = doc.y;
      doc.image(chartPng, doc.page.margins.left, chartY, { fit: [cw, maxH], align: "center" });
      doc.y = chartY + maxH + 12; // move cursor below image
    }

    // Recent Entries
    if (recentDates?.length) {
      const entriesText = recentDates.map((d) => `• ${d}`).join("\n");
      const needed = doc.heightOfString(entriesText, { width: cw }) + 40;
      const bottom = doc.page.height - doc.page.margins.bottom;
      if (doc.y + needed > bottom) doc.addPage();

      doc.font("Helvetica-Bold").fontSize(13).fillColor("#111").text("Recent Entries", { width: cw });
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(11).fillColor("#111").text(entriesText, { width: cw, align: "left" });
      doc.moveDown(1);
    }

    // AI Suggestions (boxed)
    const heading = "AI Suggestions";
    const pad = 12;
    const headingH = doc.heightOfString(heading, { width: cw - pad * 2 });
    const aiH = doc.heightOfString(aiText || "", { width: cw - pad * 2 });
    const boxH = headingH + aiH + pad * 2 + 8;
    const bottom = doc.page.height - doc.page.margins.bottom;
    if (doc.y + boxH > bottom) doc.addPage();

    const boxX = doc.page.margins.left;
    const boxY = doc.y;
    doc.save().roundedRect(boxX, boxY, cw, boxH, 10).fill("#fff8e1").restore();

    doc.font("Helvetica-Bold").fontSize(13).fillColor("#111").text(heading, boxX + pad, boxY + pad);
    doc.font("Helvetica").fontSize(11).fillColor("#111").text(aiText || "", boxX + pad, boxY + pad + headingH + 6, { width: cw - pad * 2 });
    doc.y = boxY + boxH + 12;

    // Footer
    doc.font("Helvetica").fontSize(9).fillColor("#666").text("Sent by PennyWize • https://pennywize.vercel.app", { width: cw, align: "center" });

    doc.end();
  });
}

/* -------- Render WeeklyDigest.tsx -> HTML (pre-bundled component) -------- */
async function renderWeeklyDigestHtml(props) {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const React = await import("react");
  const { default: WeeklyDigest } = await import("./.compiled/WeeklyDigest.mjs");
  const element = React.createElement(WeeklyDigest, props);
  return "<!doctype html>" + renderToStaticMarkup(element);
}

/* --------------------------- Handler --------------------------- */
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
    const dryRun = url.searchParams.get("dryRun") === "1";
    if (dryRun) return res.status(200).json({ ok: true, message: "dry run – no emails sent" });

    const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY"].filter((k) => !process.env[k]);
    if (missing.length) return res.status(500).json({ error: `Missing environment variables: ${missing.join(", ")}` });

    const { createClient } = await import("@supabase/supabase-js");
    const { Resend } = await import("resend");

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data: prefs, error: prefError } = await supabase
      .from("preferences")
      .select("user_id")
      .eq("email_weekly_digest", true);

    if (prefError) return res.status(500).json({ error: prefError.message });
    if (!prefs?.length) return res.status(200).json({ message: "No opted-in users" });

    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, email, name, paid_user")
      .in("id", prefs.map((p) => p.user_id));

    if (userError) return res.status(500).json({ error: userError.message });
    if (!users?.length) return res.status(200).json({ message: "No users matched ids" });

    const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://pennywize.vercel.app").replace(/\/$/, "");
    const fallbackLogoUrl = (process.env.NEXT_PUBLIC_LOGO_URL || `${site}/Brand/pennywize-logo-v2.png`) + `?v=${Date.now()}`;

    // Try CID logo
    let logoAttachment = null;
    let cidLogoSrc = null;
    try {
      const { readFileSync } = await import("node:fs");
      const logoBytes = readFileSync("public/pennywize-logo.png");
      logoAttachment = { filename: "pennywize-logo.png", content: logoBytes, cid: "pw-logo", contentType: "image/png" };
      cidLogoSrc = "cid:pw-logo";
    } catch { cidLogoSrc = null; }

    let sentCount = 0;

    for (const user of users) {
      const { data: history, error: historyError } = await supabase
        .from("submissions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (historyError || !history?.length) continue;

      const totalIncome = history.reduce((sum, r) => sum + (r.income || 0), 0);
      const totalExpenses = history.reduce((sum, r) => sum + (r.mortgage || 0) + (r.utilities || 0) + (r.carPayments || 0) + (r.creditCards || 0), 0);
      const savings = totalIncome - totalExpenses;

      const chartUrl = buildChartUrl(history);
      let chartBuffer;
      try {
        const img = await fetch(chartUrl);
        chartBuffer = Buffer.from(await img.arrayBuffer());
      } catch { chartBuffer = undefined; }

      const aiText = buildAiSuggestionText(user, history);
      const displayName = user.name || user.email;

      // ✅ Generate magic links that land on /auth/callback, which exchanges the code then routes to target.
      let manageUrl = `${site}/app/preferences`;
      let unsubscribeUrl = `${site}/unsubscribe`;
      try {
        const { data: manageLinkData } = await supabase.auth.admin.generateLink({
          type: "magiclink",
          email: user.email,
          options: { redirectTo: `${site}/auth/callback?next=${encodeURIComponent("/app/preferences")}` },
        });
        if (manageLinkData?.action_link) manageUrl = manageLinkData.action_link;
      } catch {}
      try {
        const { data: unsubLinkData } = await supabase.auth.admin.generateLink({
          type: "magiclink",
          email: user.email,
          options: { redirectTo: `${site}/auth/callback?next=${encodeURIComponent("/app/unsubscribe")}` },
        });
        if (unsubLinkData?.action_link) unsubscribeUrl = unsubLinkData.action_link;
      } catch {}

      const html = await renderWeeklyDigestHtml({
        displayName,
        logoUrl: cidLogoSrc || fallbackLogoUrl,
        chartUrl,
        aiText,
        totalIncome: toUSD(totalIncome),
        totalExpenses: toUSD(totalExpenses),
        savings: toUSD(savings),
        siteUrl: site,
        manageUrl,
        unsubscribeUrl,
      });

      const attachments = [];
      if (user.paid_user) {
        attachments.push({ filename: "history.csv", content: convertToCSV(history), contentType: "text/csv" });

        const recentDates = history.slice().reverse().map((row) => new Date(row.created_at).toLocaleDateString());
        try {
          const pdfBuffer = await buildDigestPdfBuffer({
            title: "Weekly Financial Digest",
            displayName,
            totalIncome,
            totalExpenses,
            savings,
            chartPng: chartBuffer,
            aiText,
            recentDates,
          });
          if (pdfBuffer) attachments.push({ filename: "digest.pdf", content: pdfBuffer, contentType: "application/pdf" });
        } catch {}
      }
      if (logoAttachment) attachments.push(logoAttachment);

      await resend.emails.send({
        from: "PennyWize <digest@stingyhubby.xyz>",
        to: user.email,
        subject: "Your Weekly Financial Digest",
        html,
        ...(attachments.length ? { attachments } : {}),
      });

      await supabase.from("email_logs").insert({
        user_id: user.id, email: user.email, status: "sent", metadata: { type: "weekly" },
      });

      sentCount += 1;
    }

    return res.status(200).json({ message: "Digest run finished", sent: sentCount });
  } catch (err) {
    console.error("💥 Unhandled error:", err);
    const msg = (err && typeof err === "object" && "message" in err) ? err.message : String(err);
    return res.status(500).json({ error: msg || "Failed to send digest" });
  }
}
