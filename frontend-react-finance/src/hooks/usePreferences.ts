// hooks/usePreferences.ts
import { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

export const usePreferences = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [prefs, setPrefs] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchPrefs = async () => {
      const { data } = await supabase
        .from('preferences')
        .select('graph_type, show_suggestions, email_weekly_digest, email_monthly_digest')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setPrefs(data);
      }
      setLoading(false);
    };
    fetchPrefs();
  }, [user]);

  const updatePrefs = async (updates: any) => {
    if (!user) return;
    const newPrefs = { ...prefs, ...updates, user_id: user.id };
    await supabase
      .from('preferences')
      .upsert(newPrefs, { onConflict: 'user_id' });
    setPrefs(newPrefs);
  };

  return { prefs, updatePrefs, loading };
};
