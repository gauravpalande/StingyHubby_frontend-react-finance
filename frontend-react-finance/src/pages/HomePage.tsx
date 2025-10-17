// src/pages/HomePage.tsx
import React, { useEffect, useMemo } from "react";
import banner from "../assets/stingy-hubby-banner.png";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import EmailAuthWithCaptcha from "../components/EmailAuthWithCaptcha";
import SidebarLayout from "../components/SidebarLayout";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";

const sidebarWidth = 140;

const HomePage: React.FC = () => {
  const supabase = useSupabaseClient();
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();

  const nextPath = search.get("next") || "/app";
  const authRedirect = useMemo(
    () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    [nextPath]
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // When user clicks any auth button, make sure we have a fallback stored
  useEffect(() => {
    // Keep this value fresh on the homepage
    localStorage.setItem("nextAfterLogin", nextPath);
  }, [nextPath]);

  // Sync user on sign-in, then go to "next"
  useEffect(() => {
    const syncUserAndRoute = async () => {
      if (!session?.user) return;

      const { id, email, user_metadata } = session.user;
      const name = user_metadata?.full_name || user_metadata?.name || null;

      const { error } = await supabase.from("users").upsert(
        { id, email, name },
        { onConflict: "id" }
      );
      if (error) {
        console.error("❌ Failed to sync user:", error.message);
      }

      if (!location.pathname.startsWith("/app")) {
        navigate(nextPath, { replace: true });
      }
    };

    syncUserAndRoute();
  }, [session, supabase, navigate, location.pathname, nextPath]);

  if (session && location.pathname === "/") {
    return <div style={{ padding: 24, fontFamily: "system-ui" }}>Redirecting…</div>;
  }

  if (session) {
    return (
      <SidebarLayout sidebarWidth={sidebarWidth}>
        <main style={{ marginLeft: sidebarWidth, width: "100%", maxWidth: 720, padding: 24, margin: "0 auto" }}>
          <img src={banner} alt="PennyWize Banner" style={{ width: "100%", marginBottom: 24 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
            <h2 style={{ width: "100%", margin: 0, textAlign: "center" }}>Welcome, {session.user.email}!</h2>
            <button style={{ width: "100%", padding: "10px 0" }} onClick={handleLogout}>Sign Out</button>
          </div>
        </main>
      </SidebarLayout>
    );
  }

  // Logged-out view
  return (
    <div style={{ display: "flex", height: "100vh", background: "#f1f3f5" }}>
      {/* Left: Login UI */}
      <div style={{ flex: 2, background: "#fff", padding: 48, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", position: "relative" }}>
        <Link to="/about" style={{ position: "absolute", top: 16, right: 16, textDecoration: "none", backgroundColor: "#fff", padding: "6px 12px", borderRadius: 6, boxShadow: "0 2px 6px rgba(0,0,0,0.1)", color: "#333", fontWeight: "bold", fontSize: 14 }}>
          About PennyWize
        </Link>

        <img src={banner} alt="PennyWize Banner" style={{ width: "100%", maxWidth: 600, marginBottom: 32 }} />

        <div style={{ width: "100%", maxWidth: 400 }}>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={["google"]}
            onlyThirdPartyProviders
            redirectTo={authRedirect}         /* ← ensure OAuth goes to callback with next */
          />
          <EmailAuthWithCaptcha redirectTo={authRedirect} /> {/* ← make sure email magic link uses same redirect */}
        </div>
      </div>

      {/* Right: Features */}
      <div style={{ width: "fit-content", minWidth: 320, padding: 32, backgroundColor: "#f8f9fa", borderLeft: "1px solid #dee2e6", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: 24 }}>
        <section>
          <h2 style={{ marginBottom: "0.75rem" }}>Free Features</h2>
          <ul style={{ fontSize: "1rem", lineHeight: "1.8", paddingLeft: 16 }}>
            <li>🔐 Secure Google login</li>
            <li>📥 Update finances</li>
            <li>📈 View financial trends graph</li>
            <li>📅 View past financial entries</li>
            <li>📊 Visualize income & expenses</li>
            <li>💡 AI-powered one line financial suggestion</li>
            <li>🎯 Set/View savings goals</li>
            <li>📬 Digest emails (weekly)</li>
            <li>🎨 Customize your Finance history view</li>
            <li>📤 Subscribe/unsubscribe from email digest</li>
          </ul>
        </section>

        <section>
          <h2 style={{ marginBottom: "0.75rem" }}>Paid Features</h2>
          <ul style={{ fontSize: "1rem", lineHeight: "1.8", paddingLeft: 16 }}>
            <li>All free features listed above and....</li>
            <li>📊 View progress against savings goals</li>
            <li>📤 Export financial history as CSV or PDF</li>
            <li>🧾 Edit/delete past financial entries</li>
            <li>💡 AI-powered Short-Term, Long-Term and Goals financial suggestion</li>
            <li>📬 Digest emails (monthly)</li>
            <li>👨‍💻 Priority support</li>
            <li>📎 Financial history submissions attached to newsletters</li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default HomePage;
