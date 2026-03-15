import React from 'react';

const GameIcon = ({ game }) => {
  const getAltText = (game) => {
    switch (game) {
      case 'HOLDEM':
        return '德州扑克';
      case 'FIVE_CARD_DRAW':
        return '五张换牌';
      case 'BOTTLE_SPIN':
        return '转瓶子';
      default:
        return '游戏';
    }
  };

  return (
    <span
      aria-label={getAltText(game)}
      title={getAltText(game)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
        marginRight: '8px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #f5d978 0%, #d4af37 50%, #8f6b14 100%)',
        color: '#0d0d0d',
        fontSize: '14px',
        fontWeight: 'bold',
        boxShadow: '0 0 12px rgba(212, 175, 55, 0.35)',
      }}
    >
      ♠
    </span>
  );
};

export default GameIcon;
