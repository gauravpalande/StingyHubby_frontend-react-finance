// App.tsx
import React, { useEffect, useState } from 'react';
import banner from './assets/stingy-hubby-banner.png'; // adjust path as needed
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import FinanceForm from './components/FinanceForm';

const App: React.FC = () => {
  // Replace 'any' with your actual Database type if you have a generated type from Supabase
  const supabase = useSupabaseClient<any>();
  const session = useSession();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  const handleSignOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Error signing out:', error.message)};

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px' }}>
      <img
        src={banner}
        alt="StingyHubby – Save More, Spend Less, Live Rich"
        style={{ width: '100%', marginBottom: 24 }}
      />
      {!session ? (
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']} // or ['google', 'github'] if you enabled more
        />
      ) : (
        <>
          <h2>Welcome, {session.user.email}!</h2>
          <button onClick={handleSignOut}>Sign Out</button>
          <FinanceForm />
        </>
      )}
    </div>
  );
};

export default App;
