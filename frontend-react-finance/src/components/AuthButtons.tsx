import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../supabaseClient';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import React, { useRef, useState } from 'react';

const AuthButtons = () => {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);

  return (
    <>
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={['google']}
        redirectTo={window.location.origin} // Ensure the redirect URL is set to your app's origin
      />

      <HCaptcha
        sitekey="2c02d91c-a64a-4124-85b0-d1cc928898e4" // replace with your actual sitekey
        onVerify={(token: string) => setCaptchaToken(token)}
        ref={captchaRef}
      />
    </>
  );
};

export default AuthButtons;
