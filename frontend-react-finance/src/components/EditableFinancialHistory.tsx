// EditableFinancialHistory.tsx
import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28BD4', '#F29C1F', '#57D9A3', '#FF6B6B'];

const EditableFinancialHistory: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [history, setHistory] = useState<any[]>([]);
  const [editing, setEditing] = useState<{ [key: string]: any }>({});
  const [loading, setLoading] = useState(true);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching history:', error.message);
      setLoading(false);
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
    setLoading(false);
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
    setSavingRowId(id);

    const cleaned = { ...changes };
    delete cleaned.timestamp;
    delete cleaned.created_at;

    const { error } = await supabase.from('submissions').update(cleaned).eq('id', id);

    setSavingRowId(null);
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
    setDeletingRowId(id);
    const { error } = await supabase.from('submissions').delete().eq('id', id);
    setDeletingRowId(null);
    if (error) {
      console.error('Error deleting row:', error.message);
    } else {
      fetchHistory();
    }
  };

  return (
    <div style={{ marginTop: 40 }}>
      <h3>Financial History</h3>

      {loading ? (
        <p>📊 Loading chart data...</p>
      ) : history.length === 0 ? (
        <p>No data to display.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            {['income', 'emergency', 'health', 'retirement', 'creditCards', 'mortgage', 'carPayments', 'utilities'].map(
              (key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={COLORS[index % COLORS.length]}
                />
              )
            )}
          </LineChart>
        </ResponsiveContainer>
      )}

      {!loading && history.length > 0 && (
        <table style={{ width: '100%', marginTop: 24, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Income</th>
              <th>Emergency</th>
              <th>Health</th>
              <th>Retirement</th>
              <th>Credit Cards</th>
              <th>Mortgage</th>
              <th>Car</th>
              <th>Utilities</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id}>
                <td>{row.timestamp}</td>
                {[
                  'income',
                  'emergency',
                  'health',
                  'retirement',
                  'creditCards',
                  'mortgage',
                  'carPayments',
                  'utilities',
                ].map((field) => (
                  <td key={field}>
                    <input
                      type="number"
                      value={(editing[row.id]?.[field] ?? row[field]) || 0}
                      onChange={(e) => updateRow(row.id, field, e.target.value)}
                      style={{ width: 80 }}
                    />
                  </td>
                ))}
                <td>
                  <button onClick={() => saveRow(row.id)} disabled={savingRowId === row.id}>
                    {savingRowId === row.id ? 'Saving...' : '💾'}
                  </button>
                  <button onClick={() => deleteRow(row.id)} disabled={deletingRowId === row.id}>
                    {deletingRowId === row.id ? 'Deleting...' : '🗑️'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default EditableFinancialHistory;
