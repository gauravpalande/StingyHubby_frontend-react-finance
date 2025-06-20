import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

const PreferencesPage: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [graphType, setGraphType] = useState<'line' | 'bar'>('line');
  const [showSuggestions, setShowSuggestions] = useState(true);

  useEffect(() => {
    if (!user) return;
    const loadPrefs = async () => {
      const { data } = await supabase
        .from('preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (data) {
        setGraphType(data.graph_type || 'line');
        setShowSuggestions(data.show_suggestions ?? true);
      }
    };
    loadPrefs();
  }, [user]);

  const savePrefs = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('preferences')
      .upsert({
        user_id: user.id,
        graph_type: graphType,
        show_suggestions: showSuggestions,
      });
    if (error) {
      alert('Failed to save preferences');
    } else {
      alert('Preferences saved!');
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <h2>User Preferences</h2>
      <div style={{ marginBottom: 20 }}>
        <label>Chart Type: </label>
        <select value={graphType} onChange={(e) => setGraphType(e.target.value as 'line' | 'bar')}>
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
      <button onClick={savePrefs}>Save Preferences</button>
    </div>
  );
};

export default PreferencesPage;
