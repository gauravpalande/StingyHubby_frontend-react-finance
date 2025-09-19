// src/components/EmailAuthWithCaptcha.tsx
import React, { useState, useRef } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { supabase } from '../supabaseClient';

const EmailAuthWithCaptcha: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);
  const [message, setMessage] = useState('');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) return alert('Please complete the CAPTCHA.');

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        captchaToken,
      },
    });

    if (error) setMessage(error.message);
    else setMessage('Check your email to confirm sign-up.');
  };

  const handleSignIn = async () => {
    if (!captchaToken) return alert('Please complete the CAPTCHA.');
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {
        captchaToken,
      },
    });

    if (error) setMessage(error.message);
    else setMessage('Check your email for login link.');
  };

  return (
    <form onSubmit={handleSignUp} style={{ display: 'grid', gap: 12 }}>
      <input type="email" placeholder="Email" value={email} required onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={password} required onChange={e => setPassword(e.target.value)} />

      <HCaptcha
        sitekey="2c02d91c-a64a-4124-85b0-d1cc928898e4" // Replace with your actual sitekey
        onVerify={setCaptchaToken}
        ref={captchaRef}
      />

      <button type="submit">Sign Up</button>
      <button type="button" onClick={handleSignIn}>Sign In</button>
      {message && <p>{message}</p>}
    </form>
  );
};

export default EmailAuthWithCaptcha;
