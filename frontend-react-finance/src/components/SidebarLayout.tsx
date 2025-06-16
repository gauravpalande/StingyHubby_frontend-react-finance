// src/components/SidebarLayout.tsx
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const SidebarLayout: React.FC = () => {
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <nav style={{
        width: 200,
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
          💰 Finance Form
        </NavLink>
        <NavLink to="/about" style={({ isActive }) => ({
          fontWeight: isActive ? 'bold' : 'normal',
          color: isActive ? '#007bff' : 'black'
        })}>
          📘 About
        </NavLink>
        {/* Add more links here */}
      </nav>

      <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default SidebarLayout;
