import React, { useEffect, useMemo, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

type Banner = { type: 'success' | 'warning' | 'error'; text: string };

const PreferencesPage: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();

  const [graphType, setGraphType] = useState<'line' | 'bar'>('line');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [emailWeeklyDigest, setEmailWeeklyDigest] = useState(false);
  const [emailMonthlyDigest, setEmailMonthlyDigest] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  const [busy, setBusy] = useState<'checkout' | 'portal' | 'save' | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);

  // Parse ?upgrade=... (only on client)
  const urlSearchParams = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);
  const upgradeParam = urlSearchParams.get('upgrade');

  const fetchPaidStatus = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('users')
      .select('paid_user')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('❌ Error fetching paid status:', error.message);
      return;
    }
    setIsPaid(!!data?.paid_user);
  };

  useEffect(() => {
    if (!user) return;

    const loadPrefs = async () => {
      // Load preferences
      const { data, error } = await supabase
        .from('preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Error loading preferences:', error.message);
      }

      if (data) {
        setGraphType((data.graph_type as 'line' | 'bar') || 'line');
        setShowSuggestions(data.show_suggestions ?? true);
        setEmailWeeklyDigest(data.email_weekly_digest ?? false);
        setEmailMonthlyDigest(data.email_monthly_digest ?? false);
      }

      await fetchPaidStatus();
    };

    loadPrefs();
  }, [user, supabase]);

  // Handle return from Stripe Checkout
  useEffect(() => {
    if (!upgradeParam) return;

    if (upgradeParam === 'success') {
      setBanner({ type: 'success', text: 'Upgrade successful! Thanks for supporting PennyWize 💚' });
      // Webhook should update users.paid_user; fetch to reflect
      fetchPaidStatus();
    } else if (upgradeParam === 'cancelled') {
      setBanner({ type: 'warning', text: 'Checkout cancelled. You can upgrade any time.' });
    }

    // Clean the query param from the URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('upgrade');
      window.history.replaceState({}, '', url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savePrefs = async () => {
    if (!user) return;
    try {
      setBusy('save');

      // Server-side guard: force monthly digest off for free users
      const monthly = isPaid ? emailMonthlyDigest : false;

      const { error } = await supabase
        .from('preferences')
        .upsert(
          {
            user_id: user.id,
            graph_type: graphType,
            show_suggestions: showSuggestions,
            email_weekly_digest: emailWeeklyDigest,
            email_monthly_digest: monthly,
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error('❌ Save preferences error:', error);
        setBanner({ type: 'error', text: 'Failed to save preferences.' });
        return;
      }

      if (!isPaid && emailMonthlyDigest) {
        setEmailMonthlyDigest(false); // reflect the guard locally
      }
      setBanner({ type: 'success', text: 'Preferences saved!' });
    } finally {
      setBusy(null);
    }
  };

  // Client helpers to start checkout/open portal
  const startCheckout = async (userId: string, email: string) => {
    const r = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email }),
    });

    let data: any = {};
    try {
      data = await r.json();
    } catch {
      /* ignore */
    }

    if (!r.ok) {
      const msg = data?.error || `Checkout failed (HTTP ${r.status})`;
      throw new Error(msg);
    }

    if (!data?.url) throw new Error('No checkout URL returned');
    window.location.href = data.url;
  };

  const openPortal = async (userId: string) => {
    const r = await fetch('/api/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    let data: any = {};
    try {
      data = await r.json();
    } catch {
      /* ignore */
    }

    if (!r.ok) {
      const msg = data?.error || `Portal failed (HTTP ${r.status})`;
      throw new Error(msg);
    }

    if (!data?.url) throw new Error('No portal URL returned');
    window.location.href = data.url;
  };

  const handleUpgrade = async () => {
    if (!user?.id || !user?.email) return;
    try {
      setBusy('checkout');
      await startCheckout(user.id, user.email);
    } catch (e: any) {
      setBanner({ type: 'error', text: e?.message || 'Failed to start checkout' });
    } finally {
      setBusy(null);
    }
  };

  const handleManageBilling = async () => {
    if (!user?.id) return;
    try {
      setBusy('portal');
      await openPortal(user.id);
    } catch (e: any) {
      setBanner({ type: 'error', text: e?.message || 'Failed to open billing portal' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <h2>User Preferences</h2>

      {/* Banner */}
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

      {/* Preferences */}
      <div style={{ marginBottom: 20 }}>
        <label>Chart Type: </label>
        <select
          value={graphType}
          onChange={(e) => setGraphType(e.target.value as 'line' | 'bar')}
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
            onChange={(e) => setShowSuggestions(e.target.checked)}
          />
          {' '}Show GPT Suggestions
        </label>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>
          <input
            type="checkbox"
            checked={emailWeeklyDigest}
            onChange={(e) => setEmailWeeklyDigest(e.target.checked)}
          />
          {' '}Receive Weekly Email Digest
        </label>
      </div>

      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={emailMonthlyDigest}
            onChange={(e) => setEmailMonthlyDigest(e.target.checked)}
            disabled={!isPaid}
          />
          {' '}Receive Monthly Email Report
        </label>
        {!isPaid && <span title="Premium feature">🔒</span>}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button
          onClick={savePrefs}
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
          {busy === 'save' ? 'Saving…' : 'Save Preferences'}
        </button>

        {!isPaid ? (
          <button
            onClick={handleUpgrade}
            disabled={busy !== null || !user}
            aria-busy={busy === 'checkout'}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #0d6efd',
              background: '#0d6efd',
              color: '#fff',
              cursor: busy ? 'wait' : 'pointer',
              fontWeight: 600,
            }}
            title="Upgrade to Premium for $0.99/month"
          >
            {busy === 'checkout' ? 'Starting checkout…' : 'Upgrade to Premium ($0.99/mo)'}
          </button>
        ) : (
          <button
            onClick={handleManageBilling}
            disabled={busy !== null || !user}
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
            title="Open Stripe billing portal"
          >
            {busy === 'portal' ? 'Opening portal…' : 'Manage Billing'}
          </button>
        )}
      </div>
    </div>
  );
};

export default PreferencesPage;
