// emails/WeeklyDigest.tsx
import * as React from "react";
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Img,
  Hr,
  Link,
} from "@react-email/components";

type WeeklyDigestProps = {
  displayName: string;
  logoUrl: string;        // absolute URL
  chartUrl: string;       // absolute URL
  totalIncome: string;    // already formatted like "$5,431"
  totalExpenses: string;  // formatted
  savings: string;        // formatted
  aiText: string;         // plain text; will render inside <pre>
  siteUrl: string;        // e.g. "https://pennywize.vercel.app"
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
}: WeeklyDigestProps) {
  return (
    <Html>
      <Head />
      <Preview>Your weekly PennyWize digest is ready</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: COLORS.bg }}>
        <Container
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
          <Section style={{ padding: "20px 24px", background: COLORS.yellow }}>
            <Img
              src={logoUrl}
              alt="PennyWize"
              width="180"
              style={{ display: "block" }}
            />
          </Section>

          <Section style={{ padding: "20px 24px 0" }}>
            <Text
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
            </Text>
            <Text
              style={{
                margin: "6px 0 0",
                fontFamily:
                  "system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif",
                fontSize: 14,
                color: COLORS.grayText,
              }}
            >
              Here’s your weekly financial digest:
            </Text>
          </Section>

          <Section style={{ padding: "16px 24px 0" }}>
            <table role="presentation" width="100%">
              <tbody>
                <tr>
                  <td
                    style={{
                      background: COLORS.chipBg,
                      padding: 12,
                      borderRadius: 10,
                      width: "33.33%",
                      textAlign: "center",
                      fontFamily:
                        "system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif",
                      fontSize: 13,
                      color: COLORS.black,
                      fontWeight: 600,
                    }}
                  >
                    📥 Income
                    <br />
                    <span style={{ color: COLORS.green, fontWeight: 800 }}>
                      {totalIncome}
                    </span>
                  </td>
                  <td style={{ width: 12 }} />
                  <td
                    style={{
                      background: COLORS.chipBg,
                      padding: 12,
                      borderRadius: 10,
                      width: "33.33%",
                      textAlign: "center",
                      fontFamily:
                        "system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif",
                      fontSize: 13,
                      color: COLORS.black,
                      fontWeight: 600,
                    }}
                  >
                    💸 Expenses
                    <br />
                    <span style={{ color: COLORS.pink, fontWeight: 800 }}>
                      {totalExpenses}
                    </span>
                  </td>
                  <td style={{ width: 12 }} />
                  <td
                    style={{
                      background: COLORS.chipBg,
                      padding: 12,
                      borderRadius: 10,
                      width: "33.33%",
                      textAlign: "center",
                      fontFamily:
                        "system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif",
                      fontSize: 13,
                      color: COLORS.black,
                      fontWeight: 600,
                    }}
                  >
                    💰 Savings
                    <br />
                    <span style={{ color: COLORS.black, fontWeight: 800 }}>
                      {savings}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section style={{ padding: "16px 24px 0" }}>
            <Img
              src={chartUrl}
              width="552"
              alt="Income vs. Expenses"
              style={{
                width: "100%",
                height: "auto",
                borderRadius: 10,
                border: "1px solid #eee",
                display: "block",
              }}
            />
          </Section>

          <Section style={{ padding: "16px 24px" }}>
            <Text
              style={{
                margin: 0,
                fontFamily:
                  "system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif",
                fontSize: 16,
                fontWeight: 800,
                color: COLORS.black,
              }}
            >
              🤖 AI Suggestions
            </Text>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontFamily:
                  "system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif",
                fontSize: 14,
                color: COLORS.black,
                margin: "8px 0 0",
              }}
            >
              {aiText}
            </pre>
          </Section>

          <Hr style={{ borderColor: "#eee", margin: 0 }} />

          <Section style={{ padding: "16px 24px 24px" }}>
            <Text
              style={{
                margin: "0 0 6px 0",
                fontFamily:
                  "system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Sent by PennyWize
            </Text>
            <Text
              style={{
                margin: 0,
                fontFamily:
                  "system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              <Link
                href={`${siteUrl}/app/preferences`}
                style={{ color: "#6b7280", textDecoration: "underline" }}
              >
                Manage preferences
              </Link>{" "}
              ·{" "}
              <Link
                href={`${siteUrl}/unsubscribe`}
                style={{ color: "#6b7280", textDecoration: "underline" }}
              >
                Unsubscribe
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
