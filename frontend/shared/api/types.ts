/**
 * Tipi condivisi per l'API
 */

// User types
export interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'priest' | 'user';
    createdAt: string;
    updatedAt: string;
}

// Auth types
export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    token: string;
    user: User;
}

// API Response wrapper
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

// Pagination
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
