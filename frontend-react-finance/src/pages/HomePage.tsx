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

  // Only navigate after sign-in if a next param was provided (e.g., from email link)
  const nextPath = search.get("next") || null;

  // Auth callback with next preservation
  const authRedirect = useMemo(
    () =>
      `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        nextPath || "/app"
      )}`,
    [nextPath]
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // Navigate to `next` ONLY if it's provided (e.g., arriving from email link)
  useEffect(() => {
    if (!session) return;
    if (!nextPath) return; // ← Stay on "/" if no explicit next target
    // If we're not already at an /app page, go to the requested next page
    if (!location.pathname.startsWith("/app")) {
      navigate(nextPath, { replace: true });
    }
  }, [session, nextPath, location.pathname, navigate]);

  // Sync user in the background (non-blocking)
  useEffect(() => {
    (async () => {
      if (!session?.user) return;
      try {
        const { id, email, user_metadata } = session.user;
        const name = user_metadata?.full_name || user_metadata?.name || null;
        const { error } = await supabase.from("users").upsert(
          { id, email, name },
          { onConflict: "id" }
        );
        if (error) console.error("❌ Failed to sync user:", error.message);
        else console.log("✅ User synced to DB:", email);
      } catch (e) {
        console.error("❌ Sync error:", e);
      }
    })();
  }, [session, supabase]);

  // Keep a local fallback for the callback
  useEffect(() => {
    localStorage.setItem("nextAfterLogin", nextPath || "/app");
  }, [nextPath]);

  // ---------- Signed-in view (show banner + Sign Out on "/") ----------
  if (session) {
    return (
      <SidebarLayout sidebarWidth={sidebarWidth}>
        <main
          style={{
            marginLeft: sidebarWidth,
            width: "100%",
            maxWidth: 720,
            padding: 24,
            margin: "0 auto",
          }}
        >
          <img
            src={banner}
            alt="PennyWize Banner"
            style={{ width: "100%", marginBottom: 24 }}
          />
          <div
            style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}
          >
            <h2 style={{ width: "100%", margin: 0, textAlign: "center" }}>
              Welcome, {session.user.email}!
            </h2>
            <button style={{ width: "100%", padding: "10px 0" }} onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </main>
      </SidebarLayout>
    );
  }

  // ---------- Logged-out view ----------
  return (
    <div style={{ display: "flex", height: "100vh", background: "#f1f3f5" }}>
      {/* Left: Login UI */}
      <div
        style={{
          flex: 2,
          background: "#fff",
          padding: 48,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
        }}
      >
        {/* Top-right About Link */}
        <Link
          to="/about"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            textDecoration: "none",
            backgroundColor: "#fff",
            padding: "6px 12px",
            borderRadius: 6,
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            color: "#333",
            fontWeight: "bold",
            fontSize: 14,
          }}
        >
          About PennyWize
        </Link>

        <img
          src={banner}
          alt="PennyWize Banner"
          style={{ width: "100%", maxWidth: 600, marginBottom: 32 }}
        />

        {/* Auth: ensure OAuth/magic link preserve `next` */}
        <div style={{ width: "100%", maxWidth: 400 }}>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={["google"]}
            onlyThirdPartyProviders
            redirectTo={authRedirect}
          />
          <EmailAuthWithCaptcha redirectTo={authRedirect} />
        </div>
      </div>

      {/* Right: Features */}
      <div
        style={{
          width: "fit-content",
          minWidth: 320,
          padding: 32,
          backgroundColor: "#f8f9fa",
          borderLeft: "1px solid #dee2e6",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          gap: 24,
        }}
      >
        <section>
          <h2 style={{ marginBottom: "0.75rem" }}>All Features Are Free</h2>
          <ul style={{ fontSize: "1rem", lineHeight: "1.8", paddingLeft: 16 }}>
            <li>🔐 Secure Google login</li>
            <li>📥 Update finances</li>
            <li>📈 View financial trends graph</li>
            <li>📅 View past financial entries</li>
            <li>📊 Visualize income & expenses</li>
            <li>💡 Detailed short-term, long-term, and goal-based AI suggestions</li>
            <li>🎯 Set/View savings goals</li>
            <li>📊 View progress against savings goals</li>
            <li>📤 Import and export financial history as CSV or PDF</li>
            <li>🧾 Edit or delete past financial entries</li>
            <li>📬 Weekly and monthly digest emails</li>
            <li>📎 Financial history attachments in digest emails</li>
            <li>🎨 Customize your Finance history view</li>
            <li>📤 Subscribe/unsubscribe from email digest</li>
            <li>👨‍💻 Submit feedback and bug reports</li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default HomePage;
