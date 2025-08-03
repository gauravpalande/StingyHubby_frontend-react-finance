// src/components/AuthSection.tsx
import React from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import EmailAuthWithCaptcha from './EmailAuthWithCaptcha';

const AuthSection: React.FC = () => {
  const supabase = useSupabaseClient();

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px' }}>
      <img src="/assets/stingy-hubby-banner.png" alt="PennyWize" style={{ width: '100%' }} />
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={['google']}
        onlyThirdPartyProviders
      />
      <EmailAuthWithCaptcha />
    </div>
  );
};

export default AuthSection;
