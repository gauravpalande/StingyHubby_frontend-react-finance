import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

const PreferencesPage: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();

  const [graphType, setGraphType] = useState<'line' | 'bar'>('line');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [emailWeeklyDigest, setEmailWeeklyDigest] = useState(false);
  const [emailMonthlyDigest, setEmailMonthlyDigest] = useState(false);
  const [isPaid, setIsPaid] = useState(false); // ✅ track paid status

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
        return;
      }

      if (data) {
        setGraphType(data.graph_type || 'line');
        setShowSuggestions(data.show_suggestions ?? true);
        setEmailWeeklyDigest(data.email_weekly_digest ?? false);
        setEmailMonthlyDigest(data.email_monthly_digest ?? false);
      }

      // Load paid_user flag
      const { data: paidRow, error: paidErr } = await supabase
        .from('users')
        .select('paid_user')
        .eq('id', user.id)
        .single();

      if (paidErr) {
        console.error('❌ Error fetching paid status:', paidErr.message);
      } else {
        setIsPaid(!!paidRow?.paid_user);
      }
    };
    loadPrefs();
  }, [user, supabase]);

  const savePrefs = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('preferences')
      .upsert(
        {
          user_id: user.id,
          graph_type: graphType,
          show_suggestions: showSuggestions,
          email_weekly_digest: emailWeeklyDigest,
          email_monthly_digest: emailMonthlyDigest, // ✅ will save only current state
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      alert('❌ Failed to save preferences');
      console.error(error);
    } else {
      alert('✅ Preferences saved!');
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <h2>User Preferences</h2>

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
          Show GPT Suggestions
        </label>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>
          <input
            type="checkbox"
            checked={emailWeeklyDigest}
            onChange={(e) => setEmailWeeklyDigest(e.target.checked)}
          />
          Receive Weekly Email Digest
        </label>
      </div>

      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={emailMonthlyDigest}
            onChange={(e) => setEmailMonthlyDigest(e.target.checked)}
            disabled={!isPaid} // ✅ disable if not paid
          />
          Receive Monthly Email Report
        </label>
        {!isPaid && <span title="Premium feature">🔒</span>}
      </div>

      <button onClick={savePrefs}>Save Preferences</button>
    </div>
  );
};

export default PreferencesPage;
