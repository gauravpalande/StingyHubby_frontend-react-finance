import React, { useEffect } from 'react';
import banner from '../assets/stingy-hubby-banner.png';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import EmailAuthWithCaptcha from '../components/EmailAuthWithCaptcha';
import SidebarLayout from '../components/SidebarLayout';
import { Link } from 'react-router-dom'; // Make sure react-router-dom is installed

const sidebarWidth = 140;

const HomePage: React.FC = () => {
  const supabase = useSupabaseClient();
  const session = useSession();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

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

  if (session) {
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
          <img src={banner} alt="PennyWize Banner" style={{ width: '100%', marginBottom: 24 }} />
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
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f1f3f5' }}>
      {/* Left: Login UI */}
      <div
        style={{
          flex: 2,
          background: '#fff',
          padding: 48,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative', // ⬅️ Required for positioning "About" link
        }}
      >
        {/* Top-right About Link */}
        <Link
          to="/about"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            textDecoration: 'none',
            backgroundColor: '#fff',
            padding: '6px 12px',
            borderRadius: 6,
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            color: '#333',
            fontWeight: 'bold',
            fontSize: 14,
          }}
        >
          About PennyWize
        </Link>

        <img
          src={banner}
          alt="PennyWize Banner"
          style={{ width: '100%', maxWidth: 600, marginBottom: 32 }}
        />
        <div style={{ width: '100%', maxWidth: 400 }}>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={['google']}
            onlyThirdPartyProviders
          />
          <EmailAuthWithCaptcha />
        </div>
      </div>

      {/* Right: Features section */}
      <div
        style={{
          width: 'fit-content',
          minWidth: 320,
          padding: 32,
          backgroundColor: '#f8f9fa',
          borderLeft: '1px solid #dee2e6',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: 24,
        }}
      >
        {/* Free Features */}
        <section>
          <h2 style={{ marginBottom: '0.75rem' }}>Free Features</h2>
          <ul style={{ fontSize: '1rem', lineHeight: '1.8', paddingLeft: 16 }}>
            <li>🔐 Secure Google login</li>
            <li>📥 Update finances</li>
            <li>📈 View financial trends graph</li>
            <li>📅 View past financial entries</li>
            <li>📊 Visualize income & expenses</li>
            <li>💡 AI-powered one line financial suggestion</li>
            <li>🎯 Set/View savings goals</li>
            <li>📬 Digest emails (weekly)</li>
            <li>🎨 Customize your Finance history view</li>
            <li>📤 Subscribe/unsubscribe from email digest</li>
          </ul>
        </section>

        {/* Paid Features */}
        <section>
          <h2 style={{ marginBottom: '0.75rem' }}>Paid Features</h2>
          <ul style={{ fontSize: '1rem', lineHeight: '1.8', paddingLeft: 16 }}>
            <li>All free features listed above and....</li>
            <li>📊 View progress against savings goals</li>
            <li>📤 Export financial history as CSV or PDF</li>
            <li>🧾 Edit/delete past financial entries</li>
            <li>💡 AI-powered Short-Term, Long-Term and Goals financial suggestion</li>
            <li>📬 Digest emails (monthly)</li>
            <li>👨‍💻 Priority support</li>
            <li>📎 Financial history submissions attached to newsletters</li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default HomePage;
