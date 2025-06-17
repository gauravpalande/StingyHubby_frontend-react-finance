// src/pages/HomePage.tsx
import React from 'react';
import banner from '../assets/stingy-hubby-banner.png';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import EmailAuthWithCaptcha from '../components/EmailAuthWithCaptcha';

const HomePage: React.FC = () => {
  const supabase = useSupabaseClient();
  const session = useSession();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/'; // force reload
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <img src={banner} alt="StingyHubby Banner" style={{ width: '100%', marginBottom: 24 }} />

      {session ? (
        <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
            <h2 style={{ width: '100%', margin: 0, textAlign: 'center' }}>Welcome, {session.user.email}!</h2>
            <button
                style={{ width: '100%', padding: '10px 0' }}
                onClick={handleLogout}
            >
                Sign Out
            </button>
        </div>
        </>
      ) : (
        <>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={['google']}
            onlyThirdPartyProviders
          />
          <EmailAuthWithCaptcha />
        </>
      )}
    </div>
  );
};

export default HomePage;
