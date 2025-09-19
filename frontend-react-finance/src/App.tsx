import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useSession } from '@supabase/auth-helpers-react';
import SidebarLayout from './components/SidebarLayout';
import FinanceForm from './components/FinanceForm';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import UpdateFinancesPage from './pages/UpdateFinancesPage';
import FinanceBreakdownPage from './pages/FinanceBreakdownPage';
import GPTSuggestionPage from './pages/GPTSuggestionPage';
import EditableFinancialHistory from './components/EditableFinancialHistory';
import GoalSettings from './components/GoalSettings';
import PreferencesPage from './pages/PreferencesPage';
import FeedbackForm from './components/FeedbackForm';

const App: React.FC = () => {
  const session = useSession();

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} /> {/* ✅ Public About Page */}

        {/* Authenticated App Routes */}
        {session && (
          <Route path="/app" element={<SidebarLayout />}>
            <Route index element={<FinanceForm />} />
            <Route path="update" element={<UpdateFinancesPage />} />
            <Route path="goals" element={<GoalSettings />} />
            <Route path="history" element={<EditableFinancialHistory />} />
            <Route path="breakdown" element={<FinanceBreakdownPage />} />
            <Route path="suggestions" element={<GPTSuggestionPage />} />
            <Route path="preferences" element={<PreferencesPage />} />
            <Route path="feedback" element={<FeedbackForm />} />
            <Route path="about" element={<AboutPage />} /> {/* ✅ Still available inside sidebar if needed */}
          </Route>
        )}
      </Routes>
    </Router>
  );
};

export default App;
