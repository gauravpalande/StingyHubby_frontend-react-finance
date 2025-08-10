import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { getSTFinancialAdvice, getLTFinancialAdvice, getGoalsFinancialAdvice, getOLFinancialAdvice } from '../utils/suggestions';
import type { FormData } from '../types/formTypes';

const spinnerStyle: React.CSSProperties = {
  border: '2px solid #f3f3f3',
  borderTop: '2px solid #007bff',
  borderRadius: '50%',
  width: 16,
  height: 16,
  animation: 'spin 1s linear infinite',
};

const FinanceForm: React.FC = () => {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>();
  const supabase = useSupabaseClient();
  const user = useUser();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = async (data: FormData) => {
    if (!user) {
      alert('You must be logged in to submit financial data.');
      return;
    }

    setIsSubmitting(true);
    setSubmitted(false);

    const { data: goals } = await supabase
  .from('goals')
  .select('*')
  .eq('user_id', user.id)
  .single();

    const short_term_suggestion = await getSTFinancialAdvice(data, goals);
    const long_term_suggestion = await getLTFinancialAdvice(data, goals);
    const goal_suggestion = await getGoalsFinancialAdvice(data, goals);
    const oneline_suggestion = await getOLFinancialAdvice(data, goals);
    const payload = {
      ...data,
      short_term_suggestion,
      long_term_suggestion,
      goal_suggestion,
      oneline_suggestion,
      user_id: user.id,
    };

    const { error } = await supabase.from('submissions').insert([payload]);

    setIsSubmitting(false);

    if (!error) {
      setSubmitted(true);
      reset();
      setTimeout(() => setSubmitted(false), 5000); // hide after 5 seconds
    } else {
      alert('There was an error submitting the form. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px 24px', marginBottom: 24 }}>
        {['income', 'checking', 'emergency', 'health', 'retirement', 'creditCards', 'mortgage', 'carPayments', 'utilities'].map((field) => (
          <React.Fragment key={field}>
            <label htmlFor={field} style={{ fontWeight: 'bold' }}>
              {field.charAt(0).toUpperCase() + field.slice(1)}:
            </label>
            <div>
              <input
  id={field}
  type="number"
  step="any" // ✅ allow decimals
  {...register(field as keyof FormData, { required: true, valueAsNumber: true })} 
  disabled={isSubmitting}
/>
              {errors[field as keyof FormData] && (
                <span style={{ color: 'red', marginLeft: 8 }}>Required</span>
              )}
            </div>
          </React.Fragment>
        ))}
      </div>

      <button type="submit" disabled={isSubmitting} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isSubmitting ? <span style={spinnerStyle} /> : 'Submit'}
      </button>

      {submitted && (
        <p style={{ color: 'green', marginTop: 12 }}>
          ✅ Your financial data has been submitted successfully.
        </p>
      )}
    </form>
  );
};

export default FinanceForm;
