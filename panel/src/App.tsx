import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './AuthContext';
import { ToastProvider } from './hooks/useToast';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ContentPage from './pages/ContentPage';
import AccountsPage from './pages/AccountsPage';
import SettingsPage from './pages/SettingsPage';
import VideoPage from './pages/VideoPage';
import TeamWorkflowPage from './pages/TeamWorkflowPage';
import Layout from './components/Layout';
import ErrorBoundary, { PageError } from './components/ErrorBoundary';
import KeyboardShortcutsHelp from './components/KeyboardShortcutsHelp';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-dark-bg text-gray-400">加载中...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function GlobalShortcuts({ children }: { children: React.ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);

  const handleCloseModals = useCallback(() => {
    // Dispatch a custom event that any modal can listen for
    window.dispatchEvent(new CustomEvent('close-modal'));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) || target.isContentEditable) return;

      const key = e.key.toLowerCase();

      // ? or Shift+/ => open help panel
      if (key === '?' || (key === '/' && e.shiftKey)) {
        e.preventDefault();
        setHelpOpen((prev) => !prev);
        return;
      }

      // ESC => close modals (pages handle their own ESC for page-specific modals)
      if (key === 'escape') {
        handleCloseModals();
        return;
      }

      // Ctrl/Cmd+K => focus search input on any page
      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>('[data-search-input]');
        el?.focus();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleCloseModals]);

  return (
    <>
      {children}
      <KeyboardShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a2e', color: '#fff', border: '1px solid #2a2a3e' } }} />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><GlobalShortcuts><ErrorBoundary><Layout /></ErrorBoundary></GlobalShortcuts></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="videos" element={<ErrorBoundary fallback={
                <PageError title="视频页面出错了" message="视频制作功能遇到意外错误，请返回重试" />
              }><VideoPage /></ErrorBoundary>} />
              <Route path="content" element={<ErrorBoundary fallback={
                <PageError title="内容创作页面出错了" message="内容创作功能遇到意外错误，请返回重试" />
              }><ContentPage /></ErrorBoundary>} />
              <Route path="accounts" element={<AccountsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="team-workflow" element={<Navigate to="/teams" replace />} />
              <Route path="teams" element={<TeamWorkflowPage />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
