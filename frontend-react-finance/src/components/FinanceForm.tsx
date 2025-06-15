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
      (row.utilities || 0) +
      (row.mortgage || 0) +
      (row.carPayments || 0),
    0
  );
  const savings = totalIncome - totalExpense;
  const savingsPercent = totalIncome > 0 ? ((savings / totalIncome) * 100).toFixed(2) : 'N/A';

  // Latest values
  const latest = history.length > 0 ? history[history.length - 1] : null;
  const latestIncome = latest ? Number(latest.income || 0) : 0;
  const latestExpense =
    latest
      ? Number(latest.utilities || 0) +
        Number(latest.mortgage || 0) +
        Number(latest.carPayments || 0)
      : 0;
  const latestSavings = latestIncome - latestExpense;
  const latestSavingsPercent =
    latestIncome > 0 ? ((latestSavings / latestIncome) * 100).toFixed(2) : 'N/A';

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
          {['income', 'emergency', 'health', 'retirement', 'creditCards', 'mortgage', 'carPayments', 'utilities'].map((field) => (
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
              <Line type="monotone" dataKey="income" stroke="#00b894" />
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
        <h3 style={{ marginBottom: 16 }}>📊 Financial Summary</h3>
        <div style={{ display: 'flex', gap: 32 }}>
          {/* Lifetime Summary */}
          <div style={{ flex: 1 }}>
        <h4>Lifetime Submission</h4>
        <p><strong>Lifetime Income:</strong> ${totalIncome.toFixed(2)}</p>
        <p><strong>Lifetime Expenses:</strong> ${totalExpense.toFixed(2)}</p>
        <p><strong>Lifetime Savings:</strong> ${savings.toFixed(2)}</p>
        <p><strong>Lifetime Monthly Savings %:</strong> {savingsPercent}%</p>
          </div>
          {/* Latest Submission */}
          {latest && (
        <div style={{ flex: 1 }}>
          <h4>Latest Submission</h4>
          <p><strong>Latest Income:</strong> ${latestIncome.toFixed(2)}</p>
          <p><strong>Latest Expenses:</strong> ${latestExpense.toFixed(2)}</p>
          <p><strong>Latest Savings:</strong> ${latestSavings.toFixed(2)}</p>
          <p><strong>Latest Savings %:</strong> {latestSavingsPercent}%</p>
        </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinanceForm;
