import React, { ReactNode, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

// Home de vendas para quem chega em "/" sem login (carregada so nesse caso)
const Landing = React.lazy(() => import('./Landing'));
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
    const { token } = useAuth();
    const location = useLocation();
    if (!token) {
        const pairing = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('pair');
        if (location.pathname === '/' && !pairing) {
            return <Suspense fallback={<div className="min-h-screen bg-[#EEEFF1]" />}><Landing /></Suspense>;
        }
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const pairCode = params.get('pair');
            if (pairCode && pairCode.trim()) {
                try {
                    sessionStorage.setItem('breww_pending_pair', pairCode.trim());
                    const confirm = params.get('code');
                    if (confirm) sessionStorage.setItem('breww_pending_pair_code', confirm.trim());
                } catch {}
            }
        }
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
};

export const PublicRoute = ({ children }: { children: ReactNode }) => {
    const { token } = useAuth();
    if (token) return <Navigate to="/" replace />;
    return <>{children}</>;
};

export const AdminRoute = ({ children }: { children: ReactNode }) => {
    const { token, role } = useAuth();
    if (!token) return <Navigate to="/login" replace />;
    if (role !== 'admin') return <Navigate to="/" replace />;
    return <>{children}</>;
};
