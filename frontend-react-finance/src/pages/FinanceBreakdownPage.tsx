import { useEffect, useState } from 'react';
import ExpenseBreakdownChart from '../components/ExpenseBreakdownChart';

// Mock function to fetch finance data for the logged-in user
// Replace this with your actual API call
const fetchFinanceData = async () => {
    // Example response structure
    return {
        mortgage: 1200,
        utilities: 300,
        creditCards: 500,
        carPayments: 400,
    };
};

const FinanceBreakdownPage = () => {
    const [data, setData] = useState<
        { name: string; value: number }[]
    >([]);

    useEffect(() => {
        const getData = async () => {
            const res = await fetchFinanceData();
            setData([
                { name: 'Mortgage', value: res.mortgage },
                { name: 'Utilities', value: res.utilities },
                { name: 'Credit Cards', value: res.creditCards },
                { name: 'Car Payments', value: res.carPayments },
            ]);
        };
        getData();
    }, []);

    return (
        <div>
            <h2>Breakdown Expenses</h2>
            <ExpenseBreakdownChart data={data} />
        </div>
    );
};

export default FinanceBreakdownPage;
