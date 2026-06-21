import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ContentPage from './pages/ContentPage';
import PublishPage from './pages/PublishPage';
import AccountsPage from './pages/AccountsPage';
import SettingsPage from './pages/SettingsPage';
import VideoPage from './pages/VideoPage';
import TeamWorkflowPage from './pages/TeamWorkflowPage';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-dark-bg text-gray-400">加载中...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a2e', color: '#fff', border: '1px solid #2a2a3e' } }} />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><ErrorBoundary><Layout /></ErrorBoundary></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="videos" element={<VideoPage />} />
            <Route path="content" element={<ContentPage />} />
            <Route path="publish" element={<PublishPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="teams" element={<TeamWorkflowPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
