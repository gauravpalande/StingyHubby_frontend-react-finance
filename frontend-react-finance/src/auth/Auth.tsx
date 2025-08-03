import { supabase } from '../supabaseClient'

const Auth = () => {
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
    redirectTo: 'https://pennywize.vercel.app'
      }
    })
    console.log('location : ' ,window.location.hostname);
    if (error) console.error('OAuth login error:', error.message)
  }

  return (
    <button onClick={signInWithGoogle}>
      Sign in with Google
    </button>
  )
}

export default Auth
