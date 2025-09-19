import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import GPTSuggestions from '../components/GPTSuggestions';

const GPTSuggestionPage = () => {
  const [shortTermSuggestion, setShortTermSuggestion] = useState('');
  const [longTermSuggestion, setLongTermSuggestion] = useState('');
  const [goalsSuggestion, setGoalsSuggestion] = useState('');
  const [oneLineSuggestion, setOneLineSuggestion] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatestSuggestion = async () => {
      setLoading(true);

      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();

      if (authErr) console.error('Auth error:', authErr.message);

      if (!user) {
        setOneLineSuggestion('Please log in to see suggestions.');
        setLoading(false);
        return;
      }

      // 1) Fetch the latest suggestions, INCLUDING oneline_suggestion
      const { data: sugg, error: suggErr } = await supabase
        .from('submissions')
        .select(
          'short_term_suggestion, long_term_suggestion, goal_suggestion, oneline_suggestion'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (suggErr) console.error('Suggestions fetch error:', suggErr.message);

      const shortS = sugg?.short_term_suggestion || '';
      const longS = sugg?.long_term_suggestion || '';
      const goalS = sugg?.goal_suggestion || '';
      const oneLineDB = (sugg?.oneline_suggestion || '').toString().trim();

      setShortTermSuggestion(shortS);
      setLongTermSuggestion(longS);
      setGoalsSuggestion(goalS);

      // 2) Fetch paid flag
      const { data: paidRow, error: paidErr } = await supabase
        .from('users')
        .select('paid_user')
        .eq('id', user.id)
        .single();

      if (paidErr) console.error('Paid flag fetch error:', paidErr.message);

      const paid = !!paidRow?.paid_user;
      setIsPaid(paid);

      // 3) For free users, prefer the dedicated one-line suggestion from DB.
      //    Fallback to a collapsed version of other fields if it's empty.
      const fallbackCollapsed = (shortS || longS || goalS || 'No suggestions found.')
        .replace(/\s+/g, ' ')
        .trim();

      setOneLineSuggestion(oneLineDB || fallbackCollapsed);

      setLoading(false);
    };

    fetchLatestSuggestion();
  }, []);

  return (
    <div>
      <h2>GPT Suggestions</h2>
      {loading ? (
        <p>Loading...</p>
      ) : isPaid ? (
        <GPTSuggestions
          short_term_suggestion={shortTermSuggestion}
          long_term_suggestion={longTermSuggestion}
          goal_suggestion={goalsSuggestion}
        />
      ) : (
        <GPTSuggestions oneline_suggestion={oneLineSuggestion} />
      )}
    </div>
  );
};

export default GPTSuggestionPage;
