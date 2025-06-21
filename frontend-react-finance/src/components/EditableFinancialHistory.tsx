import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28BD4', '#F29C1F', '#57D9A3', '#FF6B6B'];

const EditableFinancialHistory: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();

  const [history, setHistory] = useState<any[]>([]);
  const [editing, setEditing] = useState<{ [key: string]: any }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (data) {
      setHistory(
        data.map((d: any) => ({
          ...d,
          timestamp: new Date(d.created_at).toLocaleDateString(),
        }))
      );
    } else {
      console.error('Error fetching history:', error?.message);
    }

    setIsLoading(false);
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
    const { error } = await supabase.from('submissions').update(changes).eq('id', id);
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
    <div className="mt-10">
      <h3 className="text-xl font-semibold mb-4">Financial History</h3>

      {isLoading ? (
        <p className="text-gray-600">Loading chart...</p>
      ) : (
        <div className="w-full h-72">
          <ResponsiveContainer width="100%" height="100%">
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
      )}

      <div className="overflow-x-auto mt-6">
        <table className="min-w-full table-auto border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">Date</th>
              {['income', 'emergency', 'health', 'retirement', 'creditCards', 'mortgage', 'carPayments', 'utilities'].map((field) => (
                <th key={field} className="border p-2 capitalize">{field}</th>
              ))}
              <th className="border p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id} className="text-center">
                <td className="border p-2">{row.timestamp}</td>
                {['income', 'emergency', 'health', 'retirement', 'creditCards', 'mortgage', 'carPayments', 'utilities'].map((field) => (
                  <td key={field} className="border p-2">
                    <input
                      type="number"
                      className="w-full px-2 py-1 border rounded"
                      value={(editing[row.id]?.[field] ?? row[field]) || 0}
                      onChange={(e) => updateRow(row.id, field, e.target.value)}
                      disabled={savingRowId === row.id || deletingRowId === row.id}
                    />
                  </td>
                ))}
                <td className="border p-2">
                  <button
                    onClick={() => saveRow(row.id)}
                    disabled={savingRowId === row.id}
                    className="px-3 py-1 mr-1 bg-blue-500 text-white rounded disabled:opacity-50"
                  >
                    {savingRowId === row.id ? 'Saving...' : '💾'}
                  </button>
                  <button
                    onClick={() => deleteRow(row.id)}
                    disabled={deletingRowId === row.id}
                    className="px-3 py-1 bg-red-500 text-white rounded disabled:opacity-50"
                  >
                    {deletingRowId === row.id ? 'Deleting...' : '🗑️'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EditableFinancialHistory;
