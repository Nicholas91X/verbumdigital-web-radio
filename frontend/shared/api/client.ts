/**
 * API Client - Fetch wrapper per le chiamate al backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface RequestOptions extends RequestInit {
    params?: Record<string, string>;
}

/**
 * Fetch wrapper con gestione automatica di headers e errori
 */
export async function apiClient<T>(
    endpoint: string,
    options: RequestOptions = {}
): Promise<T> {
    const { params, ...fetchOptions } = options;

    // Build URL with query params
    const url = new URL(`${API_BASE_URL}${endpoint}`);
    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });
    }

    // Add default headers
    const headers = new Headers(fetchOptions.headers);
    if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(url.toString(), {
        ...fetchOptions,
        headers,
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

// Convenience methods
export const api = {
    get: <T>(endpoint: string, params?: Record<string, string>) =>
        apiClient<T>(endpoint, { method: 'GET', params }),

    post: <T>(endpoint: string, data: unknown) =>
        apiClient<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),

    put: <T>(endpoint: string, data: unknown) =>
        apiClient<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) }),

    delete: <T>(endpoint: string) =>
        apiClient<T>(endpoint, { method: 'DELETE' }),
};
