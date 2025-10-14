// api/emails/WeeklyDigest.tsx
import * as React from "react";

type WeeklyDigestProps = {
  displayName: string;
  logoUrl: string;        // absolute URL or cid:...
  chartUrl: string;       // absolute URL
  totalIncome: string;    // formatted like "$5,431"
  totalExpenses: string;  // formatted
  savings: string;        // formatted
  aiText: string;         // plain text; will render inside <pre>
  siteUrl: string;        // e.g. "https://pennywize.vercel.app"
  manageUrl?: string;     // NEW: fully-qualified link
  unsubscribeUrl?: string;// NEW: fully-qualified link
};

const COLORS = {
  bg: "#fff8e1",
  card: "#ffffff",
  cardBorder: "#f1f1f1",
  grayText: "#374151",
  chipBg: "#f7f7f7",
  black: "#111111",
  green: "#0f766e",
  pink: "#be185d",
  yellow: "#fde68a",
};

export default function WeeklyDigest({
  displayName,
  logoUrl,
  chartUrl,
  totalIncome,
  totalExpenses,
  savings,
  aiText,
  siteUrl,
  manageUrl,
  unsubscribeUrl,
}: WeeklyDigestProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Your weekly PennyWize digest is ready</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style>{`
          .preheader { 
            display: none !important; 
            visibility: hidden; 
            mso-hide: all; 
            font-size: 1px; 
            line-height: 1px; 
            max-height: 0; 
            max-width: 0; 
            opacity: 0; 
            overflow: hidden; 
          }
        `}</style>
      </head>

      <body style={{ margin: 0, padding: 0, backgroundColor: COLORS.bg }}>
        <div className="preheader">Your weekly PennyWize digest is ready</div>

        <div
          style={{
            width: "100%",
            maxWidth: 600,
            margin: "0 auto",
            backgroundColor: COLORS.card,
            borderRadius: 12,
            overflow: "hidden",
            border: `1px solid ${COLORS.cardBorder}`,
          }}
        >
          {/* Header */}
          <div style={{ padding: "20px 24px", background: COLORS.yellow }}>
            <img
              src={logoUrl}
              alt="PennyWize"
              width={180}
              style={{ display: "block", border: 0, outline: "none" }}
            />
          </div>

          {/* Greeting */}
          <div style={{ padding: "20px 24px 0" }}>
            <p
              style={{
                margin: 0,
                fontFamily:
                  "system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif",
                fontSize: 22,
                fontWeight: 800,
                color: COLORS.black,
              }}
            >
              Hi {displayName},
            </p>
            <p
              style={{
                margin: "6px 0 0",
                fontFamily:
                  "system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif",
                fontSize: 14,
                color: COLORS.grayText,
              }}
            >
              Here’s your weekly financial digest:
            </p>
          </div>

          {/* KPI chips */}
          <div style={{ padding: "16px 24px 0" }}>
            <table role="presentation" width="100%" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
              <tbody>
                <tr>
                  <td style={{ background: COLORS.chipBg, padding: 12, borderRadius: 10, width: "33.33%", textAlign: "center" as const, fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif", fontSize: 13, color: COLORS.black, fontWeight: 600 }}>
                    📥 Income<br />
                    <span style={{ color: COLORS.green, fontWeight: 800 }}>{totalIncome}</span>
                  </td>
                  <td style={{ width: 12 }} />
                  <td style={{ background: COLORS.chipBg, padding: 12, borderRadius: 10, width: "33.33%", textAlign: "center" as const, fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif", fontSize: 13, color: COLORS.black, fontWeight: 600 }}>
                    💸 Expenses<br />
                    <span style={{ color: COLORS.pink, fontWeight: 800 }}>{totalExpenses}</span>
                  </td>
                  <td style={{ width: 12 }} />
                  <td style={{ background: COLORS.chipBg, padding: 12, borderRadius: 10, width: "33.33%", textAlign: "center" as const, fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif", fontSize: 13, color: COLORS.black, fontWeight: 600 }}>
                    💰 Savings<br />
                    <span style={{ color: COLORS.black, fontWeight: 800 }}>{savings}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Chart */}
          <div style={{ padding: "16px 24px 0" }}>
            <img
              src={chartUrl}
              width={552}
              alt="Income vs. Expenses"
              style={{
                width: "100%",
                height: "auto",
                borderRadius: 10,
                border: "1px solid #eee",
                display: "block",
                outline: "none",
              }}
            />
          </div>

          {/* AI Suggestions */}
          <div style={{ padding: "16px 24px" }}>
            <p style={{ margin: 0, fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif", fontSize: 16, fontWeight: 800, color: COLORS.black }}>
              🤖 AI Suggestions
            </p>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif", fontSize: 14, color: COLORS.black, margin: "8px 0 0" }}>
{aiText}
            </pre>
          </div>

          {/* Divider */}
          <hr style={{ borderColor: "#eee", margin: 0, borderWidth: 1 }} />

          {/* Footer */}
          <div style={{ padding: "16px 24px 24px" }}>
            <p style={{ margin: "0 0 6px 0", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif", fontSize: 12, color: "#6b7280" }}>
              Sent by PennyWize
            </p>
            <p style={{ margin: 0, fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif", fontSize: 12, color: "#6b7280" }}>
              <a href={manageUrl ?? `${siteUrl}/app/preferences`} style={{ color: "#6b7280", textDecoration: "underline" }}>
                Manage preferences
              </a>{" "}
              ·{" "}
              <a href={unsubscribeUrl ?? `${siteUrl}/unsubscribe`} style={{ color: "#6b7280", textDecoration: "underline" }}>
                Unsubscribe
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
