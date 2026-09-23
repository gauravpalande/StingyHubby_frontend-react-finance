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

type ImportNumericField =
  | 'income'
  | 'checking'
  | 'emergency'
  | 'health'
  | 'retirement'
  | 'creditCards'
  | 'mortgage'
  | 'carPayments'
  | 'utilities';

type FinancialHistoryRecord = Record<ImportNumericField, number | null> & {
  id: string;
  created_at: string;
};

type FinancialHistoryRow = FinancialHistoryRecord & {
  timestamp: string;
};

type EditingState = Record<string, Partial<Record<ImportNumericField, number>>>;

const CHART_KEYS: ImportNumericField[] = [
  'income',
  'checking',
  'emergency',
  'health',
  'retirement',
  'creditCards',
  'mortgage',
  'carPayments',
  'utilities',
];

const EditableFinancialHistory: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [history, setHistory] = useState<FinancialHistoryRow[]>([]);
  const [editing, setEditing] = useState<EditingState>({});
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [importStatus, setImportStatus] = useState('');
  const printRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);

    const [historyRes, prefsRes] = await Promise.all([
      supabase
        .from('submissions')
        .select(
          'id, created_at, income, checking, emergency, health, retirement, creditCards, mortgage, carPayments, utilities'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('preferences')
        .select('graph_type')
        .eq('user_id', user.id)
        .single(),
    ]);

    if (historyRes.data) {
      setHistory(
        (historyRes.data as FinancialHistoryRecord[]).map((row) => ({
          ...row,
          timestamp: new Date(row.created_at).toLocaleDateString(),
        }))
      );
    }

    if (prefsRes.data?.graph_type === 'bar') setChartType('bar');
    else setChartType('line');

    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const updateRow = (id: string, field: ImportNumericField, value: string) => {
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

  const importFromCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !user) return;

    try {
      setImportStatus('Importing CSV...');
      const csv = await file.text();
      const rows = buildImportedSubmissions(csv, user.id);

      if (!rows.length) {
        throw new Error('CSV file does not contain any data rows.');
      }

      const { error } = await supabase.from('submissions').insert(rows);

      if (error) {
        throw new Error(error.message);
      }

      setImportStatus(`Imported ${rows.length} financial history row${rows.length === 1 ? '' : 's'}.`);
      fetchHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSV import failed.';
      setImportStatus(message);
    }
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
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={importFromCSV}
          style={{ display: 'none' }}
        />
        <button onClick={exportToCSV}>📁 Export CSV</button>
        <button onClick={exportToPDF} style={{ marginLeft: 10 }}>🖨 Export PDF</button>
        <button onClick={() => fileInputRef.current?.click()} style={{ marginLeft: 10 }}>Import CSV</button>
        {importStatus && <div style={{ marginTop: 8, color: '#4a5568' }}>{importStatus}</div>}
      </div>

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
              {CHART_KEYS.map((key, index) => (
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
              {CHART_KEYS.map((key, index) => (
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
              {CHART_KEYS.map((key) => (
                <th key={key}>{key.charAt(0).toUpperCase() + key.slice(1)}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id}>
                <td>{row.timestamp}</td>
                {CHART_KEYS.map((key) => (
                  <td key={key}>
                    <input
                      type="number"
                      value={(editing[row.id]?.[key] ?? row[key]) || 0}
                      onChange={(e) => updateRow(row.id, key, e.target.value)}
                    />
                  </td>
                ))}
                <td>
                  <button onClick={() => saveRow(row.id)} title="Save changes">💾</button>
                  <button onClick={() => deleteRow(row.id)} title="Delete entry" style={{ marginLeft: 8 }}>🗑️</button>
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
