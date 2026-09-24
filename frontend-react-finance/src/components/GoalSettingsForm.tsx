import { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

const GOAL_FIELDS = ['emergency', 'retirement', 'health'] as const;
const MAX_GOAL_AMOUNT = 1_000_000_000_000;

type GoalField = (typeof GOAL_FIELDS)[number];
type Goals = Record<GoalField, number>;

const EMPTY_GOALS: Goals = {
  emergency: 0,
  retirement: 0,
  health: 0,
};

const GOAL_LABELS: Record<GoalField, string> = {
  emergency: 'Emergency fund',
  retirement: 'Retirement',
  health: 'Health savings',
};

const GoalSettingsForm = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [goals, setGoals] = useState<Goals>(EMPTY_GOALS);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadGoals = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('goals')
        .select('emergency, retirement, health')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading goals:', error.message);
        return;
      }

      if (data) {
        setGoals({
          emergency: Number(data.emergency) || 0,
          retirement: Number(data.retirement) || 0,
          health: Number(data.health) || 0,
        });
      }
    };

    loadGoals();
  }, [supabase, user]);

  const handleChange = (field: GoalField, value: string) => {
    const amount = Number(value);
    setGoals((current) => ({
      ...current,
      [field]: Number.isFinite(amount) ? amount : 0,
    }));
  };

  const handleSave = async () => {
    if (!user || isSaving) return;

    setIsSaving(true);
    const { error } = await supabase
      .from('goals')
      .upsert({ ...goals, user_id: user.id }, { onConflict: 'user_id' });
    setIsSaving(false);

    if (error) {
      console.error('Error saving goals:', error.message);
      alert('Failed to save goals. Please try again.');
      return;
    }

    alert('Goals saved!');
  };

  return (
    <section aria-labelledby="goal-settings-heading" style={{ maxWidth: 500 }}>
      <h2 id="goal-settings-heading">Set Financial Goals</h2>

      {GOAL_FIELDS.map((field) => (
        <label key={field} style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ display: 'block', marginBottom: 4 }}>{GOAL_LABELS[field]} goal ($)</span>
          <input
            type="number"
            min={0}
            max={MAX_GOAL_AMOUNT}
            step="any"
            value={Number.isFinite(goals[field]) ? goals[field] : ''}
            onChange={(event) => handleChange(field, event.target.value)}
            disabled={isSaving}
            style={{ width: '100%', padding: 8 }}
          />
        </label>
      ))}

      <button type="button" onClick={handleSave} disabled={isSaving} style={{ padding: '10px 20px' }}>
        {isSaving ? 'Saving...' : 'Save Goals'}
      </button>
    </section>
  );
};

export default GoalSettingsForm;
