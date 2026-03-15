import React from 'react';

const NavButton = ({ children, ...rest }) => {
  return (
    <button
      className="btn btn-sm align-middle allin-nav-btn"
      type="button"
      style={{ marginRight: '5px' }}
      {...rest}
    >
      {children}
    </button>
  );
};

export default NavButton;
