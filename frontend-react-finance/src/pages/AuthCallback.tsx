// src/pages/AuthCallback.tsx
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export default function AuthCallback() {
  const [search] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        await supabase.auth.exchangeCodeForSession(window.location.href);
      } catch (err) {
        console.error("Auth callback error:", err);
      } finally {
        // Prefer query, else localStorage, else /app
        const rawNext =
          search.get("next") ||
          localStorage.getItem("nextAfterLogin") ||
          "/app";

        // Normalize common typo: /app/preference → /app/preferences
        const next = rawNext.replace(
          /^\/app\/preference(\/|$)/,
          "/app/preferences$1"
        );

        // Clear fallback so it doesn't affect future logins
        localStorage.removeItem("nextAfterLogin");

        navigate(next, { replace: true });
      }
    })();
  }, [navigate, search]);

  return <div style={{ padding: 16, fontFamily: "system-ui" }}>Signing you in…</div>;
}
