import React from 'react';
import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

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
        gap: '12px'
      }}>
        <h3>StingyHubby</h3>
        <NavLink to="/" style={({ isActive }) => ({
          fontWeight: isActive ? 'bold' : 'normal',
          color: isActive ? '#007bff' : 'black'
        })}>
          🏠 Home
        </NavLink>
        <NavLink to="/app/update" style={({ isActive }) => ({
          fontWeight: isActive ? 'bold' : 'normal',
          color: isActive ? '#007bff' : 'black'
        })}>
          Update Finance
        </NavLink>
        <NavLink to="/app/history" style={({ isActive }) => ({
          fontWeight: isActive ? 'bold' : 'normal',
          color: isActive ? '#007bff' : 'black'
        })}>
          Financial History
        </NavLink>
        <NavLink to="/app/breakdown" style={({ isActive }) => ({
          fontWeight: isActive ? 'bold' : 'normal',
          color: isActive ? '#007bff' : 'black'
        })}>
          Expense Breakdown
        </NavLink>
        <NavLink to="/app/suggestions" style={({ isActive }) => ({
          fontWeight: isActive ? 'bold' : 'normal',
          color: isActive ? '#007bff' : 'black'
        })}>
          GPT Suggestions
        </NavLink>
        <NavLink to="/app/about" style={({ isActive }) => ({
          fontWeight: isActive ? 'bold' : 'normal',
          color: isActive ? '#007bff' : 'black'
        })}>
          📘 About
        </NavLink>
      </nav>

      <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        {children ?? <Outlet />}
      </main>
    </div>
  );
};

export default SidebarLayout;
