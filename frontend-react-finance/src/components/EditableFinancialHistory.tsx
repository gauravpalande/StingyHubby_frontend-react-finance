import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { buildImportedSubmissions, MAX_IMPORT_FILE_BYTES } from '../utils/csvImport';
import './EditableFinancialHistory.css';

type FinanceField =
  | 'income'
  | 'checking'
  | 'emergency'
  | 'health'
  | 'retirement'
  | 'creditCards'
  | 'mortgage'
  | 'carPayments'
  | 'utilities';

type HistoryRecord = Record<FinanceField, number | null> & {
  id: string;
  created_at: string;
};

type HistoryRow = HistoryRecord & { timestamp: string };
type EditingState = Record<string, Partial<Record<FinanceField, number | ''>>>;
type ChartMode = 'cashFlow' | 'balances';

const FINANCE_FIELDS: readonly { key: FinanceField; label: string }[] = [
  { key: 'income', label: 'Income' },
  { key: 'checking', label: 'Checking' },
  { key: 'emergency', label: 'Emergency' },
  { key: 'health', label: 'Health' },
  { key: 'retirement', label: 'Retirement' },
  { key: 'creditCards', label: 'Credit cards' },
  { key: 'mortgage', label: 'Mortgage' },
  { key: 'carPayments', label: 'Car payments' },
  { key: 'utilities', label: 'Utilities' },
];

const CASH_FLOW_COLORS = { income: '#2563eb', expenses: '#dc2626', netCashFlow: '#059669' };
const BALANCE_COLORS = {
  checking: '#0f766e',
  emergency: '#2563eb',
  retirement: '#7c3aed',
  health: '#ea580c',
};

type ChartDatum = {
  date: string;
  income: number;
  expenses: number;
  netCashFlow: number;
  checking: number;
  emergency: number;
  retirement: number;
  health: number;
};

function FinancialTrendPlot({ data, mode, type }: { data: ChartDatum[]; mode: ChartMode; type: 'line' | 'bar' }) {
  const plotId = React.useId().replace(/:/g, '');
  const series = mode === 'cashFlow'
    ? [
        { key: 'income' as const, label: 'Income', color: CASH_FLOW_COLORS.income },
        { key: 'expenses' as const, label: 'Expenses', color: CASH_FLOW_COLORS.expenses },
        { key: 'netCashFlow' as const, label: 'Net cash flow', color: CASH_FLOW_COLORS.netCashFlow },
      ]
    : [
        { key: 'checking' as const, label: 'Checking', color: BALANCE_COLORS.checking },
        { key: 'emergency' as const, label: 'Emergency', color: BALANCE_COLORS.emergency },
        { key: 'retirement' as const, label: 'Retirement', color: BALANCE_COLORS.retirement },
        { key: 'health' as const, label: 'Health', color: BALANCE_COLORS.health },
      ];

  const width = 1000;
  const height = 292;
  const plot = { left: 72, right: 988, top: 16, bottom: 238 };
  const values = data.flatMap((point) => series.map(({ key }) => point[key])).filter(Number.isFinite);
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  const range = rawMax - rawMin || 1;
  const min = rawMin - range * 0.06;
  const max = rawMax + range * 0.06;
  const x = (index: number) => plot.left + (data.length < 2 ? 0 : (index / (data.length - 1)) * (plot.right - plot.left));
  const y = (value: number) => plot.bottom - ((value - min) / (max - min)) * (plot.bottom - plot.top);
  const ticks = Array.from({ length: 5 }, (_, index) => min + ((max - min) * index) / 4);
  const dateIndexes = Array.from(new Set(Array.from({ length: Math.min(6, data.length) }, (_, index) =>
    data.length < 2 ? 0 : Math.round((index * (data.length - 1)) / (Math.min(6, data.length) - 1)),
  )));

  return (
    <div className="history-trend-plot">
      <div className="history-line-legend" aria-hidden="true">
        {series.map(({ key, label, color }) => (
          <span key={key}><i style={{ backgroundColor: color }} />{label}</span>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${mode === 'cashFlow' ? 'Cash flow' : 'Account balances'} ${type === 'line' ? 'trends' : 'bars'} over time`} preserveAspectRatio="none">
        {type === 'line' && (
          <defs>
            <clipPath id={`${plotId}-reveal`}>
              <rect className="history-line-reveal" x={plot.left} y={plot.top} width={plot.right - plot.left} height={plot.bottom - plot.top} />
            </clipPath>
          </defs>
        )}
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={plot.left} x2={plot.right} y1={y(tick)} y2={y(tick)} stroke="#e8edf1" strokeDasharray="4 4" />
            <text x={plot.left - 10} y={y(tick) + 4} textAnchor="end" fill="#687583" fontSize="12">${compactCurrencyFormatter.format(tick)}</text>
          </g>
        ))}
        <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} stroke="#dce3e8" />
        {dateIndexes.map((index) => (
          <text key={`${data[index]?.date}-${index}`} x={x(index)} y={height - 8} textAnchor="middle" fill="#687583" fontSize="11">
            {data[index]?.date}
          </text>
        ))}
        {type === 'line' ? series.map(({ key, label, color }) => {
          const points = data.map((point, index) => `${x(index)},${y(point[key])}`).join(' ');
          return (
            <g key={key}>
              <g clipPath={`url(#${plotId}-reveal)`}>
                <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              {data.map((point, index) => (
                <circle key={`${key}-${index}`} cx={x(index)} cy={y(point[key])} r="3" fill="#fff" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke">
                  <title>{`${label} · ${point.date}: ${currencyFormatter.format(point[key])}`}</title>
                </circle>
              ))}
              </g>
            </g>
          );
        }) : (() => {
          const zeroY = y(0);
          const slot = data.length > 1 ? (plot.right - plot.left) / (data.length - 1) : 44;
          const groupWidth = Math.min(34, slot * 0.76);
          const barWidth = groupWidth / series.length;
          return series.flatMap(({ key, label, color }, seriesIndex) => data.map((point, index) => {
            const valueY = y(point[key]);
            const barHeight = Math.max(1, Math.abs(zeroY - valueY));
            return (
              <rect
                key={`${key}-${index}`}
                x={x(index) - groupWidth / 2 + seriesIndex * barWidth}
                y={Math.min(zeroY, valueY)}
                width={Math.max(2, barWidth - 2)}
                height={barHeight}
                rx="2"
                fill={color}
                className="history-bar-rise"
                style={{
                  animationDelay: `${Math.min(index * 24, 720)}ms`,
                  transformOrigin: `center ${point[key] >= 0 ? '100%' : '0%'}`,
                }}
              >
                <title>{`${label} · ${point.date}: ${currencyFormatter.format(point[key])}`}</title>
              </rect>
            );
          }));
        })()}
      </svg>
    </div>
  );
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 0,
});

function amount(value: number | null | undefined) {
  return Number(value) || 0;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const EditableFinancialHistory: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [editing, setEditing] = useState<EditingState>({});
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [chartMode, setChartMode] = useState<ChartMode>('cashFlow');
  const [status, setStatus] = useState('');
  const [statusIsError, setStatusIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = useCallback(async (showLoading = true) => {
    if (!user) {
      setHistory([]);
      setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);
    setLoadError('');

    try {
      const [historyResult, preferencesResult] = await Promise.all([
        supabase
          .from('submissions')
          .select('id, created_at, income, checking, emergency, health, retirement, creditCards, mortgage, carPayments, utilities')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase
          .from('preferences')
          .select('graph_type')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (historyResult.error) throw historyResult.error;

      setHistory(((historyResult.data ?? []) as HistoryRecord[]).map((row) => ({
        ...row,
        timestamp: formatDate(row.created_at),
      })));

      if (preferencesResult.data?.graph_type === 'bar') setChartType('bar');
      else setChartType('line');
    } catch (error) {
      console.error('Error loading financial history:', error);
      setLoadError('Your financial history could not be loaded. Please try again.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const chartData = useMemo(() => history.slice().reverse().map((row) => {
    const expenses = amount(row.creditCards) + amount(row.mortgage) + amount(row.carPayments) + amount(row.utilities);
    return {
      date: row.timestamp,
      income: amount(row.income),
      expenses,
      netCashFlow: amount(row.income) - expenses,
      checking: amount(row.checking),
      emergency: amount(row.emergency),
      health: amount(row.health),
      retirement: amount(row.retirement),
    };
  }), [history]);

  const latest = history[0];
  const latestExpenses = latest
    ? amount(latest.creditCards) + amount(latest.mortgage) + amount(latest.carPayments) + amount(latest.utilities)
    : 0;
  const latestSavings = latest
    ? amount(latest.emergency) + amount(latest.health) + amount(latest.retirement)
    : 0;

  const summaryCards = [
    { label: 'Snapshots shown', value: history.length.toLocaleString(), note: 'Most recent records' },
    { label: 'Monthly income', value: latest ? currencyFormatter.format(amount(latest.income)) : '—', note: latest ? `Latest · ${latest.timestamp}` : 'No saved updates' },
    { label: 'Monthly expenses', value: latest ? currencyFormatter.format(latestExpenses) : '—', note: 'From your latest snapshot' },
    { label: 'Savings balances', value: latest ? currencyFormatter.format(latestSavings) : '—', note: 'Emergency, health & retirement' },
  ];

  const updateRow = (id: string, field: FinanceField, value: string) => {
    setEditing((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value === '' ? undefined : Number(value) },
    }));
  };

  const cancelEdit = (id: string) => {
    setEditing((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setEditingRowId(null);
    setStatus('');
  };

  const saveRow = async (id: string) => {
    const changes = editing[id];
    if (!changes || !Object.keys(changes).length) {
      setEditingRowId(null);
      return;
    }
    if (Object.values(changes).some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
      setStatus('Enter a valid number in each edited field.');
      setStatusIsError(true);
      return;
    }

    setBusyRowId(id);
    setStatus('');
    try {
      const { error } = await supabase.from('submissions').update(changes).eq('id', id);
      if (error) throw error;

      cancelEdit(id);
      setStatus('History row updated.');
      setStatusIsError(false);
      await fetchHistory(false);
    } catch (error) {
      console.error('Error saving history row:', error);
      setStatus('Could not save this row. Please try again.');
      setStatusIsError(true);
    } finally {
      setBusyRowId(null);
    }
  };

  const deleteRow = async (row: HistoryRow) => {
    if (!window.confirm(`Delete the financial snapshot from ${row.timestamp}? This cannot be undone.`)) return;

    setBusyRowId(row.id);
    setStatus('');
    try {
      const { error } = await supabase.from('submissions').delete().eq('id', row.id);
      if (error) throw error;

      if (editingRowId === row.id) cancelEdit(row.id);
      await fetchHistory(false);
      setStatus('History row deleted.');
      setStatusIsError(false);
    } catch (error) {
      console.error('Error deleting history row:', error);
      setStatus('Could not delete this row. Please try again.');
      setStatusIsError(true);
    } finally {
      setBusyRowId(null);
    }
  };

  const exportToCSV = () => {
    if (!history.length) return;

    const headers = ['Date', ...FINANCE_FIELDS.map(({ label }) => label)];
    const rows = history.map((row) => [
      new Date(row.created_at).toISOString().slice(0, 10),
      ...FINANCE_FIELDS.map(({ key }) => amount(row[key])),
    ].join(','));

    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'financial_history.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importFromCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user) return;

    try {
      if (file.size > MAX_IMPORT_FILE_BYTES) throw new Error('CSV files must be 1 MB or smaller.');

      setStatus('Importing financial history…');
      setStatusIsError(false);
      const rows = buildImportedSubmissions(await file.text(), user.id);
      if (!rows.length) throw new Error('CSV file does not contain any data rows.');

      const { error } = await supabase.from('submissions').insert(rows);
      if (error) throw new Error(error.message);

      await fetchHistory(false);
      setStatus(`Imported ${rows.length} financial history ${rows.length === 1 ? 'row' : 'rows'}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSV import failed.';
      setStatus(message);
      setStatusIsError(true);
    }
  };

  if (loading) {
    return (
      <div className="financial-history-page" style={{ maxWidth: 1600, margin: '0 auto' }}>
        <p className="history-loading" role="status">Loading your financial history…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="financial-history-page history-error-card" style={{ maxWidth: 1600, margin: '0 auto' }} role="alert">
        <h1>Financial history</h1>
        <p>{loadError}</p>
        <button className="history-button history-button-primary" type="button" onClick={() => void fetchHistory()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="financial-history-page">
      <header className="history-page-header">
        <div>
          <span className="history-eyebrow">YOUR FINANCES OVER TIME</span>
          <h1>Financial history</h1>
          <p>Review trends, edit a snapshot, or import and export your records.</p>
        </div>
        <div className="history-header-meta">
          <span className="history-record-count">{history.length.toLocaleString()} {history.length === 1 ? 'record' : 'records'}</span>
          {latest && <span>Latest update · {latest.timestamp}</span>}
        </div>
      </header>

      <section className="history-summary-grid" aria-label="Latest financial summary">
        {summaryCards.map((card) => (
          <article className="history-summary-card" key={card.label}>
            <span className="history-summary-label">{card.label}</span>
            <strong className="history-summary-value">{card.value}</strong>
            <span className="history-summary-note">{card.note}</span>
          </article>
        ))}
      </section>

      <section className="history-card history-tools-card" aria-label="History file tools">
        <div>
          <h2>Manage your records</h2>
          <p>Move your snapshots in or out of PennyWize.</p>
        </div>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={importFromCSV} hidden />
        <div className="history-file-actions">
          <button className="history-button history-button-primary" type="button" onClick={() => fileInputRef.current?.click()}>
            Import CSV
          </button>
          <button className="history-button" type="button" onClick={exportToCSV} disabled={!history.length}>
            Export CSV
          </button>
          <button className="history-button" type="button" onClick={() => window.print()}>
            Export PDF
          </button>
        </div>
        {status && (
          <p className={`history-status ${statusIsError ? 'history-status-error' : ''}`} role={statusIsError ? 'alert' : 'status'}>
            {status}
          </p>
        )}
      </section>

      <section className="history-card history-chart-card" aria-labelledby="history-trend-title">
        <div className="history-card-header history-chart-header">
          <div>
            <h2 id="history-trend-title">Trends over time</h2>
            <p>{chartMode === 'cashFlow' ? 'Compare income, expenses, and net cash flow.' : 'Track changes in your account and savings balances.'}</p>
          </div>
          {history.length > 0 && (
            <div className="history-chart-controls" aria-label="Chart controls">
              <div className="history-segmented-control" role="group" aria-label="Choose metrics">
                <button type="button" aria-pressed={chartMode === 'cashFlow'} onClick={() => setChartMode('cashFlow')}>Cash flow</button>
                <button type="button" aria-pressed={chartMode === 'balances'} onClick={() => setChartMode('balances')}>Balances</button>
              </div>
              <div className="history-segmented-control" role="group" aria-label="Choose chart style">
                <button type="button" aria-pressed={chartType === 'line'} onClick={() => setChartType('line')}>Line</button>
                <button type="button" aria-pressed={chartType === 'bar'} onClick={() => setChartType('bar')}>Bar</button>
              </div>
            </div>
          )}
        </div>

        {history.length ? (
          <div className="history-chart-wrap">
            <FinancialTrendPlot key={`${chartType}-${chartMode}`} data={chartData} mode={chartMode} type={chartType} />
          </div>
        ) : (
          <div className="history-empty-state">
            <span className="history-empty-icon" aria-hidden="true">↗</span>
            <h3>Your history will appear here</h3>
            <p>Save a financial update or import a CSV to start tracking your trends.</p>
            <button className="history-button history-button-primary" type="button" onClick={() => fileInputRef.current?.click()}>
              Import a CSV
            </button>
          </div>
        )}
      </section>

      <section className="history-card history-table-card" aria-labelledby="history-records-title">
        <div className="history-card-header">
          <div>
            <h2 id="history-records-title">All snapshots</h2>
            <p>Edit a row to update its values. Your latest snapshot appears first.</p>
          </div>
          <span className="history-table-count">{history.length.toLocaleString()} shown</span>
        </div>

        {history.length ? (
          <div className="history-table-scroll" role="region" aria-label="Financial snapshots table" tabIndex={0}>
            <table className="history-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  {FINANCE_FIELDS.map(({ key, label }) => <th scope="col" key={key}>{label}</th>)}
                  <th className="history-actions-heading" scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => {
                  const isEditing = editingRowId === row.id;
                  const isBusy = busyRowId === row.id;

                  return (
                    <tr key={row.id} className={isEditing ? 'history-row-editing' : undefined}>
                      <th className="history-date-cell" scope="row">{row.timestamp}</th>
                      {FINANCE_FIELDS.map(({ key, label }) => (
                        <td key={key}>
                          {isEditing ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              step="any"
                              aria-label={`${label} on ${row.timestamp}`}
                              value={editing[row.id]?.[key] ?? amount(row[key])}
                              onChange={(event) => updateRow(row.id, key, event.target.value)}
                              disabled={isBusy}
                            />
                          ) : (
                            <span className="history-amount">{currencyFormatter.format(amount(row[key]))}</span>
                          )}
                        </td>
                      ))}
                      <td className="history-row-actions">
                        {isEditing ? (
                          <>
                            <button className="history-row-button history-row-save" type="button" onClick={() => void saveRow(row.id)} disabled={isBusy}>
                              {isBusy ? 'Saving…' : 'Save'}
                            </button>
                            <button className="history-row-button" type="button" onClick={() => cancelEdit(row.id)} disabled={isBusy}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button className="history-row-button" type="button" onClick={() => { setEditingRowId(row.id); setStatus(''); }} disabled={Boolean(busyRowId) || Boolean(editingRowId)}>Edit</button>
                            <button className="history-row-button history-row-delete" type="button" onClick={() => void deleteRow(row)} disabled={Boolean(busyRowId) || Boolean(editingRowId)}>Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="history-table-empty">No snapshots to show yet.</p>
        )}
      </section>
    </div>
  );
};

export default EditableFinancialHistory;
