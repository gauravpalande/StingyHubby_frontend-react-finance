// EditableFinancialHistory.tsx
import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28BD4', '#F29C1F', '#57D9A3', '#FF6B6B'];

const EditableFinancialHistory: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [history, setHistory] = useState<any[]>([]);
  const [editing, setEditing] = useState<{ [key: string]: any }>({});

  const fetchHistory = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching history:', error.message);
      return;
    }

    if (data) {
      setHistory(
        data.map((d: any) => ({
          ...d,
          timestamp: new Date(d.created_at).toLocaleDateString(),
        }))
      );
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const updateRow = (id: string, field: string, value: string) => {
    setEditing((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: parseFloat(value) },
    }));
  };

  const saveRow = async (id: string) => {
  const changes = editing[id];
  if (!changes) return;

  const original = history.find((row) => row.id === id);
  if (!original) return;

  // Merge and remove 'timestamp'
  const { timestamp, ...updatedRow } = { ...original, ...changes };

  const { error } = await supabase
    .from('submissions')
    .update(updatedRow)
    .eq('id', id);

  if (error) {
    console.error('Error saving row:', error.message);
  } else {
    const newEditing = { ...editing };
    delete newEditing[id];
    setEditing(newEditing);
    fetchHistory();
  }
};

  const deleteRow = async (id: string) => {
    const { error } = await supabase.from('submissions').delete().eq('id', id);
    if (error) {
      console.error('Error deleting row:', error.message);
    } else {
      fetchHistory();
    }
  };

  return (
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

      <table style={{ width: '100%', marginTop: 24, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Income</th>
            <th>Emergency Fund</th>
            <th>Health</th>
            <th>Retirement</th>
            <th>Credit Cards</th>
            <th>Mortgage</th>
            <th>Car Payments</th>
            <th>Utilities</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {history.map((row) => (
            <tr key={row.id}>
              <td>{row.timestamp}</td>
              <td><input type="number" value={(editing[row.id]?.income ?? row.income) || 0} onChange={(e) => updateRow(row.id, 'income', e.target.value)} /></td>
              <td><input type="number" value={(editing[row.id]?.emergency ?? row.emergency) || 0} onChange={(e) => updateRow(row.id, 'emergency', e.target.value)} /></td>
              <td><input type="number" value={(editing[row.id]?.health ?? row.health) || 0} onChange={(e) => updateRow(row.id, 'health', e.target.value)} /></td>
              <td><input type="number" value={(editing[row.id]?.retirement ?? row.retirement) || 0} onChange={(e) => updateRow(row.id, 'retirement', e.target.value)} /></td>
              <td><input type="number" value={(editing[row.id]?.creditCards ?? row.creditCards) || 0} onChange={(e) => updateRow(row.id, 'creditCards', e.target.value)} /></td>
              <td><input type="number" value={(editing[row.id]?.mortgage ?? row.mortgage) || 0} onChange={(e) => updateRow(row.id, 'mortgage', e.target.value)} /></td>
              <td><input type="number" value={(editing[row.id]?.carPayments ?? row.carPayments) || 0} onChange={(e) => updateRow(row.id, 'carPayments', e.target.value)} /></td>
              <td><input type="number" value={(editing[row.id]?.utilities ?? row.utilities) || 0} onChange={(e) => updateRow(row.id, 'utilities', e.target.value)} /></td>
              <td>
                <button onClick={() => saveRow(row.id)}>💾</button>
                <button onClick={() => deleteRow(row.id)}>🗑️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default EditableFinancialHistory;
