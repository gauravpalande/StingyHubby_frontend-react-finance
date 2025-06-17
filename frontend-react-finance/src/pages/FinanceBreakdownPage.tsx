// src/pages/FinanceBreakdownPage.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import ExpenseBreakdownChart from '../components/ExpenseBreakdownChart';

const FinanceBreakdownPage: React.FC = () => {
  const [data, setData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBreakdown = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setData([]);
        setLoading(false);
        return;
      }

      const { data: latest, error } = await supabase
        .from('submissions')
        .select('mortgage, carPayments, utilities, creditCards')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && latest) {
        const breakdown = ['mortgage', 'carPayments', 'utilities', 'creditCards'].map((key) => ({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          value: latest[key as keyof typeof latest] || 0,
        }));
        setData(breakdown);
      } else {
        setData([]);
      }

      setLoading(false);
    };

    fetchBreakdown();
  }, []);

  return (
    <div>
      <h2>📊 Expense Breakdown</h2>
      {loading ? <p>Loading...</p> : <ExpenseBreakdownChart data={data} />}
    </div>
  );
};

export default FinanceBreakdownPage;
