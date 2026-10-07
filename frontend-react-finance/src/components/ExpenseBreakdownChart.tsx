import React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface ExpenseData {
  name: string;
  value: number;
}

interface Props {
  data: ExpenseData[];
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444'];
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const ExpenseBreakdownChart: React.FC<Props> = ({ data }) => {
  const expenses = data.filter((item) => item.value > 0);
  const total = expenses.reduce((sum, item) => sum + item.value, 0);

  if (!total) {
    return (
      <div style={{ display: 'grid', minHeight: 240, placeItems: 'center', color: '#64748b', textAlign: 'center' }}>
        No tracked expenses in the latest snapshot.
      </div>
    );
  }

  return (
    <div aria-label="Latest monthly expenses by category">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Tooltip
            formatter={(value, name) => [
              `${currencyFormatter.format(Number(value))} · ${((Number(value) / total) * 100).toFixed(1)}%`,
              name,
            ]}
            contentStyle={{ borderRadius: 10, borderColor: '#dce3e8' }}
          />
          <Pie
            data={expenses}
            dataKey="value"
            nameKey="name"
            cx="54%"
            cy="50%"
            innerRadius={48}
            outerRadius={88}
            paddingAngle={2}
            stroke="#fff"
            strokeWidth={2}
            isAnimationActive
            animationDuration={1500}
          >
            {expenses.map((item, index) => (
              <Cell key={item.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <p style={{ margin: '-2px 0 0', color: '#64748b', fontSize: 13, textAlign: 'center' }}>
        Total tracked expenses: {currencyFormatter.format(total)}
      </p>
    </div>
  );
};

export default ExpenseBreakdownChart;
