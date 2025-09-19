import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export async function syncUserToDB(user: { id: string; email: string; name?: string }) {
  const { error } = await supabase.from('users').upsert(
    {
      id: user.id,
      email: user.email,
      name: user.name || null,
    },
    { onConflict: 'id' } // avoid duplicate insertions
  );

  if (error) {
    console.error("❌ Failed to sync user to DB:", error.message);
  } else {
    console.log("✅ Synced user to DB:", user.email);
  }
}
