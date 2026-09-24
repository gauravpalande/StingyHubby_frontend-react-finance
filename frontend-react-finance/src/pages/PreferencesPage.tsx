import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { openBillingPortal } from '../lib/billing';

type Banner = { type: 'success' | 'warning' | 'error'; text: string };

const PreferencesPage: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();

  const [graphType, setGraphType] = useState<'line' | 'bar'>('line');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [emailWeeklyDigest, setEmailWeeklyDigest] = useState(false);
  const [emailMonthlyDigest, setEmailMonthlyDigest] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [busy, setBusy] = useState<'portal' | 'save' | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadPreferences = async () => {
      const [preferencesResult, subscriptionResult] = await Promise.all([
        supabase
          .from('preferences')
          .select('graph_type, show_suggestions, email_weekly_digest, email_monthly_digest')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('users')
          .select('paid_user')
          .eq('id', user.id)
          .maybeSingle(),
      ]);

      if (preferencesResult.error) {
        console.error('Error loading preferences:', preferencesResult.error.message);
      }

      if (preferencesResult.data) {
        setGraphType((preferencesResult.data.graph_type as 'line' | 'bar') || 'line');
        setShowSuggestions(preferencesResult.data.show_suggestions ?? true);
        setEmailWeeklyDigest(preferencesResult.data.email_weekly_digest ?? false);
        setEmailMonthlyDigest(preferencesResult.data.email_monthly_digest ?? false);
      }

      if (subscriptionResult.error) {
        console.error('Error loading existing subscription status:', subscriptionResult.error.message);
      } else {
        setHasActiveSubscription(Boolean(subscriptionResult.data?.paid_user));
      }
    };

    loadPreferences();
  }, [user, supabase]);

  const savePreferences = async () => {
    if (!user) return;

    try {
      setBusy('save');
      const { error } = await supabase
        .from('preferences')
        .upsert(
          {
            user_id: user.id,
            graph_type: graphType,
            show_suggestions: showSuggestions,
            email_weekly_digest: emailWeeklyDigest,
            email_monthly_digest: emailMonthlyDigest,
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error('Save preferences error:', error);
        setBanner({ type: 'error', text: 'Failed to save preferences.' });
        return;
      }

      setBanner({ type: 'success', text: 'Preferences saved!' });
    } finally {
      setBusy(null);
    }
  };

  const handleManageBilling = async () => {
    if (!user?.id) return;

    try {
      setBusy('portal');
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      await openBillingPortal(session.access_token);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to open billing portal';
      setBanner({ type: 'error', text: message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <h2>User Preferences</h2>

      <div
        style={{
          marginBottom: 16,
          padding: '10px 12px',
          borderRadius: 8,
          background: '#e6ffed',
          border: '1px solid #34c36b',
        }}
      >
        All PennyWize features are free for every signed-in user.
      </div>

      {hasActiveSubscription && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 12px',
            borderRadius: 8,
            background: '#fff8e1',
            border: '1px solid #ffb300',
          }}
        >
          You have an existing subscription. All features are now free, so you can use the
          billing portal below to review or cancel it.
        </div>
      )}

      {banner && (
        <div
          role="status"
          style={{
            marginBottom: 16,
            padding: '10px 12px',
            borderRadius: 8,
            background:
              banner.type === 'success' ? '#e6ffed' :
              banner.type === 'warning' ? '#fff8e1' : '#ffebee',
            border:
              banner.type === 'success' ? '1px solid #34c36b' :
              banner.type === 'warning' ? '1px solid #ffb300' : '1px solid #f44336',
          }}
        >
          {banner.text}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <label>Chart Type: </label>
        <select
          value={graphType}
          onChange={(event) => setGraphType(event.target.value as 'line' | 'bar')}
        >
          <option value="line">Line Chart</option>
          <option value="bar">Bar Chart</option>
        </select>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>
          <input
            type="checkbox"
            checked={showSuggestions}
            onChange={(event) => setShowSuggestions(event.target.checked)}
          />
          {' '}Show GPT Suggestions
        </label>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>
          <input
            type="checkbox"
            checked={emailWeeklyDigest}
            onChange={(event) => setEmailWeeklyDigest(event.target.checked)}
          />
          {' '}Receive Weekly Email Digest
        </label>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>
          <input
            type="checkbox"
            checked={emailMonthlyDigest}
            onChange={(event) => setEmailMonthlyDigest(event.target.checked)}
          />
          {' '}Receive Monthly Email Report
        </label>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button
          onClick={savePreferences}
          disabled={busy !== null}
          aria-busy={busy === 'save'}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #198754',
            background: '#198754',
            color: '#fff',
            fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy === 'save' ? 'Saving...' : 'Save Preferences'}
        </button>

        {hasActiveSubscription && (
          <button
            onClick={handleManageBilling}
            disabled={busy !== null}
            aria-busy={busy === 'portal'}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #6c757d',
              background: '#f8f9fa',
              color: '#212529',
              cursor: busy ? 'wait' : 'pointer',
              fontWeight: 600,
            }}
            title="Review or cancel your existing Stripe subscription"
          >
            {busy === 'portal' ? 'Opening portal...' : 'Manage Existing Subscription'}
          </button>
        )}
      </div>
    </div>
  );
};

export default PreferencesPage;
