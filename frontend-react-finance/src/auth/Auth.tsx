import { supabase } from '../supabaseClient'

const Auth = () => {
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
    redirectTo: 'https://stingy-hubby-frontend-react-finance.vercel.app'
      }
    })
    if (error) console.error('OAuth login error:', error.message)
  }

  return (
    <button onClick={signInWithGoogle}>
      Sign in with Google
    </button>
  )
}

export default Auth
