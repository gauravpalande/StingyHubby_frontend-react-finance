// components/UserPreferences.tsx
import { usePreferences } from '../hooks/usePreferences';

const UserPreferences = () => {
  const { prefs, updatePrefs, loading } = usePreferences();

  if (loading) return <p>Loading...</p>;
  if (!prefs) return <p>No preferences loaded.</p>;

  return (
    <div style={{ maxWidth: 500 }}>
      <h2>⚙️ Your Preferences</h2>

      <div>
        <label>📈 Preferred Graph Type:</label><br />
        <select
          value={prefs.graph_type}
          onChange={(e) => updatePrefs({ graph_type: e.target.value })}
        >
          <option value="line">Line</option>
          <option value="bar">Bar</option>
        </select>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={prefs.show_suggestions}
            onChange={(e) => updatePrefs({ show_suggestions: e.target.checked })}
          />
          💡 Show GPT Suggestions
        </label>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={prefs.email_digest}
            onChange={(e) => updatePrefs({ email_digest: e.target.checked })}
          />
          📨 Receive Weekly Digest Emails
        </label>
      </div>
    </div>
  );
};

export default UserPreferences;
