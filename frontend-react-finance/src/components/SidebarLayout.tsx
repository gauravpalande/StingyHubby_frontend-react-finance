import React, { useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { FaHome, FaEdit, FaHistory, FaChartPie, FaRobot, FaInfoCircle, FaBullseye, FaCog, FaBug } from 'react-icons/fa';
import { useSession } from '@supabase/auth-helpers-react';

interface SidebarLayoutProps {
  children?: ReactNode;
  sidebarWidth?: number;
}

const navItems = [
  { to: '/', icon: <FaHome />, label: 'Home' },
  { to: '/app/update', icon: <FaEdit />, label: 'Update Finance' },
  { to: '/app/goals', icon: <FaBullseye />, label: 'Set Goals' },
  { to: '/app/history', icon: <FaHistory />, label: 'Financial History' },
  { to: '/app/breakdown', icon: <FaChartPie />, label: 'Expense Breakdown' },
  { to: '/app/suggestions', icon: <FaRobot />, label: 'GPT Suggestions' },
  { to: '/app/preferences', icon: <FaCog />, label: 'Preferences' }, // Add this
  { to: '/app/feedback', icon: <FaBug />, label: 'Submit Feedback' },
  { to: '/app/about', icon: <FaInfoCircle />, label: 'About' },
];

const collapsedWidth = 60;
const expandedWidth = 200;

const SidebarLayout: React.FC<SidebarLayoutProps> = ({ children }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleToggle = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  const session = useSession();
  const user = session?.user;
  const name = user?.user_metadata?.full_name || user?.email;
  const avatar = user?.user_metadata?.avatar_url;

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
            <span
              style={{
                display: expandedIndex === idx ? 'inline' : 'none',
                whiteSpace: 'nowrap',
                transition: 'opacity 0.2s',
                opacity: expandedIndex === idx ? 1 : 0,
              }}
            >
              {item.label}
            </span>
          </NavLink>
        ))}

        {user && (
          <div
            style={{
              marginTop: 'auto',
              padding: '8px',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: expandedIndex !== null ? 'flex-start' : 'center',
              gap: 10,
              borderTop: '1px solid #ccc',
            }}
          >
            {avatar && (
              <img
                src={avatar}
                alt={name}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  objectFit: 'cover',
                }}
              />
            )}
            {expandedIndex !== null && (
              <span
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {name}
              </span>
            )}
          </div>
        )}
      </nav>

      <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        {children ?? <Outlet />}
      </main>
    </div>
  );
};

export default SidebarLayout;
