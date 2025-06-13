import { supabase } from '../supabaseClient'

const redirectTo =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://stingy-hubby-frontend-react-finance.vercel.app';

const Auth = () => {
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
    redirectTo: redirectTo
      }
    })
    console.log(redirectTo);
    if (error) console.error('OAuth login error:', error.message)
  }

  return (
    <button onClick={signInWithGoogle}>
      Sign in with Google
    </button>
  )
}

export default Auth
