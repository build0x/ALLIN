import React from 'react';

const Overlay = ({ children }) => {
  return <>{children(() => {})}</>;
};

export default Overlay;
