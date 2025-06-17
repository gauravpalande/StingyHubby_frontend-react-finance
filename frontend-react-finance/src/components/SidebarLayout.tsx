import React, { useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { FaHome, FaEdit, FaHistory, FaChartPie, FaRobot, FaInfoCircle } from 'react-icons/fa';

interface SidebarLayoutProps {
  children?: ReactNode;
  sidebarWidth?: number;
}

const navItems = [
  { to: '/', icon: <FaHome />, label: 'Home' },
  { to: '/app/update', icon: <FaEdit />, label: 'Update Finance' },
  { to: '/app/history', icon: <FaHistory />, label: 'Financial History' },
  { to: '/app/breakdown', icon: <FaChartPie />, label: 'Expense Breakdown' },
  { to: '/app/suggestions', icon: <FaRobot />, label: 'GPT Suggestions' },
  { to: '/app/about', icon: <FaInfoCircle />, label: 'About' },
];

const collapsedWidth = 60;
const expandedWidth = 200;

const SidebarLayout: React.FC<SidebarLayoutProps> = ({ children }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // For touch/click toggle
  const handleToggle = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <nav
        style={{
          width: expandedIndex !== null ? expandedWidth : collapsedWidth,
          background: '#f8f9fa',
          padding: '16px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          alignItems: 'center',
          transition: 'width 0.2s',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <span style={{ fontWeight: 'bold', fontSize: 24, display: expandedIndex !== null ? 'inline' : 'none' }}>
            StingyHubby
          </span>
          <span style={{ display: expandedIndex === null ? 'inline' : 'none' }}>
            💰
          </span>
        </div>
        {navItems.map((item, idx) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontWeight: isActive ? 'bold' : 'normal',
              color: isActive ? '#007bff' : 'black',
              textDecoration: 'none',
              width: '100%',
              justifyContent: expandedIndex === idx ? 'flex-start' : 'center',
              padding: '8px',
              borderRadius: 8,
              background: expandedIndex === idx ? '#e9ecef' : 'transparent',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s',
            })}
            onMouseEnter={() => setExpandedIndex(idx)}
            onMouseLeave={() => setExpandedIndex(null)}
            onClick={() => handleToggle(idx)}
            onTouchStart={() => handleToggle(idx)}
          >
            {item.icon}
            <span style={{
              display: expandedIndex === idx ? 'inline' : 'none',
              whiteSpace: 'nowrap',
              transition: 'opacity 0.2s',
              opacity: expandedIndex === idx ? 1 : 0,
            }}>
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>
      <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        {children ?? <Outlet />}
      </main>
    </div>
  );
};

export default SidebarLayout;
