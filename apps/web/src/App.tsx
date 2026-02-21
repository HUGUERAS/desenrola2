/**
 * App.tsx — Router mínimo para SPA
 * Apenas 4 rotas: /, /login, /signup, /app
 */
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { supabase } from './lib/supabase';
import apiClient from './services/api';
import AppShell from './pages/AppShell';
import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import SignUp from './pages/auth/SignUp';

function App() {
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.access_token) apiClient.setToken(session.access_token);
        });
    }, []);

    return (
        <BrowserRouter>
            <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />

                {/* SPA — requires auth */}
                <Route path="/app" element={<AppShell />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster richColors position="top-center" />
        </BrowserRouter>
    );
}

export default App;
