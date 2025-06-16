// src/App.tsx
import React, { useEffect, useState } from 'react';
import banner from './assets/stingy-hubby-banner.png';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import FinanceForm from './components/FinanceForm';
import SignOutButton from './components/SignOutButton';
import EmailAuthWithCaptcha from './components/EmailAuthWithCaptcha'; // make sure path is correct
import { Analytics } from "@vercel/analytics/next"

const App: React.FC = () => {
  const supabase = useSupabaseClient<any>();
  const session = useSession();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  // ✅ Dynamic page title based on session
  useEffect(() => {
    if (session?.user?.email) {
      const name =
        session.user.user_metadata?.full_name ||
        session.user.email.split('@')[0];
      document.title = `Welcome ${name} – StingyHubby`;
    } else {
      document.title = 'StingyHubby';
    }
  }, [session]);

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px' }}>
      <img
        src={banner}
        alt="StingyHubby – Save More, Spend Less, Live Rich"
        style={{ width: '100%', marginBottom: 24 }}
      />

      {!session ? (
        <>
          {/* Show only when not signed in */}
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={['google']}
            onlyThirdPartyProviders
          />
          <EmailAuthWithCaptcha />
        </>
      ) : (
        <>
          {/* Show only when signed in */}
          <h2>Welcome, {session.user.email}!</h2>
          <SignOutButton />
          <FinanceForm />
          <Analytics/>
        </>
      )}
    </div>
  );
};

export default App;
