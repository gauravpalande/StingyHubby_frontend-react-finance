// src/components/AuthSection.tsx
import React, { useEffect, useMemo } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import EmailAuthWithCaptcha from "./EmailAuthWithCaptcha";

const AuthSection: React.FC = () => {
  const supabase = useSupabaseClient();

  // Read the ?next= param (default to /app)
  const nextPath = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("next") || "/app";
  }, []);

  // Callback URL that preserves `next`
  const redirectTo = useMemo(() => {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      nextPath
    )}`;
  }, [nextPath]);

  // Keep a local fallback in case some providers strip query params
  useEffect(() => {
    localStorage.setItem("nextAfterLogin", nextPath);
  }, [nextPath]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px" }}>
      <img src="/assets/stingy-hubby-banner.png" alt="PennyWize" style={{ width: "100%" }} />

      {/* ensure OAuth redirects to callback with next */}
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={["google"]}
        onlyThirdPartyProviders
        redirectTo={redirectTo}
      />

      {/* required prop */}
      <EmailAuthWithCaptcha redirectTo={redirectTo} />
    </div>
  );
};

export default AuthSection;
