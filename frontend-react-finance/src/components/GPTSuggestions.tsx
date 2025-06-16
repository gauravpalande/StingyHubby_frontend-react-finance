import React from 'react';

interface Props {
  suggestion: string;
}

const GPTSuggestions: React.FC<Props> = ({ suggestion }) => {
  if (!suggestion) return null;

  return (
    <div style={{ marginTop: 24, padding: 16, backgroundColor: '#fff0f0', borderRadius: 8 }}>
      <h4>💡 GPT Suggestion</h4>
      <p>{suggestion}</p>
    </div>
  );
};

export default GPTSuggestions;