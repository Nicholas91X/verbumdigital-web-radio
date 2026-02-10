import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, setAuth, clearAuth, getToken, getUser } from '@shared/api/client';
import type { AuthResponse, LoginRequest } from '@shared/api/types';

interface AuthUser {
    id: number;
    username?: string;
    email: string;
    role: string;
}

interface AuthContextType {
    user: AuthUser | null;
    isLoading: boolean;
    login: (credentials: LoginRequest) => Promise<void>;
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
        const data = await api.post<AuthResponse>('/auth/admin/login', credentials, false);
        const authUser: AuthUser = {
            id: data.user.id,
            username: data.user.username,
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
        <AuthContext.Provider value={{ user, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}