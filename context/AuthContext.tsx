import React, { createContext, useState, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import * as api from '../services/api';
import { clearLiveDeviceState } from '../hooks/useFermenters';

interface AuthContextType {
    token: string | null;
    user: string | null;
    role: string | null;
    login: (email: string, pass: string) => Promise<boolean>;
    loginWithGoogle: (idToken: string) => Promise<boolean>;
    logout: () => void;
    register: (name: string, email: string, pass: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getCleanStorage = (key: string): string | null => {
    const val = localStorage.getItem(key);
    return val && val !== 'undefined' && val !== 'null' ? val : null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const queryClient = useQueryClient();
    const [token, setToken] = useState<string | null>(() => getCleanStorage('token'));
    const [user, setUser] = useState<string | null>(() => getCleanStorage('user'));
    const [role, setRole] = useState<string | null>(() => getCleanStorage('role'));

    const login = async (email: string, password: string) => {
        try {
            const data = await api.login(email, password);
            if (!data?.token) throw new Error('Token inválido recebido do servidor');
            const safeName = data.name || 'Usuário';
            const safeRole = data.role || 'user';
            setToken(data.token);
            setUser(safeName);
            setRole(safeRole);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', safeName);
            localStorage.setItem('role', safeRole);
            return true;
        } catch (err: any) {
            console.error(err);
            toast.error(err?.message || 'E-mail ou senha inválidos');
            return false;
        }
    };

    const loginWithGoogle = async (idToken: string) => {
        try {
            const data = await api.loginWithGoogle(idToken);
            if (!data?.token) throw new Error('Token inválido recebido do servidor');
            const safeName = data.name || 'Usuário';
            const safeRole = data.role || 'user';
            setToken(data.token);
            setUser(safeName);
            setRole(safeRole);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', safeName);
            localStorage.setItem('role', safeRole);
            return true;
        } catch (err: any) {
            console.error(err);
            toast.error(err?.message || 'Falha no login com Google');
            return false;
        }
    };

    const register = async (name: string, email: string, password: string) => {
        try {
            await api.register(name, email, password);
            return true;
        } catch (err: any) {
            console.error(err);
            toast.error(err?.message || 'Erro ao criar conta');
            return false;
        }
    };

    const logout = () => {
        clearLiveDeviceState();
        queryClient.clear();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        setToken(null);
        setUser(null);
        setRole(null);
    };

    React.useEffect(() => {
        const handleUnauthorized = () => {
            if (localStorage.getItem('token')) {
                logout();
                toast.error('Sessão expirada. Faça login novamente.');
            }
        };
        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, []);

    return (
        <AuthContext.Provider value={{ token, user, role, login, loginWithGoogle, logout, register }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
