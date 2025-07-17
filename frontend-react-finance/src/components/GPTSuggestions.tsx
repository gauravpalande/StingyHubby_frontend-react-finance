import React from 'react';

interface Props {
  short_term_suggestion?: string;
  long_term_suggestion?: string;
}

const GPTSuggestions: React.FC<Props> = ({ short_term_suggestion, long_term_suggestion }) => {
  if (!short_term_suggestion && !long_term_suggestion) return null;

  return (
    <div style={{ marginTop: 24, padding: 16, backgroundColor: '#fff0f0', borderRadius: 8 }}>
      <h4>💡 GPT Suggestions</h4>

      {short_term_suggestion && (
        <div style={{ marginBottom: 16 }}>
          <h5 style={{ margin: '8px 0' }}>📆 Short-Term</h5>
          <p>{short_term_suggestion}</p>
        </div>
      )}

      {long_term_suggestion && (
        <div>
          <h5 style={{ margin: '8px 0' }}>📈 Long-Term</h5>
          <p>{long_term_suggestion}</p>
        </div>
      )}
    </div>
  );
};

export default GPTSuggestions;
