import React from 'react';

interface Props {
  short_term_suggestion?: string;
  long_term_suggestion?: string;
  goal_suggestion?: string;
  oneline_suggestion?: string; // used for free users
}

const GPTSuggestions: React.FC<Props> = ({
  short_term_suggestion,
  long_term_suggestion,
  goal_suggestion,
  oneline_suggestion,
}) => {
  if (
    !short_term_suggestion &&
    !long_term_suggestion &&
    !goal_suggestion &&
    !oneline_suggestion
  ) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: 24,
        padding: 16,
        backgroundColor: '#fff0f0',
        borderRadius: 8,
      }}
    >
      <h4>💡 GPT Suggestions</h4>

      {/* One-line suggestion (shown for free users) */}
      {oneline_suggestion && (
        <div style={{ marginTop: 8 }}>
          <p style={{ margin: 0 }}>{oneline_suggestion}</p>
        </div>
      )}

      {/* Detailed suggestions (shown for paid users) */}
      {short_term_suggestion && (
        <div style={{ marginTop: 16 }}>
          <h5 style={{ margin: '8px 0' }}>📆 Short-Term</h5>
          <p style={{ margin: 0 }}>{short_term_suggestion}</p>
        </div>
      )}

      {long_term_suggestion && (
        <div style={{ marginTop: 16 }}>
          <h5 style={{ margin: '8px 0' }}>📈 Long-Term</h5>
          <p style={{ margin: 0 }}>{long_term_suggestion}</p>
        </div>
      )}

      {goal_suggestion && (
        <div style={{ marginTop: 16 }}>
          <h5 style={{ margin: '8px 0' }}>🎯 Goal</h5>
          <p style={{ margin: 0 }}>{goal_suggestion}</p>
        </div>
      )}
    </div>
  );
};

export default GPTSuggestions;
