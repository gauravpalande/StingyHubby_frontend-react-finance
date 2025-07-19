import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import GPTSuggestions from '../components/GPTSuggestions';

const GPTSuggestionPage = () => {
  const [shortTermSuggestion, setShortTermSuggestion] = useState('');
  const [longTermSuggestion, setLongTermSuggestion] = useState('');
  const [goalsSuggestion, setGoalsSuggestion] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatestSuggestion = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setShortTermSuggestion('Please log in to see suggestions.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('submissions')
        .select('short_term_suggestion, long_term_suggestion, goal_suggestion')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        setShortTermSuggestion('No suggestions found.');
      } else {
        setShortTermSuggestion(data.short_term_suggestion || '');
        setLongTermSuggestion(data.long_term_suggestion || '');
        setGoalsSuggestion(data.goal_suggestion || '');
      }

      setLoading(false);
    };

    fetchLatestSuggestion();
  }, []);

  return (
    <div>
      <h2>GPT Suggestions</h2>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <GPTSuggestions
          short_term_suggestion={shortTermSuggestion}
          long_term_suggestion={longTermSuggestion}
          goal_suggestion={goalsSuggestion}
        />
      )}
    </div>
  );
};

export default GPTSuggestionPage;
