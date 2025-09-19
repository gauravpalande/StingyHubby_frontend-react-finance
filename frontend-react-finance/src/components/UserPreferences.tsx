import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

const UserPreferences: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [graphType, setGraphType] = useState<'line' | 'bar'>('line');
  const [wantsDigest, setWantsDigest] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchPrefs = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('preferences')
        .select('graph_type')
        .eq('user_id', user.id)
        .single();

      if (data?.graph_type) {
        setGraphType(data.graph_type);
      }

      const { data: userData } = await supabase
        .from('users')
        .select('wants_digest')
        .eq('user_id', user.id)
        .single();

      if (userData) {
        setWantsDigest(userData.wants_digest);
      }
    };

    fetchPrefs();
  }, [user]);

  const savePrefs = async () => {
    if (!user) return;
    setSaving(true);

    await supabase
      .from('preferences')
      .upsert({ user_id: user.id, graph_type: graphType });

    await supabase
      .from('users')
      .update({ wants_digest: wantsDigest })
      .eq('user_id', user.id);

    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h3>📊 Preferences</h3>

      <label>Graph Type</label>
      <select value={graphType} onChange={(e) => setGraphType(e.target.value as any)}>
        <option value="line">Line</option>
        <option value="bar">Bar</option>
      </select>

      <label style={{ display: 'block', marginTop: '1rem' }}>
        <input
          type="checkbox"
          checked={wantsDigest}
          onChange={(e) => setWantsDigest(e.target.checked)}
        />{' '}
        Receive Weekly Email Digests
      </label>

      <button
        onClick={savePrefs}
        disabled={saving}
        style={{ marginTop: 20 }}
      >
        {saving ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  );
};

export default UserPreferences;
