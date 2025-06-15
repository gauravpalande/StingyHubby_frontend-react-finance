import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { FormData } from '../types/formTypes';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

const FinanceForm: React.FC = () => {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>();
  const supabase = useSupabaseClient();
  const user = useUser();
  const [history, setHistory] = useState<any[]>([]);
  const [suggestion, setSuggestion] = useState<string>('');

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setHistory(data.map((d: any) => ({
          ...d,
          timestamp: new Date(d.created_at).toLocaleDateString(),
        })));
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
  const latestExpense = latest ? Number(latest.utilities || 0) + Number(latest.mortgage || 0) + Number(latest.carPayments || 0) : 0;
  const latestSavings = latestIncome - latestExpense;
  const latestSavingsPercent = latestIncome > 0 ? ((latestSavings / latestIncome) * 100).toFixed(2) : 'N/A';

  const expenseCategories = ['mortgage', 'carPayments', 'utilities'];
  const latestEntry = history[history.length - 1];
  const totalExpenses = expenseCategories.reduce((sum, key) => sum + (latestEntry?.[key] || 0), 0);
  const expenseBreakdown = expenseCategories.map((key) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: latestEntry?.[key] || 0,
    percent: totalExpenses ? ((latestEntry?.[key] || 0) / totalExpenses) * 100 : 0,
  }));

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    const payload = { ...data, user_id: user.id };
    const { error } = await supabase.from('submissions').insert([payload]);
    if (!error) {
      reset();
      const { data: updated } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (updated) {
        setHistory(updated.map((d: any) => ({ ...d, timestamp: new Date(d.created_at).toLocaleDateString() })));
        generateSuggestion(updated[updated.length - 1]);
      }
    } else {
      console.error('Submit failed:', error.message);
    }
  };

  const generateSuggestion = async (entry: any) => {
    const housingPct = entry.mortgage && entry.income ? ((entry.mortgage / entry.income) * 100).toFixed(2) : null;
    if (housingPct && Number(housingPct) > 20) {
      setSuggestion(`You're spending ${housingPct}% on housing — aim for under 20%.`);
    } else {
      setSuggestion('Your housing costs look healthy.');
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px 24px', marginBottom: 24 }}>
          {['income', 'emergency', 'health', 'retirement', 'creditCards', 'mortgage', 'carPayments', 'utilities'].map((field) => (
            <React.Fragment key={field}>
              <label htmlFor={field} style={{ fontWeight: 'bold' }}>{field.charAt(0).toUpperCase() + field.slice(1)}:</label>
              <div>
                <input id={field} {...register(field as keyof FormData, { required: true })} />
                {errors[field as keyof FormData] && <span style={{ color: 'red', marginLeft: 8 }}>Required</span>}
              </div>
            </React.Fragment>
          ))}
        </div>
        <button type="submit">Submit</button>
      </form>

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
              {['income', 'emergency', 'health', 'retirement', 'creditCards', 'mortgage', 'carPayments', 'utilities'].map((key, idx) => (
                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[idx % COLORS.length]} />
              ))}
            </LineChart>
          </ResponsiveContainer>

          <h4 style={{ marginTop: 40 }}>Expense Breakdown</h4>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={expenseBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {expenseBreakdown.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ marginTop: 24, padding: 16, backgroundColor: '#f3f4f6', borderRadius: 8 }}>
        <h3 style={{ marginBottom: 16 }}>📊 Financial Summary</h3>
        <div style={{ display: 'flex', gap: 32 }}>
          <div style={{ flex: 1 }}>
            <h4>Lifetime Submission</h4>
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
        {suggestion && (
          <div style={{ marginTop: 16, fontStyle: 'italic' }}>💡 {suggestion}</div>
        )}
      </div>
    </div>
  );
};

export default FinanceForm;
