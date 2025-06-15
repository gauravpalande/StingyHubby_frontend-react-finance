import React, { useRef, useState } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { supabase } from '../supabaseClient';

const EmailAuthWithCaptcha: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const captchaRef = useRef<HCaptcha>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!captchaToken) {
      alert("Please complete the CAPTCHA.");
      return;
    }

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          captchaToken
        }
      });

      if (error) {
        console.error("Sign-up error:", error.message);
        alert("Sign-up failed: " + error.message);
      } else {
        alert("Check your email to confirm sign-up.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          captchaToken
        }
      });

      if (error) {
        console.error("Sign-in error:", error.message);
        alert("Sign-in failed: " + error.message);
      } else {
        alert("Signed in successfully!");
      }
    }

    // reset captcha
    setCaptchaToken(null);
    captchaRef.current?.resetCaptcha();
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px', maxWidth: 400 }}>
      <h2>{mode === 'signup' ? 'Email Sign Up' : 'Email Sign In'}</h2>

      <input
        type="email"
        placeholder="Email"
        value={email}
        required
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        required
        onChange={(e) => setPassword(e.target.value)}
      />

      <HCaptcha
        sitekey="YOUR_PUBLIC_SITE_KEY"
        onVerify={(token) => setCaptchaToken(token)}
        ref={captchaRef}
      />

      <button type="submit">
        {mode === 'signup' ? 'Sign Up' : 'Sign In'}
      </button>

      <div style={{ fontSize: '0.9em' }}>
        {mode === 'signup' ? (
          <>
            Already have an account?{' '}
            <button type="button" onClick={() => setMode('signin')}>
              Sign In
            </button>
          </>
        ) : (
          <>
            Need an account?{' '}
            <button type="button" onClick={() => setMode('signup')}>
              Sign Up
            </button>
          </>
        )}
      </div>
    </form>
  );
};

export default EmailAuthWithCaptcha;
