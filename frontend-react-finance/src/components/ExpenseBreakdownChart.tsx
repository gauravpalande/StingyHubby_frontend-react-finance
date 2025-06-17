import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface ExpenseData {
  name: string;
  value: number;
}

interface Props {
  data: ExpenseData[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

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
            outerRadius={100}
            label
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