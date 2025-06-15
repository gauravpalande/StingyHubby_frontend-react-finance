// src/components/SignOutButton.tsx
import { useSupabaseClient } from '@supabase/auth-helpers-react';

const SignOutButton = () => {
  const supabase = useSupabaseClient();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error.message);
    } else {
      // Optionally reload or redirect
      window.location.href = '/';
    }
  };

  return <button onClick={handleSignOut}>Sign Out</button>;
};

export default SignOutButton;
