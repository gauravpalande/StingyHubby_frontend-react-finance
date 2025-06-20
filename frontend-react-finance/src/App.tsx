// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useSession } from '@supabase/auth-helpers-react';
import SidebarLayout from './components/SidebarLayout';
import FinanceForm from './components/FinanceForm';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage'; // <-- add this import
import UpdateFinancesPage from './pages/UpdateFinancesPage'; // ✅ NEW
import FinanceBreakdownPage from './pages/FinanceBreakdownPage'; // ✅ NEW
import GPTSuggestionPage from './pages/GPTSuggestionPage'; // ✅ NEW
import EditableFinancialHistory from './components/EditableFinancialHistory';
import GoalSettings from './components/GoalSettings';


const App: React.FC = () => {
  const session = useSession();

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        {session && (
          <Route path="/app" element={<SidebarLayout />}>
            <Route path="update" element={<UpdateFinancesPage />} />
            <Route path="goals" element={<GoalSettings />} />
            <Route path="/app/history" element={<EditableFinancialHistory />} />
            <Route path="breakdown" element={<FinanceBreakdownPage />} />
            <Route path="suggestions" element={<GPTSuggestionPage/>} />
            <Route path="about" element={<AboutPage />} />
            <Route index element={<FinanceForm />} />
            {/* More routes inside app layout if needed */}
          </Route>
        )}
      </Routes>
    </Router>
  );
};

export default App;
