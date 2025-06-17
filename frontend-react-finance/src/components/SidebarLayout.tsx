import React from 'react';
import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

// You can use any icon library. Here, we'll use react-icons for demonstration.
import { FaHome, FaEdit, FaHistory, FaChartPie, FaRobot, FaInfoCircle } from 'react-icons/fa';

interface SidebarLayoutProps {
  children?: ReactNode;
  sidebarWidth?: number;
}

const SidebarLayout: React.FC<SidebarLayoutProps> = ({ children, sidebarWidth = 200 }) => {
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <nav style={{
        width: sidebarWidth,
        background: '#f8f9fa',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <h3>StingyHubby</h3>
        <NavLink to="/" style={({ isActive }) => ({
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: isActive ? 'bold' : 'normal',
          color: isActive ? '#007bff' : 'black',
          textDecoration: 'none'
        })}>
          <FaHome /> Home
        </NavLink>
        <NavLink to="/app/update" style={({ isActive }) => ({
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: isActive ? 'bold' : 'normal',
          color: isActive ? '#007bff' : 'black',
          textDecoration: 'none'
        })}>
          <FaEdit /> Update Finance
        </NavLink>
        <NavLink to="/app/history" style={({ isActive }) => ({
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: isActive ? 'bold' : 'normal',
          color: isActive ? '#007bff' : 'black',
          textDecoration: 'none'
        })}>
          <FaHistory /> Financial History
        </NavLink>
        <NavLink to="/app/breakdown" style={({ isActive }) => ({
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: isActive ? 'bold' : 'normal',
          color: isActive ? '#007bff' : 'black',
          textDecoration: 'none'
        })}>
          <FaChartPie /> Expense Breakdown
        </NavLink>
        <NavLink to="/app/suggestions" style={({ isActive }) => ({
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: isActive ? 'bold' : 'normal',
          color: isActive ? '#007bff' : 'black',
          textDecoration: 'none'
        })}>
          <FaRobot /> GPT Suggestions
        </NavLink>
        <NavLink to="/app/about" style={({ isActive }) => ({
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: isActive ? 'bold' : 'normal',
          color: isActive ? '#007bff' : 'black',
          textDecoration: 'none'
        })}>
          <FaInfoCircle /> About
        </NavLink>
      </nav>

      <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        {children ?? <Outlet />}
      </main>
    </div>
  );
};

export default SidebarLayout;
