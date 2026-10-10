import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { FinancialUpdateData } from '../types/formTypes';

const MAX_GOAL_AMOUNT = 1_000_000_000_000;
const GOAL_FIELDS = [
  { name: 'emergency', label: 'Emergency fund', hint: 'Your target savings amount' },
  { name: 'retirement', label: 'Retirement', hint: 'Your long-term savings target' },
  { name: 'health', label: 'Health savings', hint: 'Your healthcare savings target' },
] as const;

type GoalSettingsFormProps = {
  register: UseFormRegister<FinancialUpdateData>;
  errors: FieldErrors<FinancialUpdateData>;
  disabled: boolean;
};

const GoalSettingsForm = ({ register, errors, disabled }: GoalSettingsFormProps) => (
  <section className="goal-settings-section" aria-labelledby="goal-settings-heading">
    <div className="finance-card-heading">
      <div>
        <span className="finance-section-eyebrow">OPTIONAL</span>
        <h2 id="goal-settings-heading">Savings goals</h2>
        <p>Set targets for your savings. Leave a target blank or enter 0 if you do not have one.</p>
      </div>
    </div>

    <div className="goal-fields-grid">
      {GOAL_FIELDS.map(({ name, label, hint }) => {
        const error = errors.goals?.[name];
        return (
          <div className="goal-field" key={name}>
            <label htmlFor={`goal-${name}`}>{label}</label>
            <span className="finance-field-hint" id={`goal-${name}-hint`}>{hint}</span>
            <div className="finance-input-wrap">
              <span aria-hidden="true" className="finance-currency-symbol">$</span>
              <input
                id={`goal-${name}`}
                type="number"
                inputMode="decimal"
                autoComplete="off"
                min={0}
                max={MAX_GOAL_AMOUNT}
                step="any"
                disabled={disabled}
                aria-describedby={`goal-${name}-hint${error ? ` goal-${name}-error` : ''}`}
                aria-invalid={Boolean(error)}
                {...register(`goals.${name}`, {
                  setValueAs: (value: string) => value === '' ? 0 : Number(value),
                  min: { value: 0, message: 'Enter a target of 0 or more.' },
                  max: { value: MAX_GOAL_AMOUNT, message: 'Target is outside the allowed range.' },
                  validate: (value) => Number.isFinite(value) || 'Enter a valid target.',
                })}
              />
            </div>
            {error && (
              <span className="finance-field-error" id={`goal-${name}-error`}>
                {error.message || 'Enter a valid target.'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  </section>
);

export default GoalSettingsForm;
