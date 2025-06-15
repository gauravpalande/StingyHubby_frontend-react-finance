import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { FormData } from '../types/formTypes';

const FinanceForm: React.FC = () => {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>();
  const supabase = useSupabaseClient();
  const user = useUser();
  console.log("Current user ID:", user?.id);
  const [history, setHistory] = useState<any[]>([]);

  // Fetch past submissions for logged-in user
  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

        console.log("Fetched history:", data); // inside fetchHistory

      if (!error && data) {
        setHistory(
          data.map((d: any) => ({
            ...d,
            timestamp: new Date(d.created_at).toLocaleDateString(),
          }))
        );
      }
    };
    fetchHistory();
  }, [user, supabase]);

  // Calculate summary values from history
  const totalIncome = history.reduce((sum, row) => sum + (row.income || 0), 0);
  const totalExpense = history.reduce(
    (sum, row) =>
      sum +
      (row.rent || 0) +
      (row.utilities || 0) +
      (row.mortgage || 0) +
      (row.carPayments || 0),
    0
  );
  const savings = totalIncome - totalExpense;
  const savingsPercent = totalIncome > 0 ? ((savings / totalIncome) * 100).toFixed(2) : 'N/A';

  const onSubmit = async (data: FormData) => {
    if (!user) return;

    const payload = { ...data, user_id: user.id };

    const { error } = await supabase.from('submissions').insert([payload]);
    if (!error) {
      reset();
      // re-fetch updated history
      const { data: updated, error: fetchError } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (!fetchError && updated) {
        setHistory(
          updated.map((d: any) => ({
            ...d,
            timestamp: new Date(d.created_at).toLocaleDateString(),
          }))
        );
      }
    } else {
      console.error('Submit failed:', error.message);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px 24px', marginBottom: 24 }}>
          {['emergency', 'health', 'retirement', 'creditCards', 'mortgage', 'carPayments', 'utilities'].map((field) => (
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

      {/* Chart */}
      {history.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h3>Financial History</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="emergency" stroke="#8884d8" />
              <Line type="monotone" dataKey="health" stroke="#82ca9d" />
              <Line type="monotone" dataKey="retirement" stroke="#ffc658" />
              <Line type="monotone" dataKey="creditCards" stroke="#ff7300" />
              <Line type="monotone" dataKey="mortgage" stroke="#0088FE" />
              <Line type="monotone" dataKey="carPayments" stroke="#00C49F" />
              <Line type="monotone" dataKey="utilities" stroke="#FF8042" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div style={{ marginTop: 24, padding: 16, backgroundColor: '#f3f4f6', borderRadius: 8 }}>
  <h3>📊 Financial Summary</h3>
  <p><strong>Total Income:</strong> ${totalIncome.toFixed(2)}</p>
  <p><strong>Total Expenses:</strong> ${totalExpense.toFixed(2)}</p>
  <p><strong>Savings:</strong> ${savings.toFixed(2)}</p>
  <p><strong>Monthly Savings %:</strong> {savingsPercent}%</p>
</div>
    </div>
  );
};

export default FinanceForm;
