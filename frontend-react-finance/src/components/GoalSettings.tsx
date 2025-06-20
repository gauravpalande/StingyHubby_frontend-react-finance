// components/GoalSettings.tsx
import { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

const GoalSettings = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [goals, setGoals] = useState<any>({
    emergency: 0,
    retirement: 0,
    health: 0
  });

  useEffect(() => {
    const loadGoals = async () => {
  if (!user) return;

  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', user.id)
    .limit(1); // avoid 406
  if (error) {
    console.error('Error loading goals:', error.message);
  }
  if (data && data.length > 0) {
    setGoals(data[0]);
  }
};
    loadGoals();
  }, [user]);

  const handleChange = (field: string, value: string) => {
    setGoals((prev: any) => ({ ...prev, [field]: parseFloat(value) }));
  };

  const handleSave = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('goals')
      .upsert({ ...goals, user_id: user.id }, { onConflict: 'user_id' });

    if (error) {
      console.error('Error saving goals:', error.message);
      alert('Failed to save');
    } else {
      alert('Goals saved!');
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: '0 auto' }}>
      <h2>🎯 Customize Your Financial Goals</h2>
      {['emergency', 'retirement', 'health'].map((field) => (
        <div key={field} style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>{field} goal ($)</label>
          <input
            type="number"
            value={goals[field] || ''}
            onChange={(e) => handleChange(field, e.target.value)}
            style={{ width: '100%', padding: 8 }}
          />
        </div>
      ))}
      <button onClick={handleSave} style={{ padding: '10px 20px' }}>
        Save Goals
      </button>
    </div>
  );
};

export default GoalSettings;
