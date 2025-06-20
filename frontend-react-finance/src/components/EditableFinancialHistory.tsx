import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';
import { usePreferences } from '../hooks/usePreferences';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28BD4', '#F29C1F', '#57D9A3', '#FF6B6B'];

const EditableFinancialHistory: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [history, setHistory] = useState<any[]>([]);
  const [editing, setEditing] = useState<{ [key: string]: any }>({});
  const { prefs } = usePreferences();

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

    const { error } = await supabase
      .from('submissions')
      .update(changes)
      .eq('id', id)
      .eq('user_id', user?.id);

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
    const { error } = await supabase
      .from('submissions')
      .delete()
      .eq('id', id)
      .eq('user_id', user?.id);

    if (error) {
      console.error('Error deleting row:', error.message);
    } else {
      fetchHistory();
    }
  };

  const keys = [
    'income',
    'emergency',
    'health',
    'retirement',
    'creditCards',
    'mortgage',
    'carPayments',
    'utilities'
  ];

  const chartType = prefs?.graph_type === 'bar' ? (
    <BarChart data={history}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="timestamp" />
      <YAxis />
      <Tooltip />
      <Legend />
      {keys.map((key, i) => (
        <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} />
      ))}
    </BarChart>
  ) : (
    <LineChart data={history}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="timestamp" />
      <YAxis />
      <Tooltip />
      <Legend />
      {keys.map((key, i) => (
        <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} />
      ))}
    </LineChart>
  );

  return (
    <div style={{ marginTop: 40 }}>
      <h3>Financial History</h3>

      <ResponsiveContainer width="100%" height={300}>
        {chartType}
      </ResponsiveContainer>

      <table style={{ width: '100%', marginTop: 24, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Date</th>
            {keys.map((key) => (
              <th key={key}>{key}</th>
            ))}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {history.map((row) => (
            <tr key={row.id}>
              <td>{row.timestamp}</td>
              {keys.map((key) => (
                <td key={key}>
                  <input
                    type="number"
                    value={(editing[row.id]?.[key] ?? row[key]) || 0}
                    onChange={(e) => updateRow(row.id, key, e.target.value)}
                    style={{ width: '80px' }}
                  />
                </td>
              ))}
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
