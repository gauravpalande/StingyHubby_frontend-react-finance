import React, { useEffect, useState, useRef } from 'react';
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
  const printRef = useRef<HTMLDivElement>(null);

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
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
    const { error } = await supabase.from('submissions').delete().eq('id', id);
    if (!error) fetchHistory();
    else console.error('Error deleting row:', error.message);
  };

  const exportToCSV = () => {
    if (!history.length) return;

    const headers = ['Date', 'Income', 'Checking', 'Emergency', 'Health', 'Retirement', 'Credit Cards', 'Mortgage', 'Car Payments', 'Utilities'];
    const rows = history.map(row =>
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
    if (!printRef.current) return;
    const originalContent = document.body.innerHTML;
    const printContent = printRef.current.innerHTML;

    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  return (
    <div style={{ marginTop: 40 }} ref={printRef}>
      <h3>Financial History</h3>

      <div style={{ marginBottom: 16 }}>
        <button onClick={exportToCSV}>📁 Export CSV</button>
        <button onClick={exportToPDF} style={{ marginLeft: 10 }}>🖨 Export PDF</button>
      </div>

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
            {['income', 'checking', 'emergency', 'health', 'retirement', 'creditCards', 'mortgage', 'carPayments', 'utilities'].map(
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
              <th>Checking</th>
              <th>Emergency</th>
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
                <td><input type="number" value={(editing[row.id]?.checking ?? row.checking) || 0} onChange={(e) => updateRow(row.id, 'checking', e.target.value)} /></td>
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
      )}
    </div>
  );
};

export default EditableFinancialHistory;
