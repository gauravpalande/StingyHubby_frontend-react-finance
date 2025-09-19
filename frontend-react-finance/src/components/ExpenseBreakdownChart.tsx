import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface ExpenseData {
  name: string;
  value: number;
}

interface Props {
  data: ExpenseData[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF4C4C'];

const ExpenseBreakdownChart: React.FC<Props> = ({ data }) => {
  return (
    <div style={{ marginTop: 40 }}>
      <h3>Expense Breakdown</h3>
      <ResponsiveContainer width="100%" height={600}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={200}
            label={({ name, value }) => {
              const total = data.reduce((sum, entry) => sum + entry.value, 0);
              const percent = total ? ((value / total) * 100).toFixed(1) : 0;
              return `${name} (${percent}%)`;
            }}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ExpenseBreakdownChart;