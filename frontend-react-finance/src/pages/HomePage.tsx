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

  return session ? (
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
    </main>
  </SidebarLayout>
) : (
  <div style={{ display: 'flex', height: '100vh', background: '#f1f3f5' }}>
    {/* Left: Login UI */}
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#fff',
        padding: 32,
      }}
    >
      <img src={banner} alt="StingyHubby Banner" style={{ maxWidth: 360, marginBottom: 24 }} />
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={['google']}
        onlyThirdPartyProviders
      />
      <EmailAuthWithCaptcha />
    </div>

    {/* Right: Features section */}
    <div
      style={{
        flex: 1,
        backgroundColor: '#f8f9fa',
        padding: 48,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        borderLeft: '1px solid #dee2e6',
      }}
    >
      <h2 style={{ marginBottom: '1.5rem' }}>📋 Features</h2>
      <ul style={{ fontSize: '1.1rem', lineHeight: '1.8' }}>
        <li>🔐 Secure Google login</li>
        <li>📥 Update and track financial inputs</li>
        <li>📊 Visualize income vs. expenses</li>
        <li>🧾 Edit/delete past submissions</li>
        <li>💡 AI-powered savings suggestions</li>
        <li>🎯 Set personalized financial goals</li>
        <li>📬 Weekly/monthly digest emails</li>
        <li>📤 Export to CSV or PDF</li>
        <li>🎨 Customize chart and layout</li>
        <li>🐞 Submit bugs & feature requests</li>
      </ul>
    </div>
  </div>
);
};

export default HomePage;
