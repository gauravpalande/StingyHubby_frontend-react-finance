// src/pages/Dashboard.tsx
import React from 'react';
import bannerImage from '../assets/banner.jpg'; // adjust path

const Dashboard: React.FC = () => {
  return (
    <div style={{ textAlign: 'center' }}>
      <img
        src={bannerImage}
        alt="Banner"
        style={{ maxWidth: '100%', height: 'auto', borderRadius: '12px' }}
      />
    </div>
  );
};

export default Dashboard;
