import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import adminContext from './adminContext';

const RequireAdminAuth = ({ children }) => {
  const { loading, isAdminAuthed } = useContext(adminContext);
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="text-light">正在校验管理员身份...</div>
      </div>
    );
  }

  if (!isAdminAuthed) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default RequireAdminAuth;
