import { PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

type DataItem = { name: string; value: number };
type Props = { data: DataItem[] };

const ExpenseBreakdownChart = ({ data }: Props) => (
    <div style={{ display: 'flex', alignItems: 'center' }}>
        <PieChart width={300} height={300}>
            <Pie
                data={data}
                cx={150}
                cy={150}
                innerRadius={60}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label
            >
                {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
            </Pie>
        </PieChart>
        <ul style={{ listStyle: 'none', marginLeft: 24 }}>
            {data.map((entry, index) => (
                <li key={entry.name} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <span
                        style={{
                            display: 'inline-block',
                            width: 16,
                            height: 16,
                            backgroundColor: COLORS[index % COLORS.length],
                            marginRight: 8,
                            borderRadius: 4,
                        }}
                    />
                    {entry.name}: ${entry.value}
                </li>
            ))}
        </ul>
    </div>
);

export default ExpenseBreakdownChart;
