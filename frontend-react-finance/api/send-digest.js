// frontend-react-finance/api/send-digest.js
export const config = { runtime: "nodejs" };

import PDFDocument from "pdfkit";
import { PassThrough } from "stream";
import { timingSafeEqual } from "node:crypto";

const WEEKLY_DIGEST_TYPE = "weekly";
const DEFAULT_DIGEST_RECIPIENT_LIMIT = 100;

function firstHeaderValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function getDigestRecipientLimit() {
  const configured = Number(process.env.DIGEST_RECIPIENT_LIMIT);
  return Number.isInteger(configured) && configured > 0 && configured <= 1000
    ? configured
    : DEFAULT_DIGEST_RECIPIENT_LIMIT;
}

function hasValidCronSecret(req, cronSecret) {
  const authorization = firstHeaderValue(req.headers.authorization) || "";
  const expected = `Bearer ${cronSecret}`;
  const actualBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);

  return actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer);
}

function getUtcWeekPeriod(date) {
  const weekStart = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
  const daysSinceMonday = (weekStart.getUTCDay() + 6) % 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday);
  return weekStart.toISOString().slice(0, 10);
}

async function updateDeliveryStatus(supabase, periodKey, userId, status, error) {
  const values = {
    status,
    completed_at: new Date().toISOString(),
    last_error: error ? String(error).slice(0, 500) : null,
  };
  const { error: updateError } = await supabase
    .from("scheduled_email_deliveries")
    .update(values)
    .eq("digest_type", WEEKLY_DIGEST_TYPE)
    .eq("period_key", periodKey)
    .eq("user_id", userId);

  if (updateError) {
    console.error("[weekly-digest] Failed to update delivery status:", updateError.message);
  }
}

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
    data: {
      labels,
      datasets: [
        { label: "Income", data: incomeData },
        { label: "Expenses", data: expenseData },
      ],
    },
    options: {
      plugins: { title: { display: true, text: "Income vs. Expenses" } },
      scales: { y: { beginAtZero: true } },
    },
  };
  const u = new URL("https://quickchart.io/chart");
  u.searchParams.set("c", JSON.stringify(config));
  u.searchParams.set("format", "png");
  u.searchParams.set("width", "1000");
  u.searchParams.set("height", "500");
  return u.toString();
}

function buildAiSuggestionText(history) {
  const latest = history[0];
  const shortTerm =
    (latest?.short_term_suggestion || "").trim() ||
    "Consider reducing discretionary expenses next month to increase savings.";
  const longTerm =
    (latest?.long_term_suggestion || "").trim() ||
    "Consider contributing more towards your retirement savings.";
  const goal =
    (latest?.goal_suggestion || "").trim() ||
    "Consider contributing more towards your financial goals.";
  return [
    "AI Suggestions:",
    `• Short term: ${shortTerm}`,
    `• Long term: ${longTerm}`,
    `• Goal: ${goal}`,
  ].join("\n");
}

/* -------------------- PDF rendering (overlap-safe) -------------------- */
function _ensureSpace(doc, needed) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) doc.addPage();
}

function buildDigestPdfBuffer({
  title,
  displayName,
  totalIncome,
  totalExpenses,
  savings,
  chartPng,
  aiText,
  recentDates,
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 36 });
    const stream = new PassThrough();
    const chunks = [];
    stream.on("data", (c) =>
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c))
    );
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    doc.pipe(stream);

    const cw =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Header
    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#111")
      .text(title, { width: cw });
    doc.moveDown(0.25);
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#666")
      .text(`Recipient: ${displayName}`);
    doc.moveDown(1);

    // Summary
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#111")
      .text("Summary", { width: cw });
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

      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor("#111")
        .text("Chart", { width: cw });
      doc.moveDown(0.3);

      const chartY = doc.y;
      doc.image(chartPng, doc.page.margins.left, chartY, {
        fit: [cw, maxH],
        align: "center",
      });
      doc.y = chartY + maxH + 12; // move cursor below image
    }

    // Recent Entries
    if (recentDates?.length) {
      const entriesText = recentDates.map((d) => `• ${d}`).join("\n");
      const needed =
        doc.heightOfString(entriesText, { width: cw }) + 40;
      const bottom = doc.page.height - doc.page.margins.bottom;
      if (doc.y + needed > bottom) doc.addPage();

      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor("#111")
        .text("Recent Entries", { width: cw });
      doc.moveDown(0.3);
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor("#111")
        .text(entriesText, { width: cw, align: "left" });
      doc.moveDown(1);
    }

    // AI Suggestions (boxed)
    const heading = "AI Suggestions";
    const pad = 12;
    const headingH = doc.heightOfString(heading, {
      width: cw - pad * 2,
    });
    const aiH = doc.heightOfString(aiText || "", {
      width: cw - pad * 2,
    });
    const boxH = headingH + aiH + pad * 2 + 8;
    const bottom = doc.page.height - doc.page.margins.bottom;
    if (doc.y + boxH > bottom) doc.addPage();

    const boxX = doc.page.margins.left;
    const boxY = doc.y;
    doc
      .save()
      .roundedRect(boxX, boxY, cw, boxH, 10)
      .fill("#fff8e1")
      .restore();

    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#111")
      .text(heading, boxX + pad, boxY + pad);
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#111")
      .text(
        aiText || "",
        boxX + pad,
        boxY + pad + headingH + 6,
        { width: cw - pad * 2 }
      );
    doc.y = boxY + boxH + 12;

    // Footer
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#666")
      .text(
        "Sent by PennyWize • https://pennywize.vercel.app",
        { width: cw, align: "center" }
      );

    doc.end();
  });
}

/* -------- Render WeeklyDigest.tsx -> HTML (pre-bundled component) -------- */
async function renderWeeklyDigestHtml(props) {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const React = await import("react");
  const { default: WeeklyDigest } = await import(
    "./.compiled/WeeklyDigest.mjs"
  );
  const element = React.createElement(WeeklyDigest, props);
  return "<!doctype html>" + renderToStaticMarkup(element);
}

/* --------------------------- Handler --------------------------- */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.length < 16) {
    return res.status(503).json({ error: "Scheduled job authentication is unavailable" });
  }

  if (!hasValidCronSecret(req, cronSecret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const url = new URL(
      req.url,
      `https://${req.headers.host || "localhost"}`
    );
    const dryRun = url.searchParams.get("dryRun") === "1";
    if (dryRun)
      return res
        .status(200)
        .json({ ok: true, message: "dry run – no emails sent" });

    const missing = [
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "RESEND_API_KEY",
    ].filter((k) => !process.env[k]);
    if (missing.length)
      return res
        .status(500)
        .json({
          error: `Missing environment variables: ${missing.join(", ")}`,
        });

    const { createClient } = await import("@supabase/supabase-js");
    const { Resend } = await import("resend");

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { error: cleanupError } = await supabase.rpc(
      "cleanup_cost_protection_data"
    );
    if (cleanupError) {
      throw new Error(`Unable to clean cost-protection data: ${cleanupError.message}`);
    }

    const { data: prefs, error: prefError } = await supabase
      .from("preferences")
      .select("user_id")
      .eq("email_weekly_digest", true)
      .limit(getDigestRecipientLimit());

    if (prefError)
      return res.status(500).json({ error: prefError.message });
    if (!prefs?.length)
      return res
        .status(200)
        .json({ message: "No opted-in users" });

    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, email, name")
      .in(
        "id",
        prefs.map((p) => p.user_id)
      );

    if (userError)
      return res.status(500).json({ error: userError.message });
    if (!users?.length)
      return res
        .status(200)
        .json({ message: "No users matched ids" });

    const site = (process.env.NEXT_PUBLIC_SITE_URL ||
      "https://pennywize.vercel.app"
    ).replace(/\/$/, "");
    const fallbackLogoUrl =
      (process.env.NEXT_PUBLIC_LOGO_URL ||
        `${site}/Brand/pennywize-logo-v2.png`) +
      `?v=${Date.now()}`;

    // Try CID logo
    let logoAttachment = null;
    let cidLogoSrc = null;
    try {
      const { readFileSync } = await import("node:fs");
      const logoBytes = readFileSync("public/pennywize-logo.png");
      logoAttachment = {
        filename: "pennywize-logo.png",
        content: logoBytes,
        cid: "pw-logo",
        contentType: "image/png",
      };
      cidLogoSrc = "cid:pw-logo";
    } catch {
      cidLogoSrc = null;
    }

    let sentCount = 0;
    let duplicateCount = 0;
    const periodKey = getUtcWeekPeriod(new Date());

    for (const user of users) {
      const { data: claimed, error: claimError } = await supabase.rpc(
        "claim_scheduled_email_delivery",
        {
          p_digest_type: WEEKLY_DIGEST_TYPE,
          p_period_key: periodKey,
          p_user_id: user.id,
          p_stale_after_seconds: 8 * 24 * 60 * 60,
        }
      );

      if (claimError) {
        throw new Error(`Unable to claim weekly delivery: ${claimError.message}`);
      }

      if (!claimed) {
        duplicateCount += 1;
        continue;
      }

      try {
      const { data: history, error: historyError } = await supabase
        .from("submissions")
        .select(
          "id, created_at, income, checking, emergency, health, retirement, creditCards, mortgage, carPayments, utilities, short_term_suggestion, long_term_suggestion, goal_suggestion, oneline_suggestion"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (historyError) throw new Error(historyError.message);
      if (!history?.length) {
        await updateDeliveryStatus(supabase, periodKey, user.id, "skipped");
        continue;
      }

      const totalIncome = history.reduce(
        (sum, r) => sum + (r.income || 0),
        0
      );
      const totalExpenses = history.reduce(
        (sum, r) =>
          sum +
          (r.mortgage || 0) +
          (r.utilities || 0) +
          (r.carPayments || 0) +
          (r.creditCards || 0),
        0
      );
      const savings = totalIncome - totalExpenses;

      const chartUrl = buildChartUrl(history);
      let chartBuffer;
      try {
        const img = await fetch(chartUrl, { signal: AbortSignal.timeout(8_000) });
        chartBuffer = Buffer.from(await img.arrayBuffer());
      } catch {
        chartBuffer = undefined;
      }

      const aiText = buildAiSuggestionText(history);
      const displayName = String(user.name || user.email || "PennyWize user").slice(0, 200);

      // ✅ Manage preferences still uses magic link
      let manageUrl = `${site}/app/preferences`;
      try {
        const { data: manageLinkData } =
          await supabase.auth.admin.generateLink({
            type: "magiclink",
            email: user.email,
            options: {
              redirectTo: `${site}/auth/callback?next=${encodeURIComponent(
                "/app/preferences"
              )}`,
            },
          });
        if (manageLinkData?.action_link)
          manageUrl = manageLinkData.action_link;
      } catch {}

      // ✅ Unsubscribe goes directly to your Vercel API route
      const unsubscribeUrl = `${site}/api/unsubscribe?user=${encodeURIComponent(
        user.id
      )}`;

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
      attachments.push({
        filename: "history.csv",
        content: convertToCSV(history),
        contentType: "text/csv",
      });

      const recentDates = history
        .slice()
        .reverse()
        .map((row) =>
          new Date(row.created_at).toLocaleDateString()
        );
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
        if (pdfBuffer)
          attachments.push({
            filename: "digest.pdf",
            content: pdfBuffer,
            contentType: "application/pdf",
          });
      } catch {}
      if (logoAttachment) attachments.push(logoAttachment);

      const emailResult = await resend.emails.send(
        {
          from: "PennyWize <digest@stingyhubby.xyz>",
          to: user.email,
          subject: "Your Weekly Financial Digest",
          html,
          ...(attachments.length ? { attachments } : {}),
        },
        { idempotencyKey: `pennywize-weekly:${periodKey}:${user.id}` }
      );

      if (emailResult.error) {
        throw new Error(emailResult.error.message || "Resend rejected the weekly digest");
      }

      await supabase.from("email_logs").insert({
        user_id: user.id,
        email: user.email,
        status: "sent",
        metadata: { type: "weekly", resendId: emailResult.data?.id },
      });

      await updateDeliveryStatus(supabase, periodKey, user.id, "sent");

      sentCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await updateDeliveryStatus(supabase, periodKey, user.id, "failed", message);
        console.error(`[weekly-digest] Failed for user ${user.id}:`, message);
      }
    }

    return res
      .status(200)
      .json({ message: "Digest run finished", sent: sentCount, duplicatesSkipped: duplicateCount });
  } catch (err) {
    console.error("💥 Unhandled error:", err);
    const msg =
      err && typeof err === "object" && "message" in err
        ? err.message
        : String(err);
    return res
      .status(500)
      .json({ error: msg || "Failed to send digest" });
  }
}
