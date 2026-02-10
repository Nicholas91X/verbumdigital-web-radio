import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, setAuth, clearAuth, getToken, getUser } from '@shared/api/client';
import type { AuthResponse, LoginRequest, RegisterRequest } from '@shared/api/types';

interface AuthUser {
    id: number;
    name?: string;
    email: string;
    role: string;
}

interface AuthContextType {
    user: AuthUser | null;
    isLoading: boolean;
    login: (credentials: LoginRequest) => Promise<void>;
    register: (details: RegisterRequest) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const token = getToken();
        const savedUser = getUser<AuthUser>();
        if (token && savedUser) {
            setUser(savedUser);
        }
        setIsLoading(false);
    }, []);

    const login = useCallback(async (credentials: LoginRequest) => {
        const data = await api.post<AuthResponse>('/auth/user/login', credentials, false);
        const authUser: AuthUser = {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role: data.user.role,
        };
        setAuth(data.token, authUser);
        setUser(authUser);
    }, []);

    const register = useCallback(async (details: RegisterRequest) => {
        const data = await api.post<AuthResponse>('/auth/user/register', details, false);
        const authUser: AuthUser = {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role: data.user.role,
        };
        setAuth(data.token, authUser);
        setUser(authUser);
    }, []);

    const logout = useCallback(() => {
        clearAuth();
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
