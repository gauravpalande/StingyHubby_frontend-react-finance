import React, { useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

const FeedbackForm: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [type, setType] = useState<'feature' | 'bug' | 'security'>('feature');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase.from('feedback').insert({
      user_id: user.id,
      type,
      title,
      description,
    });

    if (error) {
      alert('Error submitting feedback: ' + error.message);
    } else {
      setSuccess(true);
      setTitle('');
      setDescription('');
    }
  };

  const getSuccessMessage = () => {
    if (type === 'bug') {
      return '🐞 Bug reported successfully';
    }
    if (type === 'security') {
      return '🔒 Security concern reported successfully';
    }
    return '✅ Feedback submitted successfully';
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <h2>Submit Feedback</h2>
      {success && <p style={{ color: 'green' }}>{getSuccessMessage()}</p>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label>
          Type:
          <select value={type} onChange={(e) => setType(e.target.value as 'feature' | 'bug' | 'security')}>
            <option value="feature">Feature Request</option>
            <option value="bug">Bug Report</option>
            <option value="security">Security concern</option>
          </select>
        </label>

        <label>
          Title:
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <label>
          Description:
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
        </label>

        <button type="submit">Submit</button>
      </form>
    </div>
  );
};

export default FeedbackForm;
