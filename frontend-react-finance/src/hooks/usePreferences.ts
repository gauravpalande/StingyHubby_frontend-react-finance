// hooks/usePreferences.ts
import { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

type Preferences = {
  graph_type: string | null;
  show_suggestions: boolean;
  email_weekly_digest: boolean;
  email_monthly_digest: boolean;
  user_id?: string;
};

export const usePreferences = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [prefs, setPrefs] = useState<Partial<Preferences> | null>(null);
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
  }, [supabase, user]);

  const updatePrefs = async (updates: Partial<Preferences>) => {
    if (!user) return;
    const newPrefs = { ...prefs, ...updates, user_id: user.id };
    await supabase
      .from('preferences')
      .upsert(newPrefs, { onConflict: 'user_id' });
    setPrefs(newPrefs);
  };

  return { prefs, updatePrefs, loading };
};
