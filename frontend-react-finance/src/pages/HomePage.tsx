// src/pages/HomePage.tsx
import React, { useEffect } from 'react';
import banner from '../assets/stingy-hubby-banner.png';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import EmailAuthWithCaptcha from '../components/EmailAuthWithCaptcha';
import SidebarLayout from '../components/SidebarLayout';

const sidebarWidth = 140;

const HomePage: React.FC = () => {
  const supabase = useSupabaseClient();
  const session = useSession();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  // 🔄 Sync user to Supabase `users` table
  useEffect(() => {
    const syncUserToDB = async () => {
      if (!session?.user) return;

      const { id, email, user_metadata } = session.user;
      const name = user_metadata?.full_name || user_metadata?.name || null;

      const { error } = await supabase.from('users').upsert(
        {
          id,
          email,
          name,
        },
        { onConflict: 'id' }
      );

      if (error) {
        console.error('❌ Failed to sync user:', error.message);
      } else {
        console.log('✅ User synced to DB:', email);
      }
    };

    syncUserToDB();
  }, [session, supabase]);

  return (
    <SidebarLayout sidebarWidth={sidebarWidth}>
      <main
        style={{
          marginLeft: sidebarWidth,
          width: '100%',
          maxWidth: 720,
          padding: 24,
          margin: '0 auto',
        }}
      >
        <img src={banner} alt="StingyHubby Banner" style={{ width: '100%', marginBottom: 24 }} />

        {session ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
            <h2 style={{ width: '100%', margin: 0, textAlign: 'center' }}>
              Welcome, {session.user.email}!
            </h2>
            <button
              style={{ width: '100%', padding: '10px 0' }}
              onClick={handleLogout}
            >
              Sign Out
            </button>
          </div>
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
      </main>
    </SidebarLayout>
  );
};

export default HomePage;
