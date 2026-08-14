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

type ImportedSubmission = Record<ImportNumericField, number> & {
  user_id: string;
  created_at: string;
};

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

const IMPORT_HEADER_TO_FIELD: Record<string, ImportNumericField | 'created_at'> = {
  date: 'created_at',
  income: 'income',
  checking: 'checking',
  emergency: 'emergency',
  health: 'health',
  retirement: 'retirement',
  'credit cards': 'creditCards',
  mortgage: 'mortgage',
  'car payments': 'carPayments',
  utilities: 'utilities',
};

const REQUIRED_IMPORT_HEADERS = Object.keys(IMPORT_HEADER_TO_FIELD);

function normalizeCsvHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseImportAmount(value: string, rowNumber: number, field: string) {
  const normalized = value.replace(/[$,]/g, '').trim();
  const amount = Number(normalized || 0);

  if (!Number.isFinite(amount)) {
    throw new Error(`Row ${rowNumber}: ${field} must be a valid number.`);
  }

  return amount;
}

function parseImportDate(value: string, rowNumber: number) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Row ${rowNumber}: Date must be a valid date.`);
  }

  return date.toISOString();
}

function buildImportedSubmissions(csv: string, userId: string) {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  const headerLine = lines[0];

  if (!headerLine) {
    throw new Error('CSV file is empty.');
  }

  const fieldsByIndex = parseCsvLine(headerLine).map(
    (header) => IMPORT_HEADER_TO_FIELD[normalizeCsvHeader(header)]
  );

  const missingHeaders = REQUIRED_IMPORT_HEADERS.filter(
    (header) => !fieldsByIndex.includes(IMPORT_HEADER_TO_FIELD[header])
  );

  if (missingHeaders.length) {
    throw new Error(`CSV is missing required headers: ${missingHeaders.join(', ')}.`);
  }

  return lines.slice(1).map((line, index) => {
    const rowNumber = index + 2;
    const values = parseCsvLine(line);
    const submission: ImportedSubmission = {
      user_id: userId,
      created_at: '',
      income: 0,
      checking: 0,
      emergency: 0,
      health: 0,
      retirement: 0,
      creditCards: 0,
      mortgage: 0,
      carPayments: 0,
      utilities: 0,
    };

    fieldsByIndex.forEach((field, columnIndex) => {
      if (!field) return;

      const rawValue = values[columnIndex] ?? '';
      if (field === 'created_at') {
        submission.created_at = parseImportDate(rawValue, rowNumber);
      } else {
        submission[field] = parseImportAmount(rawValue, rowNumber, field);
      }
    });

    if (!submission.created_at) {
      throw new Error(`Row ${rowNumber}: Date is required.`);
    }

    return submission;
  });
}

const EditableFinancialHistory: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [history, setHistory] = useState<FinancialHistoryRow[]>([]);
  const [editing, setEditing] = useState<EditingState>({});
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState('');
  const printRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);

    const [historyRes, prefsRes, paidRes] = await Promise.all([
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
      supabase
        .from('users')
        .select('paid_user')
        .eq('id', user.id)
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

    setIsPaid(!!paidRes.data?.paid_user);
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const updateRow = (id: string, field: ImportNumericField, value: string) => {
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

  const importFromCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !user || !isPaid) return;

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
    if (!isPaid || !printRef.current) return;
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

      {/* Premium Export Buttons */}
      {isPaid ? (
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
      ) : (
        <div style={{ marginBottom: 16, fontSize: 14, color: '#6c757d' }}>
          🔒 <strong>Premium:</strong> Import CSV and export CSV/PDF are available for paid users.
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
