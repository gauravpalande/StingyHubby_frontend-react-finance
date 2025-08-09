import React, { useEffect, useState, useRef } from 'react';
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
  Legend,
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28BD4', '#F29C1F', '#57D9A3', '#FF6B6B'];

const EditableFinancialHistory: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [history, setHistory] = useState<any[]>([]);
  const [editing, setEditing] = useState<{ [key: string]: any }>({});
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const printRef = useRef<HTMLDivElement>(null);

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);

    const [historyRes, prefsRes, paidRes] = await Promise.all([
      supabase
        .from('submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('preferences')
        .select('graph_type')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('users')
        .select('paid_user')
        .eq('id', user.id)
        .single(),
    ]);

    if (historyRes.data) {
      setHistory(
        historyRes.data.map((d: any) => ({
          ...d,
          timestamp: new Date(d.created_at).toLocaleDateString(),
        }))
      );
    }

    if (prefsRes.data?.graph_type === 'bar') setChartType('bar');
    else setChartType('line');

    setIsPaid(!!paidRes.data?.paid_user);
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const updateRow = (id: string, field: string, value: string) => {
    // Even if free users change inputs (should be disabled), guard anyway
    if (!isPaid) return;
    setEditing((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: parseFloat(value) },
    }));
  };

  const saveRow = async (id: string) => {
    if (!isPaid) return;
    const changes = editing[id];
    if (!changes) return;

    const { error } = await supabase.from('submissions').update(changes).eq('id', id);

    if (!error) {
      const newEditing = { ...editing };
      delete newEditing[id];
      setEditing(newEditing);
      fetchHistory();
    } else {
      console.error('Error saving row:', error.message);
    }
  };

  const deleteRow = async (id: string) => {
    if (!isPaid) return;
    const { error } = await supabase.from('submissions').delete().eq('id', id);
    if (!error) fetchHistory();
    else console.error('Error deleting row:', error.message);
  };

  const exportToCSV = () => {
    if (!isPaid || !history.length) return;

    const headers = ['Date', 'Income', 'Checking', 'Emergency', 'Health', 'Retirement', 'Credit Cards', 'Mortgage', 'Car Payments', 'Utilities'];
    const rows = history.map((row) =>
      [
        row.timestamp,
        row.income,
        row.checking,
        row.emergency,
        row.health,
        row.retirement,
        row.creditCards,
        row.mortgage,
        row.carPayments,
        row.utilities,
      ].join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'financial_history.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    if (!isPaid || !printRef.current) return;
    const originalContent = document.body.innerHTML;
    const printContent = printRef.current.innerHTML;

    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  const chartKeys = ['income', 'checking', 'emergency', 'health', 'retirement', 'creditCards', 'mortgage', 'carPayments', 'utilities'];

  return (
    <div style={{ marginTop: 40 }} ref={printRef}>
      <h3>Financial History</h3>

      {/* Premium Export Buttons */}
      {isPaid ? (
        <div style={{ marginBottom: 16 }}>
          <button onClick={exportToCSV}>📁 Export CSV</button>
          <button onClick={exportToPDF} style={{ marginLeft: 10 }}>🖨 Export PDF</button>
        </div>
      ) : (
        <div style={{ marginBottom: 16, fontSize: 14, color: '#6c757d' }}>
          🔒 <strong>Premium:</strong> Export CSV/PDF is available for paid users.
        </div>
      )}

      {loading ? (
        <p>📊 Loading chart data...</p>
      ) : history.length === 0 ? (
        <p>No data to display.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          {chartType === 'bar' ? (
            <BarChart data={history}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              <Legend />
              {chartKeys.map((key, index) => (
                <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} />
              ))}
            </BarChart>
          ) : (
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              <Legend />
              {chartKeys.map((key, index) => (
                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[index % COLORS.length]} />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      )}

      {!loading && history.length > 0 && (
        <table style={{ width: '100%', marginTop: 24, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Date</th>
              {chartKeys.map((key) => (
                <th key={key}>{key.charAt(0).toUpperCase() + key.slice(1)}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id}>
                <td>{row.timestamp}</td>
                {chartKeys.map((key) => (
                  <td key={key}>
                    <input
                      type="number"
                      value={(editing[row.id]?.[key] ?? row[key]) || 0}
                      onChange={(e) => updateRow(row.id, key, e.target.value)}
                      disabled={!isPaid}
                      style={!isPaid ? { backgroundColor: '#f1f3f5', cursor: 'not-allowed' } : undefined}
                    />
                  </td>
                ))}
                <td>
                  {isPaid ? (
                    <>
                      <button onClick={() => saveRow(row.id)} title="Save changes">💾</button>
                      <button onClick={() => deleteRow(row.id)} title="Delete entry" style={{ marginLeft: 8 }}>🗑️</button>
                    </>
                  ) : (
                    <span style={{ color: '#6c757d' }}>🔒 Premium</span>
                  )}
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
