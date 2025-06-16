// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useSession } from '@supabase/auth-helpers-react';
import SidebarLayout from './components/SidebarLayout';
import FinanceForm from './components/FinanceForm';
import AboutPage from './pages/AboutPage'; // create this page
import AuthSection from './components/AuthSection'; // wrap auth UI here

const App: React.FC = () => {
  const session = useSession();

  if (!session) {
    return <AuthSection />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<SidebarLayout />}>
          <Route index element={<FinanceForm />} />
          <Route path="about" element={<AboutPage />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
