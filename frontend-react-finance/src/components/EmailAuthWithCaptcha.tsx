// src/components/EmailAuthWithCaptcha.tsx
import React, { useState, useRef } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { useSupabaseClient } from "@supabase/auth-helpers-react";

interface EmailAuthWithCaptchaProps {
  /** e.g. https://pennywize.vercel.app/auth/callback?next=/app/preferences */
  redirectTo: string;
}

const EmailAuthWithCaptcha: React.FC<EmailAuthWithCaptchaProps> = ({ redirectTo }) => {
  const supabase = useSupabaseClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState<false | "signup" | "signin" | "magic">(
    false
  );

  const resetCaptcha = () => {
    setCaptchaToken(null);
    captchaRef.current?.resetCaptcha();
  };

  // SIGN UP (supports emailRedirectTo)
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) return alert("Please complete the CAPTCHA.");
    setIsLoading("signup");
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        captchaToken,       // ✅ allowed
        emailRedirectTo: redirectTo, // ✅ allowed for signUp
      },
    });

    setIsLoading(false);
    if (error) setMessage(error.message);
    else setMessage("✅ Check your email to confirm your sign-up.");
  };

  // SIGN IN (PASSWORD) — does NOT support emailRedirectTo in options
  const handleSignInPassword = async () => {
    if (!captchaToken) return alert("Please complete the CAPTCHA.");
    setIsLoading("signin");
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {
        captchaToken, // ✅ allowed
        // ❌ emailRedirectTo is NOT supported here
      },
    });

    setIsLoading(false);
    if (error) setMessage(error.message);
    else {
      setMessage("✅ Signed in!");
      // Optional: you can redirect immediately:
      // window.location.assign(new URLSearchParams(window.location.search).get("next") || "/app");
      // Or rely on your HomePage effect to navigate using ?next=
    }
  };

  // MAGIC LINK (PASSWORDLESS) — supports emailRedirectTo
  const handleSendMagicLink = async () => {
    if (!captchaToken) return alert("Please complete the CAPTCHA.");
    setIsLoading("magic");
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        captchaToken,             // ✅ allowed
        emailRedirectTo: redirectTo, // ✅ critical for preserving `next`
      },
    });

    setIsLoading(false);
    if (error) setMessage(error.message);
    else setMessage("📬 Check your email for your magic sign-in link.");
  };

  return (
    <form
      onSubmit={handleSignUp}
      style={{
        display: "grid",
        gap: 12,
        background: "#fff",
        borderRadius: 8,
        padding: 16,
        boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
      }}
    >
      <h3 style={{ margin: 0, textAlign: "center", fontWeight: 700 }}>
        Email Login
      </h3>

      <input
        type="email"
        placeholder="Email"
        value={email}
        required
        onChange={(e) => setEmail(e.target.value)}
        style={{ padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        required
        onChange={(e) => setPassword(e.target.value)}
        style={{ padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
      />

      <HCaptcha
        sitekey="2c02d91c-a64a-4124-85b0-d1cc928898e4" // replace with your own sitekey
        onVerify={setCaptchaToken}
        ref={captchaRef}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={!!isLoading}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: 4,
            border: "none",
            background: "#4CAF50",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {isLoading === "signup" ? "Sending..." : "Sign Up"}
        </button>

        <button
          type="button"
          onClick={handleSignInPassword}
          disabled={!!isLoading}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: 4,
            border: "none",
            background: "#007bff",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {isLoading === "signin" ? "Signing in..." : "Sign In"}
        </button>
      </div>

      <button
        type="button"
        onClick={handleSendMagicLink}
        disabled={!!isLoading}
        style={{
          padding: "8px 0",
          borderRadius: 4,
          border: "1px solid #007bff",
          background: "#fff",
          color: "#007bff",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {isLoading === "magic" ? "Sending..." : "Email me a magic link"}
      </button>

      {message && (
        <p
          style={{
            margin: "8px 0 0",
            textAlign: "center",
            color: message.startsWith("✅") ? "green" : "#333",
          }}
        >
          {message}
        </p>
      )}

      <button
        type="button"
        onClick={resetCaptcha}
        style={{
          marginTop: 4,
          fontSize: 12,
          background: "none",
          border: "none",
          color: "#555",
          textDecoration: "underline",
          cursor: "pointer",
        }}
      >
        Reset CAPTCHA
      </button>
    </form>
  );
};

export default EmailAuthWithCaptcha;
