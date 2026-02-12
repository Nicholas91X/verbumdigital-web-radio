import type { ApiError } from './types';

// ============================================
// CONFIGURATION
// ============================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api/v1';

// ============================================
// TOKEN MANAGEMENT
// ============================================

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function setAuth(token: string, user: object): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser<T = object>(): T | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

export function clearAuth(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
    return !!getToken();
}

// ============================================
// API CLIENT (Backend on Hetzner)
// ============================================

class ApiClient {
    private baseURL: string;

    constructor(baseURL: string) {
        this.baseURL = baseURL;
    }

    private async request<T>(
        method: string,
        path: string,
        body?: object,
        requireAuth = true
    ): Promise<T> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (requireAuth) {
            const token = getToken();
            if (!token) {
                throw new Error('Not authenticated');
            }
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${this.baseURL}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        // Handle 401 — auto logout
        if (response.status === 401) {
            clearAuth();
            window.location.href = '/login';
            throw new Error('Session expired');
        }

        const data = await response.json();

        if (!response.ok) {
            const error = data as ApiError;
            throw new Error(error.error || `Request failed: ${response.status}`);
        }

        return data as T;
    }

    get<T>(path: string, requireAuth = true): Promise<T> {
        return this.request<T>('GET', path, undefined, requireAuth);
    }

    post<T>(path: string, body?: object, requireAuth = true): Promise<T> {
        return this.request<T>('POST', path, body, requireAuth);
    }

    put<T>(path: string, body?: object, requireAuth = true): Promise<T> {
        return this.request<T>('PUT', path, body, requireAuth);
    }

    delete<T>(path: string, requireAuth = true): Promise<T> {
        return this.request<T>('DELETE', path, undefined, requireAuth);
    }
}

export const api = new ApiClient(API_BASE_URL);