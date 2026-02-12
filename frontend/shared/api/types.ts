// ============================================
// MODELS (matching Go structs)
// ============================================

export interface Machine {
    id: number;
    machine_id: string;
    activated: boolean;
    activation_code?: string;
    activated_at?: string;
    created_at: string;
    updated_at: string;
    church?: Church;
}

export interface Church {
    id: number;
    machine_id?: number;
    name: string;
    logo_url?: string;
    address?: string;
    streaming_active: boolean;
    current_session_id?: number;
    created_at: string;
    updated_at: string;
    machine?: Machine;
    streaming_credential?: StreamingCredential;
    current_session?: StreamingSession;
    priests?: Priest[];
}

export interface StreamingCredential {
    id: number;
    church_id: number;
    stream_id: string;
    stream_key: string;
    created_at: string;
    updated_at: string;
}

export interface Priest {
    id: number;
    name: string;
    email: string;
    created_at: string;
    updated_at: string;
    churches?: PriestChurch[];
}

export interface PriestChurch {
    priest_id: number;
    church_id: number;
    church?: Church;
}

export interface User {
    id: number;
    name: string;
    email: string;
    created_at: string;
    updated_at: string;
}

export interface UserSubscription {
    id: number;
    user_id: number;
    church_id: number;
    notifications_enabled: boolean;
    created_at: string;
    updated_at: string;
    church?: Church;
}

export interface Admin {
    id: number;
    username: string;
    email: string;
    created_at: string;
}

export interface PushSubscription {
    id: number;
    user_id: number;
    endpoint: string;
    p256dh: string;
    auth: string;
    created_at: string;
}

export interface StreamingSession {
    id: number;
    church_id: number;
    started_by_priest_id?: number;
    started_at: string;
    ended_at?: string;
    duration_seconds?: number;
    recording_url?: string;
    max_listener_count: number;
    created_at: string;
    church?: Church;
    priest?: Priest;
}

// ============================================
// AUTH
// ============================================

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    name: string;
    email: string;
    password: string;
}

export interface AuthResponse {
    token: string;
    user: {
        id: number;
        name?: string;
        username?: string;
        email: string;
        role: 'admin' | 'priest' | 'user';
    };
}

// ============================================
// API RESPONSES
// ============================================

export interface ApiError {
    error: string;
}

export interface StreamStatus {
    church_id: number;
    church_name: string;
    streaming_active: boolean;
    session?: {
        id: number;
        started_at: string;
    };
}

export interface ChurchListResponse {
    churches: Church[];
}

export interface SessionListResponse {
    sessions: StreamingSession[];
}

export interface SubscriptionEntry {
    subscription_id: number;
    church_id: number;
    church_name: string;
    church_logo_url?: string;
    streaming_active: boolean;
    notifications_enabled: boolean;
    subscribed_at: string;
}

export interface SubscriptionListResponse {
    subscriptions: SubscriptionEntry[];
}

export interface StreamURLResponse {
    church_id: number;
    church_name: string;
    streaming_active: boolean;
    stream_url: string;
    started_at?: string;
}