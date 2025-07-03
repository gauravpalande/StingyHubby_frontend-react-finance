// components/GoalSettings.tsx
import { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

const GOAL_FIELDS = ['emergency', 'retirement', 'health'];

const GoalSettings = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [goals, setGoals] = useState<any>({
    emergency: 0,
    retirement: 0,
    health: 0
  });
  const [progress, setProgress] = useState<any>({
    emergency: 0,
    retirement: 0,
    health: 0
  });

  // Load goals from DB
  useEffect(() => {
    const loadGoals = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);
      if (error) {
        console.error('Error loading goals:', error.message);
      }
      if (data && data.length > 0) {
        setGoals(data[0]);
      }
    };
    loadGoals();
  }, [user, supabase]);

  // Load progress for each goal from finance data
  useEffect(() => {
    const loadProgress = async () => {
      if (!user) return;

      // Assuming finance table has columns: user_id, emergency, retirement, health
      const { data, error } = await supabase
        .from('finance')
        .select('emergency,retirement,health')
        .eq('user_id', user.id)
        .limit(1);

      if (error) {
        console.error('Error loading finance progress:', error.message);
      }
      if (data && data.length > 0) {
        setProgress(data[0]);
      }
    };
    loadProgress();
  }, [user, supabase]);

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

  // Helper to calculate progress percent
  const getProgressPercent = (field: string) => {
    const goalValue = goals[field] || 0;
    const progressValue = progress[field] || 0;
    if (!goalValue || goalValue <= 0) return 0;
    return Math.min(100, Math.round((progressValue / goalValue) * 100));
  };

  return (
    <div style={{ maxWidth: 500, margin: '0 auto' }}>
      <h2>🎯 Customize Your Financial Goals</h2>
      {GOAL_FIELDS.map((field) => (
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

      <div style={{ marginTop: 32 }}>
        <h3>Goal Progress</h3>
        {GOAL_FIELDS.map((field) => {
          const percent = getProgressPercent(field);
          return (
            <div key={field} style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 4 }}>
                <strong>{field.charAt(0).toUpperCase() + field.slice(1)}:</strong> {progress[field] || 0} / {goals[field] || 0}
              </div>
              <div style={{
                background: '#eee',
                borderRadius: 8,
                height: 20,
                width: '100%',
                overflow: 'hidden',
                boxShadow: 'inset 0 1px 2px #ccc'
              }}>
                <div style={{
                  width: `${percent}%`,
                  background: percent === 100 ? '#4caf50' : '#2196f3',
                  height: '100%',
                  transition: 'width 0.5s'
                }} />
              </div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{percent}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GoalSettings;
