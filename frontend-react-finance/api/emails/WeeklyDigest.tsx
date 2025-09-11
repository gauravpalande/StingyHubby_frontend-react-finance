// emails/WeeklyDigest.tsx
import * as React from 'react';
import {
  Html, Head, Preview, Body, Container, Img, Section, Text, Hr, Link,
} from '@react-email/components';

type Props = {
  logoUrl: string;          // absolute URL (https://....)
  siteUrl: string;          // https://pennywize.vercel.app
  displayName: string;
  chartUrl: string;         // QuickChart URL
  aiText: string;           // plain text, we'll render as <pre>
  totalIncome: string;      // pre-formatted ($1,234.00)
  totalExpenses: string;
  savings: string;
};

export default function WeeklyDigestEmail(props: Props) {
  const {
    logoUrl, siteUrl, displayName, chartUrl, aiText,
    totalIncome, totalExpenses, savings,
  } = props;

  // Brand tokens
  const yellow = '#FFD54D';
  const pink   = '#E91E63';
  const green  = '#14B85A';
  const black  = '#111111';

  return (
    <Html>
      <Head />
      <Preview>Your weekly PennyWize digest is ready</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: '#fff8e1' }}>
        <Container style={{
          width: '100%',
          maxWidth: 600,
          margin: '0 auto',
          backgroundColor: '#ffffff',
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid #f1f1f1'
        }}>
          {/* Header */}
          <Section style={{ padding: '20px 24px', background: yellow }}>
            <Img
              src={logoUrl}
              alt="PennyWize"
              width="160"
              style={{ display: 'block' }}
            />
          </Section>

          {/* Greeting */}
          <Section style={{ padding: '20px 24px 0' }}>
            <Text style={{
              margin: 0,
              fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
              fontSize: 22,
              fontWeight: 800,
              color: black,
            }}>
              Hi {displayName},
            </Text>
            <Text style={{
              margin: '6px 0 0',
              fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
              fontSize: 14,
              color: '#374151',
            }}>
              Here’s your weekly financial digest:
            </Text>
          </Section>

          {/* Summary pills */}
          <Section style={{ padding: '16px 24px 0' }}>
            <table role="presentation" width="100%">
              <tbody>
                <tr>
                  <td style={{
                    background: '#f7f7f7', padding: 12, borderRadius: 10, width: '33.33%',
                    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
                    fontSize: 13, color: black, fontWeight: 600, textAlign: 'center'
                  }}>
                    📥 Income<br/><span style={{ color: green, fontWeight: 800 }}>{totalIncome}</span>
                  </td>
                  <td style={{ width: 12 }} />
                  <td style={{
                    background: '#f7f7f7', padding: 12, borderRadius: 10, width: '33.33%',
                    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
                    fontSize: 13, color: black, fontWeight: 600, textAlign: 'center'
                  }}>
                    💸 Expenses<br/><span style={{ color: pink, fontWeight: 800 }}>{totalExpenses}</span>
                  </td>
                  <td style={{ width: 12 }} />
                  <td style={{
                    background: '#f7f7f7', padding: 12, borderRadius: 10, width: '33.33%',
                    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
                    fontSize: 13, color: black, fontWeight: 600, textAlign: 'center'
                  }}>
                    💰 Savings<br/><span style={{ color: black, fontWeight: 800 }}>{savings}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* Chart */}
          <Section style={{ padding: '16px 24px 0' }}>
            <Img
              src={chartUrl}
              width="552"
              alt="Income vs. Expenses"
              style={{ width: '100%', height: 'auto', borderRadius: 10, border: '1px solid #eee' }}
            />
          </Section>

          {/* AI Suggestions */}
          <Section style={{ padding: '16px 24px' }}>
            <Text style={{
              margin: 0,
              fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
              fontSize: 16,
              fontWeight: 800,
              color: black
            }}>
              🤖 AI Suggestions
            </Text>
            <pre style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
              fontSize: 14,
              color: '#111',
              margin: '8px 0 0'
            }}>
{aiText}
            </pre>
          </Section>

          <Hr style={{ borderColor: '#eee', margin: 0 }} />

          {/* Footer */}
          <Section style={{ padding: '16px 24px 24px' }}>
            <Text style={{
              margin: '0 0 6px 0',
              fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
              fontSize: 12,
              color: '#6b7280'
            }}>
              Sent by PennyWize
            </Text>
            <Text style={{
              margin: 0,
              fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
              fontSize: 12,
              color: '#6b7280'
            }}>
              <Link href={`${siteUrl}/app/preferences`} style={{ color: '#6b7280', textDecoration: 'underline' }}>
                Manage preferences
              </Link>{' '}·{' '}
              <Link href={`${siteUrl}/unsubscribe`} style={{ color: '#6b7280', textDecoration: 'underline' }}>
                Unsubscribe
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
