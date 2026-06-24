import React, { createContext, useState, useContext, useEffect } from 'react';
import * as api from '../services/api';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [user, setUser] = useState<string | null>(localStorage.getItem('user'));
    const [role, setRole] = useState<string | null>(localStorage.getItem('role'));

    const login = async (email: string, password: string) => {
        try {
            const data = await api.login(email, password);
            setToken(data.token);
            setUser(data.name);
            setRole(data.role);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', data.name);
            localStorage.setItem('role', data.role);
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const loginWithGoogle = async (idToken: string) => {
        try {
            const data = await api.loginWithGoogle(idToken);
            setToken(data.token);
            setUser(data.name);
            setRole(data.role);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', data.name);
            localStorage.setItem('role', data.role);
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const register = async (name: string, email: string, password: string) => {
        try {
            await api.register(name, email, password);
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        setToken(null);
        setUser(null);
        setRole(null);
    };

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
