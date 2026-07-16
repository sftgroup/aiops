import { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './AuthContext';
import { ToastProvider } from './hooks/useToast';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ContentPage from './pages/ContentPage';
import PipelinePage from './pages/PipelinePage';
import PublishPage from './pages/PublishPage';
import AccountsPage from './pages/AccountsPage';
import TeamWorkflowPage from './pages/TeamWorkflowPage';
import VideoPage from './pages/VideoPage';
import TtsPage from './pages/TtsPage';
import SettingsPage from './pages/SettingsPage';
import AgentBuilderPage from './pages/AgentBuilderPage';
import MarketplacePage from './pages/MarketplacePage';
import NotFoundPage from './pages/NotFoundPage';

// ── Operator pages ──
import OperatorLoginPage from './pages/operator/OperatorLoginPage';
import OperatorLayout from './pages/operator/OperatorLayout';
import OperatorDashboard from './pages/operator/OperatorDashboard';
import OperatorTenants from './pages/operator/OperatorTenants';
import OperatorUsers from './pages/operator/OperatorUsers';
import OperatorApiKeys from './pages/operator/OperatorApiKeys';
import OperatorAuditLogs from './pages/operator/OperatorAuditLogs';
import OperatorSettings from './pages/operator/OperatorSettings';
import CryptoOrdersPage from './pages/operator/CryptoOrdersPage';

// ═══ Auth gate: redirect to /login if not authenticated ═══
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// ═══ Protected layout wrapper ═══
function ProtectedLayout({ element }: { element: React.ReactNode }) {
  return (
    <AuthGate>
      <Layout>{element}</Layout>
    </AuthGate>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          {/* ── Public routes ── */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* ── Protected routes ── */}
          <Route path="/dashboard" element={<ProtectedLayout element={<DashboardPage />} />} />
          <Route path="/content" element={<ProtectedLayout element={<ContentPage />} />} />
          <Route path="/pipeline" element={<ProtectedLayout element={<PipelinePage />} />} />
          <Route path="/publish" element={<ProtectedLayout element={<PublishPage />} />} />
          <Route path="/accounts" element={<ProtectedLayout element={<AccountsPage />} />} />
          <Route path="/team" element={<ProtectedLayout element={<TeamWorkflowPage />} />} />
          <Route path="/videos" element={<ProtectedLayout element={<VideoPage />} />} />
          <Route path="/voice" element={<ProtectedLayout element={<TtsPage />} />} />
          <Route path="/settings" element={<ProtectedLayout element={<SettingsPage />} />} />
          <Route path="/settings/*" element={<ProtectedLayout element={<SettingsPage />} />} />
          <Route path="/agents" element={<ProtectedLayout element={<AgentBuilderPage />} />} />
          <Route path="/marketplace" element={<ProtectedLayout element={<MarketplacePage />} />} />

          {/* ── Operator routes ── */}
          <Route path="/operator/login" element={<OperatorLoginPage />} />
          <Route path="/operator" element={<OperatorLayout />}>
            <Route path="dashboard" element={<OperatorDashboard />} />
            <Route path="tenants" element={<OperatorTenants />} />
            <Route path="users" element={<OperatorUsers />} />
            <Route path="api-keys" element={<OperatorApiKeys />} />
            <Route path="audit-logs" element={<OperatorAuditLogs />} />
            <Route path="settings" element={<OperatorSettings />} />
            <Route path="crypto-orders" element={<CryptoOrdersPage />} />
          </Route>

          {/* ── 404 ── */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
