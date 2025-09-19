import React, { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  FaHome,
  FaEdit,
  FaHistory,
  FaChartPie,
  FaRobot,
  FaInfoCircle,
  FaBullseye,
  FaCog,
  FaBug,
} from 'react-icons/fa';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';

interface SidebarLayoutProps {
  children?: ReactNode;
  sidebarWidth?: number;
}

const navItems = [
  { to: '/', icon: <FaHome size={20} />, label: 'Home' },
  { to: '/app/update', icon: <FaEdit size={20} />, label: 'Update Finance' },
  { to: '/app/goals', icon: <FaBullseye size={20} />, label: 'Set Goals' },
  { to: '/app/history', icon: <FaHistory size={20} />, label: 'Financial History' },
  { to: '/app/breakdown', icon: <FaChartPie size={20} />, label: 'Expense Breakdown' },
  { to: '/app/suggestions', icon: <FaRobot size={20} />, label: 'GPT Suggestions' },
  { to: '/app/preferences', icon: <FaCog size={20} />, label: 'Preferences' },
  { to: '/app/feedback', icon: <FaBug size={20} />, label: 'Submit Feedback', paidOnly: true },
  { to: '/app/about', icon: <FaInfoCircle size={20} />, label: 'About' },
];

const collapsedWidth = 60;
const expandedWidth = 200;

const SidebarLayout: React.FC<SidebarLayoutProps> = ({ children }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isPaid, setIsPaid] = useState(false);

  const supabase = useSupabaseClient();
  const session = useSession();
  const user = session?.user;
  const name = user?.user_metadata?.full_name || user?.email;
  const avatar = user?.user_metadata?.avatar_url;

  useEffect(() => {
    const fetchPaidStatus = async () => {
      if (!user) {
        setIsPaid(false);
        return;
      }
      const { data, error } = await supabase
        .from('users')
        .select('paid_user')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching paid status:', error.message);
        setIsPaid(false);
      } else {
        setIsPaid(!!data?.paid_user);
      }
    };

    fetchPaidStatus();
  }, [user, supabase]);

  const handleToggle = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  const visibleNavItems = navItems.filter((item) => {
    if (item.paidOnly && !isPaid) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <nav
        style={{
          width: expandedIndex !== null ? expandedWidth : collapsedWidth,
          background: '#f8f9fa',
          padding: '16px 8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transition: 'width 0.2s',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <span
            style={{
              fontWeight: 'bold',
              fontSize: 24,
              display: expandedIndex !== null ? 'inline' : 'none',
            }}
          >
            PennyWize
          </span>
          <span style={{ display: expandedIndex === null ? 'inline' : 'none' }}>💰</span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            width: '100%',
            alignItems: 'center',
          }}
        >
          {visibleNavItems.map((item, idx) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: isActive ? 'bold' : 'normal',
                color: isActive ? '#007bff' : 'black',
                textDecoration: 'none',
                width: '100%',
                padding: '8px 0',
                borderRadius: 8,
                background: expandedIndex === idx ? '#e9ecef' : 'transparent',
                cursor: 'pointer',
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
                  fontSize: 12,
                  marginTop: 4,
                  display: expandedIndex === idx ? 'block' : 'none',
                  textAlign: 'center',
                }}
              >
                {item.label}
              </span>
            </NavLink>
          ))}
        </div>

        {user && (
          <div
            style={{
              marginTop: 'auto',
              padding: '8px',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              borderTop: '1px solid #ccc',
              flexDirection: 'column',
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
                  textAlign: 'center',
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
