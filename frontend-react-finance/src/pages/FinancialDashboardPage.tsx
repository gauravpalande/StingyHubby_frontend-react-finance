import React, { useEffect, useMemo, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import ExpenseBreakdownChart from '../components/ExpenseBreakdownChart';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type NumericFinanceField =
  | 'income'
  | 'checking'
  | 'emergency'
  | 'health'
  | 'retirement'
  | 'creditCards'
  | 'mortgage'
  | 'carPayments'
  | 'utilities';

type SubmissionSnapshot = Record<NumericFinanceField, number | null> & {
  created_at: string;
  short_term_suggestion: string | null;
  long_term_suggestion: string | null;
  goal_suggestion: string | null;
  oneline_suggestion: string | null;
};

type GoalSnapshot = {
  emergency: number | null;
  retirement: number | null;
  health: number | null;
};

type DashboardMetrics = {
  monthlyExpenses: number;
  netCashFlow: number;
  savingsRate: number;
  emergencyCoverageMonths: number;
  creditCardLoad: number;
  goalProgress: number;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
});

const dashboardShell: React.CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
  color: '#1f2937',
};

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 20,
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
};

const mutedText: React.CSSProperties = {
  color: '#64748b',
  margin: 0,
};

function toAmount(value: number | null) {
  return Number(value) || 0;
}

function calculateMetrics(latest: SubmissionSnapshot, goals: GoalSnapshot | null): DashboardMetrics {
  const income = toAmount(latest.income);
  const monthlyExpenses =
    toAmount(latest.mortgage) +
    toAmount(latest.carPayments) +
    toAmount(latest.utilities) +
    toAmount(latest.creditCards);
  const netCashFlow = income - monthlyExpenses;
  const savingsRate = income > 0 ? (netCashFlow / income) * 100 : 0;
  const emergencyCoverageMonths =
    monthlyExpenses > 0 ? toAmount(latest.emergency) / monthlyExpenses : 0;
  const creditCardLoad = income > 0 ? (toAmount(latest.creditCards) / income) * 100 : 0;
  const goalPairs = [
    [toAmount(latest.emergency), toAmount(goals?.emergency ?? null)],
    [toAmount(latest.retirement), toAmount(goals?.retirement ?? null)],
    [toAmount(latest.health), toAmount(goals?.health ?? null)],
  ].filter(([, goal]) => goal > 0);
  const goalProgress = goalPairs.length
    ? goalPairs.reduce((sum, [current, goal]) => sum + Math.min((current / goal) * 100, 100), 0) /
      goalPairs.length
    : 0;

  return {
    monthlyExpenses,
    netCashFlow,
    savingsRate,
    emergencyCoverageMonths,
    creditCardLoad,
    goalProgress,
  };
}

function buildAdvice(latest: SubmissionSnapshot, goals: GoalSnapshot | null, metrics: DashboardMetrics) {
  if (metrics.netCashFlow < 0) {
    return {
      title: 'Reduce the monthly shortfall',
      body: `Expenses are ${currencyFormatter.format(Math.abs(metrics.netCashFlow))} above income in the latest snapshot.`,
    };
  }

  if (toAmount(latest.creditCards) > 0) {
    return {
      title: 'Prioritize credit card payoff',
      body: `${currencyFormatter.format(toAmount(latest.creditCards))} is marked against credit cards, which is ${percentFormatter.format(metrics.creditCardLoad)}% of income.`,
    };
  }

  if (metrics.emergencyCoverageMonths < 3) {
    return {
      title: 'Build emergency coverage',
      body: `Emergency savings cover ${metrics.emergencyCoverageMonths.toFixed(1)} months of tracked expenses.`,
    };
  }

  if (toAmount(goals?.retirement ?? null) > 0 && toAmount(latest.retirement) < toAmount(goals?.retirement ?? null)) {
    return {
      title: 'Keep retirement contributions moving',
      body: `Retirement progress is tracking below the current ${currencyFormatter.format(toAmount(goals?.retirement ?? null))} goal.`,
    };
  }

  return {
    title: 'Maintain the current plan',
    body: 'Cash flow, emergency coverage, and goal progress look stable in the latest snapshot.',
  };
}

function getTrend(current: number, previous: number) {
  const delta = current - previous;

  if (delta > 0) return `+${currencyFormatter.format(delta)}`;
  if (delta < 0) return `-${currencyFormatter.format(Math.abs(delta))}`;
  return currencyFormatter.format(0);
}

const FinancialDashboardPage: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [submissions, setSubmissions] = useState<SubmissionSnapshot[]>([]);
  const [goals, setGoals] = useState<GoalSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadDashboard = async () => {
      if (!user) {
        setSubmissions([]);
        setGoals(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage('');

      const [submissionResult, goalResult] = await Promise.all([
        supabase
          .from('submissions')
          .select(
            'created_at, income, checking, emergency, health, retirement, creditCards, mortgage, carPayments, utilities, short_term_suggestion, long_term_suggestion, goal_suggestion, oneline_suggestion'
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('goals')
          .select('emergency, retirement, health')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (submissionResult.error) {
        setErrorMessage(submissionResult.error.message);
      } else {
        setSubmissions((submissionResult.data ?? []) as SubmissionSnapshot[]);
      }

      if (goalResult.error) {
        setErrorMessage(goalResult.error.message);
      } else {
        setGoals((goalResult.data as GoalSnapshot | null) ?? null);
      }

      setLoading(false);
    };

    loadDashboard();
  }, [supabase, user]);

  const latest = submissions[0];
  const previous = submissions[1];

  const metrics = useMemo(
    () => (latest ? calculateMetrics(latest, goals) : null),
    [goals, latest]
  );

  const previousMetrics = useMemo(
    () => (previous ? calculateMetrics(previous, goals) : null),
    [goals, previous]
  );

  const advice = useMemo(
    () => (latest && metrics ? buildAdvice(latest, goals, metrics) : null),
    [goals, latest, metrics]
  );

  const chartRows = useMemo(
    () =>
      submissions
        .slice()
        .reverse()
        .map((row) => {
          const rowMetrics = calculateMetrics(row, goals);
          return {
            date: new Date(row.created_at).toLocaleDateString(),
            income: toAmount(row.income),
            checking: toAmount(row.checking),
            expenses: rowMetrics.monthlyExpenses,
            netCashFlow: rowMetrics.netCashFlow,
            emergency: toAmount(row.emergency),
            retirement: toAmount(row.retirement),
            health: toAmount(row.health),
          };
        }),
    [goals, submissions]
  );

  const latestSuggestion =
    latest?.oneline_suggestion ||
    latest?.short_term_suggestion ||
    latest?.goal_suggestion ||
    latest?.long_term_suggestion ||
    '';

  if (loading) {
    return <p>Loading dashboard...</p>;
  }

  if (errorMessage) {
    return <p style={{ color: '#b91c1c' }}>Dashboard could not load: {errorMessage}</p>;
  }

  if (!latest || !metrics) {
    return (
      <div style={dashboardShell}>
        <h2>Financial Dashboard</h2>
        <p style={mutedText}>Submit a finance update to see automated tracking and advising metrics.</p>
      </div>
    );
  }

  const metricCards = [
    {
      label: 'Monthly Income',
      value: currencyFormatter.format(toAmount(latest.income)),
      trend: previous ? getTrend(toAmount(latest.income), toAmount(previous.income)) : 'No prior snapshot',
    },
    {
      label: 'Tracked Expenses',
      value: currencyFormatter.format(metrics.monthlyExpenses),
      trend: previousMetrics
        ? getTrend(metrics.monthlyExpenses, previousMetrics.monthlyExpenses)
        : 'No prior snapshot',
    },
    {
      label: 'Net Cash Flow',
      value: currencyFormatter.format(metrics.netCashFlow),
      trend: previousMetrics
        ? getTrend(metrics.netCashFlow, previousMetrics.netCashFlow)
        : 'No prior snapshot',
    },
    {
      label: 'Savings Rate',
      value: `${percentFormatter.format(metrics.savingsRate)}%`,
      trend: `${metrics.emergencyCoverageMonths.toFixed(1)} months emergency coverage`,
    },
  ];

  const goalCards = [
    {
      label: 'Emergency',
      current: toAmount(latest.emergency),
      target: toAmount(goals?.emergency ?? null),
    },
    {
      label: 'Retirement',
      current: toAmount(latest.retirement),
      target: toAmount(goals?.retirement ?? null),
    },
    {
      label: 'Health',
      current: toAmount(latest.health),
      target: toAmount(goals?.health ?? null),
    },
  ];

  const expenseBreakdown = [
    { name: 'Mortgage', value: toAmount(latest.mortgage) },
    { name: 'Car payments', value: toAmount(latest.carPayments) },
    { name: 'Utilities', value: toAmount(latest.utilities) },
    { name: 'Credit cards', value: toAmount(latest.creditCards) },
  ];

  return (
    <div style={dashboardShell}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 8px' }}>Financial Dashboard</h2>
        <p style={mutedText}>Latest snapshot: {new Date(latest.created_at).toLocaleDateString()}</p>
      </div>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {metricCards.map((card) => (
          <div key={card.label} style={cardStyle}>
            <div style={{ color: '#64748b', fontSize: 13, marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{card.value}</div>
            <div style={{ color: '#475569', fontSize: 13 }}>{card.trend}</div>
          </div>
        ))}
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Income, Expenses, and Cash Flow</h3>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => currencyFormatter.format(Number(value))} />
              <Line type="monotone" dataKey="income" stroke="#2563eb" strokeWidth={2} />
              <Line type="monotone" dataKey="expenses" stroke="#dc2626" strokeWidth={2} />
              <Line type="monotone" dataKey="netCashFlow" stroke="#059669" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Automated Advice</h3>
          <strong>{advice?.title}</strong>
          <p style={{ color: '#475569' }}>{advice?.body}</p>
          {latestSuggestion && (
            <>
              <h4 style={{ marginBottom: 6 }}>Latest AI Suggestion</h4>
              <p style={{ color: '#475569', marginBottom: 0 }}>{latestSuggestion}</p>
            </>
          )}
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
          gap: 16,
        }}
      >
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Goal Progress</h3>
          <div style={{ color: '#475569', marginBottom: 12 }}>
            Average progress: {percentFormatter.format(metrics.goalProgress)}%
          </div>
          {goalCards.map((goal) => {
            const percent = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
            return (
              <div key={goal.label} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span>{goal.label}</span>
                  <span>
                    {currencyFormatter.format(goal.current)} /{' '}
                    {goal.target > 0 ? currencyFormatter.format(goal.target) : 'No goal'}
                  </span>
                </div>
                <div style={{ background: '#e2e8f0', borderRadius: 8, height: 10, marginTop: 6 }}>
                  <div
                    style={{
                      width: `${percent}%`,
                      background: percent >= 100 ? '#16a34a' : '#2563eb',
                      borderRadius: 8,
                      height: '100%',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Savings Buckets</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartRows.slice(-1)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => currencyFormatter.format(Number(value))} />
              <Bar dataKey="checking" fill="#0f766e" />
              <Bar dataKey="emergency" fill="#2563eb" />
              <Bar dataKey="retirement" fill="#7c3aed" />
              <Bar dataKey="health" fill="#ea580c" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Expense Breakdown</h3>
          <p style={{ ...mutedText, marginBottom: 8 }}>Latest snapshot · {new Date(latest.created_at).toLocaleDateString()}</p>
          <ExpenseBreakdownChart data={expenseBreakdown} />
        </div>
      </section>
    </div>
  );
};

export default FinancialDashboardPage;
