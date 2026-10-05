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

const GOAL_FIELDS_CONFIG: Record<GoalField, { label: string; hint: string }> = {
  emergency: { label: 'Emergency fund', hint: 'Your target savings amount' },
  retirement: { label: 'Retirement', hint: 'Your long-term savings target' },
  health: { label: 'Health savings', hint: 'Your healthcare savings target' },
};

const GoalSettingsForm = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [goals, setGoals] = useState<Goals>(EMPTY_GOALS);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [hasError, setHasError] = useState(false);

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
        setMessage('Could not load your goals. You can still enter new targets below.');
        setHasError(true);
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
    setMessage('');
  };

  const handleSave = async () => {
    if (!user || isSaving) return;

    setIsSaving(true);
    setMessage('');

    try {
      const { error } = await supabase
        .from('goals')
        .upsert({ ...goals, user_id: user.id }, { onConflict: 'user_id' });

      if (error) {
        console.error('Error saving goals:', error.message);
        setMessage('Could not save your goals. Please try again.');
        setHasError(true);
        return;
      }

      setMessage('Goals saved successfully.');
      setHasError(false);
    } catch (error) {
      console.error('Error saving goals:', error);
      setMessage('Could not save your goals. Please try again.');
      setHasError(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="goal-settings-card" aria-labelledby="goal-settings-heading">
      <div className="finance-card-heading">
        <div>
          <span className="finance-section-eyebrow">OPTIONAL</span>
          <h2 id="goal-settings-heading">Savings goals</h2>
          <p>Set targets to see how your balances are progressing.</p>
        </div>
      </div>

      <div className="goal-fields-grid">
        {GOAL_FIELDS.map((field) => {
          const { label, hint } = GOAL_FIELDS_CONFIG[field];
          return (
            <div className="goal-field" key={field}>
              <label htmlFor={`goal-${field}`}>{label}</label>
              <span className="finance-field-hint" id={`goal-${field}-hint`}>{hint}</span>
              <div className="finance-input-wrap">
                <span aria-hidden="true" className="finance-currency-symbol">$</span>
                <input
                  id={`goal-${field}`}
                  type="number"
                  inputMode="decimal"
                  autoComplete="off"
                  min={0}
                  max={MAX_GOAL_AMOUNT}
                  step="any"
                  value={Number.isFinite(goals[field]) ? goals[field] : ''}
                  onChange={(event) => handleChange(field, event.target.value)}
                  disabled={isSaving}
                  aria-describedby={`goal-${field}-hint`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="goal-form-footer">
        <button className="finance-secondary-submit" type="button" onClick={handleSave} disabled={isSaving || !user}>
          {isSaving ? 'Saving goals…' : 'Save goals'}
        </button>
        {message && (
          <p className={`finance-form-message ${hasError ? 'finance-form-message-error' : 'finance-form-message-success'}`} role={hasError ? 'alert' : 'status'}>
            {message}
          </p>
        )}
      </div>
    </section>
  );
};

export default GoalSettingsForm;
