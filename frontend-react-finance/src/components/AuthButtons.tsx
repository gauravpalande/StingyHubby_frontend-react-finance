import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../supabaseClient';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { useRef } from 'react';

const AuthButtons = () => {
  // Removed unused captchaToken state
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
        onVerify={() => {}}
        ref={captchaRef}
      />
    </>
  );
};

export default AuthButtons;
