import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
    const { token } = useAuth();
    if (!token) {
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
