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
        // PKCE / OAuth: Supabase attaches ?code=...
        await supabase.auth.exchangeCodeForSession(window.location.href);
      } catch (err) {
        console.error("Auth callback error:", err);
      } finally {
        // 1) Prefer the explicit ?next=...
        const fromQuery = search.get("next");
        // 2) Fallback to what we saved before redirect (see HomePage)
        const fromStorage = localStorage.getItem("nextAfterLogin") || undefined;
        localStorage.removeItem("nextAfterLogin");

        const next = fromQuery || fromStorage || "/app";
        navigate(next, { replace: true });
      }
    })();
  }, [navigate, search]);

  return <div style={{ padding: 16, fontFamily: "system-ui" }}>Signing you in…</div>;
}
