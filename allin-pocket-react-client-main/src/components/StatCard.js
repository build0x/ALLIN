import React from 'react';

const StatCard = ({ number, text, width = '12rem' }) => {
  return (
    <div
      className="card p-3 text-center allin-stat-card"
      style={{
        width: width,
        minHeight: '116px',
      }}
    >
      <div
        style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          color: '#d4af37',
        }}
      >
        {number}
      </div>
      <div
        style={{
          fontSize: '13px',
          color: '#f5f5f5',
        }}
      >
        {text}
      </div>
    </div>
  );
};

export default StatCard;
