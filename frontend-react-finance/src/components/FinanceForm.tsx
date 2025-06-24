import React from 'react';
import { useForm } from 'react-hook-form';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { getFinancialAdvice } from '../utils/suggestions';
import type { FormData } from '../types/formTypes';

const FinanceForm: React.FC = () => {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>();
  const supabase = useSupabaseClient();
  const user = useUser();

  const onSubmit = async (data: FormData) => {
    if (!user) 
    {
      //alert popup ('You must be logged in to submit financial data.');
      alert('You must be logged in to submit financial data.');
      return;
    }

    const suggestion = await getFinancialAdvice(data);
    const payload = {
      ...data,
      suggestion: suggestion,
      user_id: user.id,
    };

    const { error } = await supabase.from('submissions').insert([payload]);
    if (!error) reset();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px 24px', marginBottom: 24 }}>
        {['income', 'checking', 'emergency', 'health', 'retirement', 'creditCards', 'mortgage', 'carPayments', 'utilities'].map((field) => (
          <React.Fragment key={field}>
            <label htmlFor={field} style={{ fontWeight: 'bold' }}>
              {field.charAt(0).toUpperCase() + field.slice(1)}:
            </label>
            <div>
              <input id={field} {...register(field as keyof FormData, { required: true })} />
              {errors[field as keyof FormData] && (
                <span style={{ color: 'red', marginLeft: 8 }}>Required</span>
              )}
            </div>
          </React.Fragment>
        ))}
      </div>
      <button type="submit">Submit</button>
    </form>
  );
};

export default FinanceForm;
