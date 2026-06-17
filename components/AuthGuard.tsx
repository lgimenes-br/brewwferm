import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
    const { token } = useAuth();
    if (!token) return <Navigate to="/login" replace />;
    return <>{children}</>;
};

export const PublicRoute = ({ children }: { children: ReactNode }) => {
    const { token } = useAuth();
    if (token) return <Navigate to="/" replace />;
    return <>{children}</>;
};
