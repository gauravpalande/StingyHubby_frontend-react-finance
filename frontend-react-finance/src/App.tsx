import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useSession } from "@supabase/auth-helpers-react";

import SidebarLayout from "./components/SidebarLayout";
import FinanceForm from "./components/FinanceForm";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import UpdateFinancesPage from "./pages/UpdateFinancesPage";
import FinanceBreakdownPage from "./pages/FinanceBreakdownPage";
import GPTSuggestionPage from "./pages/GPTSuggestionPage";
import EditableFinancialHistory from "./components/EditableFinancialHistory";
import GoalSettings from "./components/GoalSettings";
import PreferencesPage from "./pages/PreferencesPage";
import FeedbackForm from "./components/FeedbackForm";
import AuthCallback from "./pages/AuthCallback";

/** Guard: show a helpful screen if not signed in (prevents blank page) */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const location = useLocation();

  // While session is null at first render, auth-helpers usually updates quickly.
  // If you prefer a spinner while checking, you could render one here.
  if (!session) {
    // Option A: send them to home/login, but remember where they wanted to go
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h3>Sign in required</h3>
        <p>You need to sign in to view this page.</p>
        <p>
          <a href={`/?next=${encodeURIComponent(location.pathname + location.search)}`}>
            Go to sign in
          </a>
        </p>
      </div>
    );

    // Option B (redirect):
    // return <Navigate to={`/?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  return <>{children}</>;
}

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* ---------- Public Routes ---------- */}
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />

        {/* Magic link callback MUST be top-level */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* ---------- Protected App Routes ---------- */}
        <Route
          path="/app"
          element={
            <RequireAuth>
              <SidebarLayout />
            </RequireAuth>
          }
        >
          <Route index element={<FinanceForm />} />
          <Route path="update" element={<UpdateFinancesPage />} />
          <Route path="goals" element={<GoalSettings />} />
          <Route path="history" element={<EditableFinancialHistory />} />
          <Route path="breakdown" element={<FinanceBreakdownPage />} />
          <Route path="suggestions" element={<GPTSuggestionPage />} />
          <Route path="preferences" element={<PreferencesPage />} />
          <Route path="feedback" element={<FeedbackForm />} />
          <Route path="about" element={<AboutPage />} />
        </Route>

        {/* Optional: catch-all to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
