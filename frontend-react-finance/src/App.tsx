import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useSession } from "@supabase/auth-helpers-react";

import SidebarLayout from "./components/SidebarLayout";
import FinanceForm from "./components/FinanceForm";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import UpdateFinancesPage from "./pages/UpdateFinancesPage";
import FinancialDashboardPage from "./pages/FinancialDashboardPage";
import EditableFinancialHistory from "./components/EditableFinancialHistory";
import PreferencesPage from "./pages/PreferencesPage";
import FeedbackForm from "./components/FeedbackForm";
import AuthCallback from "./pages/AuthCallback";

/** Guard: redirect to home with ?next=... when not signed in */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const location = useLocation();

  if (!session) {
    // Redirect to Home (or your Login page) and preserve the intended URL
    return (
      <Navigate
        to={`/?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
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
          <Route path="dashboard" element={<FinancialDashboardPage />} />
          <Route path="update" element={<UpdateFinancesPage />} />
          <Route path="history" element={<EditableFinancialHistory />} />
          <Route path="breakdown" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="suggestions" element={<Navigate to="/app/dashboard" replace />} />
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
