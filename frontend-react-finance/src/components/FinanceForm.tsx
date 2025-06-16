import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getFinancialAdvice } from '../utils/suggestions';
import type { FormData } from '../types/formTypes';

const FinanceForm: React.FC = () => {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>();
  const supabase = useSupabaseClient();
  const user = useUser();
  const [history, setHistory] = useState<any[]>([]);
  const [advice, setAdvice] = useState<string>('');

  const expenseCategories = ['mortgage', 'carPayments', 'utilities'];

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

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

  const totalIncome = history.reduce((sum, row) => sum + (row.income || 0), 0);
  const totalExpense = history.reduce(
    (sum, row) => sum + (row.utilities || 0) + (row.mortgage || 0) + (row.carPayments || 0),
    0
  );
  const savings = totalIncome - totalExpense;
  const savingsPercent = totalIncome > 0 ? ((savings / totalIncome) * 100).toFixed(2) : 'N/A';

  const latest = history.length > 0 ? history[history.length - 1] : null;
  const latestIncome = latest ? Number(latest.income || 0) : 0;
  const latestExpense = latest ? (latest.utilities || 0) + (latest.mortgage || 0) + (latest.carPayments || 0) : 0;
  const latestSavings = latestIncome - latestExpense;
  const latestSavingsPercent = latestIncome > 0 ? ((latestSavings / latestIncome) * 100).toFixed(2) : 'N/A';

  const expenseBreakdown = latest ? expenseCategories.map((key) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: latest[key] || 0,
  })) : [];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

  const onSubmit = async (data: FormData) => {
    if (!user) return;

      // 1. Get GPT-powered suggestion
  const suggestion = await getFinancialAdvice(data);


    // 2. Prepare payload with suggestion
  const payload = {
    ...data,
    suggestion: suggestion,
    user_id: user.id,
  };

    // 3. Insert data into Supabase
    const { error } = await supabase.from('submissions').insert([payload]);
    if (!error) {
      reset();

      // 4. Re-Fetch updated history
      const { data: updated, error: fetchError } = await supabase
      .from('submissions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

      if (!fetchError && updated) {
        const updatedHistory = updated.map((d: any) => ({
          ...d,
          timestamp: new Date(d.created_at).toLocaleDateString(),
        }));
        setHistory(updatedHistory);
        setAdvice(suggestion);
      } else {
        console.error('Error fetching updated history:', fetchError);
      }
    }
    else {
      console.error('Error inserting data:', error);
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

      {history.length > 0 && (
        <>
          <div style={{ marginTop: 40 }}>
            <h3>Financial History</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Legend />
                {['income', 'emergency', 'health', 'retirement', 'creditCards', 'mortgage', 'carPayments', 'utilities'].map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={COLORS[index % COLORS.length]}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: 40 }}>
            <h3>Expense Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expenseBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {expenseBreakdown.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div style={{ marginTop: 24, padding: 16, backgroundColor: '#f3f4f6', borderRadius: 8 }}>
        <h3 style={{ marginBottom: 16 }}>📊 Financial Summary</h3>
        <div style={{ display: 'flex', gap: 32 }}>
          <div style={{ flex: 1 }}>
            <h4>Lifetime Summary</h4>
            <p><strong>Lifetime Income:</strong> ${totalIncome.toFixed(2)}</p>
            <p><strong>Lifetime Expenses:</strong> ${totalExpense.toFixed(2)}</p>
            <p><strong>Lifetime Savings:</strong> ${savings.toFixed(2)}</p>
            <p><strong>Lifetime Monthly Savings %:</strong> {savingsPercent}%</p>
          </div>
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
        {advice && (
          <div style={{ marginTop: 24 }}>
            <h4>🧠 GPT Advice</h4>
            <p>{advice}</p>
          </div>
        )}
      </div>
        {latest?.suggestion && (
          <div style={{ marginTop: 24, padding: 16, backgroundColor: '#fff0f0', borderRadius: 8 }}>
            <h4>💡 GPT Suggestion</h4>
            <p>{latest.suggestion}</p>
          </div>
        )}
      </div>
  );
};

export default FinanceForm;
