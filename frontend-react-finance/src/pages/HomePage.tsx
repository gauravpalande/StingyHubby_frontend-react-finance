// src/pages/HomePage.tsx
import React from 'react';
import banner from '../assets/stingy-hubby-banner.png';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import EmailAuthWithCaptcha from '../components/EmailAuthWithCaptcha';

const sidebarWidth = 220;

const Sidebar: React.FC = () => (
  <aside
    style={{
      width: sidebarWidth,
      background: '#f5f5f5',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      padding: '32px 16px',
      boxSizing: 'border-box',
      borderRight: '1px solid #e0e0e0',
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
    }}
  >
    <h2 style={{ margin: 0, fontSize: 22 }}>StingyHubby</h2>
    <nav style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <a href="/" style={{ color: '#333', textDecoration: 'none' }}>Home</a>
      <a href="/dashboard" style={{ color: '#333', textDecoration: 'none' }}>Dashboard</a>
      <a href="/profile" style={{ color: '#333', textDecoration: 'none' }}>Profile</a>
      {/* Add more links as needed */}
    </nav>
  </aside>
);

const HomePage: React.FC = () => {
  const supabase = useSupabaseClient();
  const session = useSession();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
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
    </div>
  );
};

export default HomePage;
