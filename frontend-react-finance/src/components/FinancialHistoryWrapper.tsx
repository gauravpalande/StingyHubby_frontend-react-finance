import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import FinancialHistory from './FinancialHistory';

const FinancialHistoryWrapper: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (data) {
        setHistory(
          data.map((d: any) => ({
            ...d,
            timestamp: new Date(d.created_at).toLocaleDateString(),
          }))
        );
      }
    };
    fetchHistory();
  }, [user, supabase]);

  return <FinancialHistory history={history} />;
};

export default FinancialHistoryWrapper;
