// src/components/SignOutButton.tsx
import React from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

const SignOutButton: React.FC = () => {
  const supabase = useSupabaseClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return <button onClick={handleSignOut}>Sign Out</button>;
};

export default SignOutButton;
