import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { generateFinancialSuggestions } from '../utils/suggestions';
import type { FormData } from '../types/formTypes';

type FinanceField = keyof FormData;

const MAX_FINANCIAL_AMOUNT = 1_000_000_000_000;

const FINANCIAL_FIELDS: readonly {
  name: FinanceField;
  label: string;
  hint: string;
}[] = [
  { name: 'income', label: 'Monthly income', hint: 'Take-home pay' },
  { name: 'checking', label: 'Checking balance', hint: 'Current account balance' },
  { name: 'emergency', label: 'Emergency savings', hint: 'Current balance' },
  { name: 'health', label: 'Health savings', hint: 'Current balance' },
  { name: 'retirement', label: 'Retirement savings', hint: 'Current balance' },
  { name: 'creditCards', label: 'Credit card payments', hint: 'Monthly total' },
  { name: 'mortgage', label: 'Mortgage or rent', hint: 'Monthly payment' },
  { name: 'carPayments', label: 'Car payments', hint: 'Monthly total' },
  { name: 'utilities', label: 'Utilities', hint: 'Monthly total' },
];

const FIELD_GROUPS: readonly {
  title: string;
  description: string;
  fields: readonly FinanceField[];
}[] = [
  {
    title: 'Income & cash',
    description: 'What comes in and what you have on hand.',
    fields: ['income', 'checking'],
  },
  {
    title: 'Savings balances',
    description: 'Your current savings and investment balances.',
    fields: ['emergency', 'health', 'retirement'],
  },
  {
    title: 'Monthly expenses',
    description: 'Your regular payments each month.',
    fields: ['creditCards', 'mortgage', 'carPayments', 'utilities'],
  },
];

const FinanceForm: React.FC = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>();
  const supabase = useSupabaseClient();
  const user = useUser();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

  const usePreviousValues = async () => {
    if (!user || isLoadingPrevious || isSubmitting) return;

    setIsLoadingPrevious(true);
    setMessage('');

    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('income, checking, emergency, health, retirement, creditCards, mortgage, carPayments, utilities')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        setMessageType('error');
        setMessage('Could not load your previous update. Please try again.');
        return;
      }

      if (!data) {
        setMessageType('info');
        setMessage('You do not have a previous update yet. Enter your amounts below.');
        return;
      }

      const previousValues: FormData = {
        income: Number(data.income) || 0,
        checking: Number(data.checking) || 0,
        emergency: Number(data.emergency) || 0,
        health: Number(data.health) || 0,
        retirement: Number(data.retirement) || 0,
        creditCards: Number(data.creditCards) || 0,
        mortgage: Number(data.mortgage) || 0,
        carPayments: Number(data.carPayments) || 0,
        utilities: Number(data.utilities) || 0,
      };

      reset(previousValues);
      setMessageType('success');
      setMessage('Previous values loaded. Update anything that has changed.');
    } catch (error) {
      console.error('Error loading previous financial update:', error);
      setMessageType('error');
      setMessage('Could not load your previous update. Please try again.');
    } finally {
      setIsLoadingPrevious(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!user) {
      setMessageType('error');
      setMessage('Sign in to save a financial update.');
      return;
    }

    setIsSubmitting(true);
    setMessage('Generating your financial suggestions…');
    setMessageType('info');

    try {
      const { data: goals } = await supabase
        .from('goals')
        .select('emergency, retirement, health')
        .eq('user_id', user.id)
        .maybeSingle();

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Your session expired. Sign in again to generate suggestions.');
      }

      const suggestions = await generateFinancialSuggestions(data, goals, session.access_token);
      const { error } = await supabase.from('submissions').insert([{
        ...data,
        ...suggestions,
        user_id: user.id,
      }]);

      if (error) {
        throw new Error('Could not save your financial update. Please try again.');
      }

      reset();
      setMessageType('success');
      setMessage('Financial update saved successfully.');
    } catch (error) {
      console.error('Financial update error:', error);
      setMessageType('error');
      setMessage(error instanceof Error ? error.message : 'Could not save your update. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="finance-entry-card" aria-labelledby="finance-entry-heading">
      <div className="finance-entry-heading-row">
        <div>
          <h2 id="finance-entry-heading">Financial snapshot</h2>
          <p className="finance-entry-intro">Enter your monthly income and expenses alongside your current balances.</p>
        </div>
        <button
          className="finance-previous-button"
          type="button"
          onClick={usePreviousValues}
          disabled={isLoadingPrevious || isSubmitting || !user}
        >
          {isLoadingPrevious ? 'Loading…' : 'Use previous values'}
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="finance-groups-grid">
          {FIELD_GROUPS.map((group) => (
            <fieldset className="finance-field-group" key={group.title} disabled={isSubmitting}>
              <legend>{group.title}</legend>
              <p className="finance-group-description">{group.description}</p>

              {group.fields.map((fieldName) => {
                const field = FINANCIAL_FIELDS.find(({ name }) => name === fieldName)!;
                const error = errors[field.name];

                return (
                  <div className="finance-field" key={field.name}>
                    <label htmlFor={field.name}>{field.label}</label>
                    <span className="finance-field-hint" id={`${field.name}-hint`}>{field.hint}</span>
                    <div className="finance-input-wrap">
                      <span aria-hidden="true" className="finance-currency-symbol">$</span>
                      <input
                        id={field.name}
                        type="number"
                        inputMode="decimal"
                        autoComplete="off"
                        step="any"
                        min={-MAX_FINANCIAL_AMOUNT}
                        max={MAX_FINANCIAL_AMOUNT}
                        aria-describedby={`${field.name}-hint${error ? ` ${field.name}-error` : ''}`}
                        aria-invalid={Boolean(error)}
                        {...register(field.name, {
                          required: 'Enter an amount, or enter 0 if it does not apply.',
                          valueAsNumber: true,
                          min: { value: -MAX_FINANCIAL_AMOUNT, message: 'Amount is outside the allowed range.' },
                          max: { value: MAX_FINANCIAL_AMOUNT, message: 'Amount is outside the allowed range.' },
                          validate: (value) => Number.isFinite(value) || 'Enter a valid number.',
                        })}
                      />
                    </div>
                    {error && (
                      <span className="finance-field-error" id={`${field.name}-error`}>
                        {error.message || 'Enter a valid amount.'}
                      </span>
                    )}
                  </div>
                );
              })}
            </fieldset>
          ))}
        </div>

        <div className="finance-form-footer">
          <button className="finance-submit-button" type="submit" disabled={isSubmitting || isLoadingPrevious}>
            {isSubmitting && <span className="finance-spinner" aria-hidden="true" />}
            {isSubmitting ? 'Saving update…' : 'Save financial update'}
          </button>
          <p className="finance-form-note">A new dated snapshot is added to your financial history.</p>
        </div>

        {message && (
          <p
            className={`finance-form-message finance-form-message-${messageType}`}
            role={messageType === 'error' ? 'alert' : 'status'}
          >
            {message}
          </p>
        )}
      </form>
    </section>
  );
};

export default FinanceForm;
