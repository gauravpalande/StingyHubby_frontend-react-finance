import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient'; // Adjust path as needed
import GPTSuggestions from '../components/GPTSuggestions';

const GPTSuggestionPage = () => {
    const [suggestion, setSuggestion] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLatestSuggestion = async () => {
            setLoading(true);
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setSuggestion('Please log in to see suggestions.');
                setLoading(false);
                return;
            }
            // Fetch latest suggestion for user
            const { data, error } = await supabase
                .from('suggestions')
                .select('suggestion')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !data) {
                setSuggestion('No suggestions found.');
            } else {
                setSuggestion(data.suggestion);
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
                <GPTSuggestions suggestion={suggestion} />
            )}
        </div>
    );
};

export default GPTSuggestionPage;
