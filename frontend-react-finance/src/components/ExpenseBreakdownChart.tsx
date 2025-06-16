import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient'; // Adjust path as needed
import ExpenseBreakdownChart from './ExpenseBreakdownChart';

interface ExpenseData {
    name: string;
    value: number;
}

const ExpenseBreakdownContainer: React.FC = () => {
    const [, setData] = useState<ExpenseData[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: expenses, error } = await supabase
                .from('expenses')
                .select('mortgage, utilities, creditCards, carPayments')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !expenses) return;

            const { mortgage, utilities, creditCards, carPayments } = expenses;
            setData([
                { name: 'Mortgage', value: mortgage },
                { name: 'Utilities', value: utilities },
                { name: 'Credit Cards', value: creditCards },
                { name: 'Car Payments', value: carPayments },
            ]);
        };

        fetchData();
    }, []);

    return (
        <ExpenseBreakdownChart />
    );
};

export default ExpenseBreakdownContainer;
