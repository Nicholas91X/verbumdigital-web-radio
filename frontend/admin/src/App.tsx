import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import Layout from '@/components/Layout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import ChurchesPage from '@/pages/ChurchesPage';
import MachinesPage from '@/pages/MachinesPage';
import PriestsPage from '@/pages/PriestsPage';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
    const { user, isLoading } = useAuth();
    if (isLoading) return <div className="min-h-screen flex items-center justify-center">Caricamento...</div>;
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />

                    <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/churches" element={<ChurchesPage />} />
                        <Route path="/machines" element={<MachinesPage />} />
                        <Route path="/priests" element={<PriestsPage />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}
