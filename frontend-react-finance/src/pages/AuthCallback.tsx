// src/pages/AuthCallback.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

// Reuse your existing env variables
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export default function AuthCallback() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Completing sign-in...");

  useEffect(() => {
    (async () => {
      try {
        const url = window.location.href;

        // PKCE flow: ?code=...
        const code = search.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          if (error) throw error;
        } else if (window.location.hash.includes("access_token")) {
          // Legacy hash-based flow fallback
          const hash = new URLSearchParams(window.location.hash.slice(1));
          const access_token = hash.get("access_token");
          const refresh_token = hash.get("refresh_token");
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
          }
        }

        const next = search.get("next") || "/app/preferences";
        navigate(next, { replace: true });
      } catch (err) {
        console.error("Auth callback error", err);
        setMsg("We could not complete sign-in. Please try again.");
      }
    })();
  }, [navigate, search]);

  return <div style={{ padding: 16, fontFamily: "system-ui" }}>{msg}</div>;
}
