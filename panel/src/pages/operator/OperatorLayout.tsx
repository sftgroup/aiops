import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  Key,
  FileText,
  Settings,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Menu,
  X,
  CreditCard,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/operator/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/operator/tenants', icon: Building2, label: 'Tenants' },
  { to: '/operator/users', icon: Users, label: 'Users' },
  { to: '/operator/api-keys', icon: Key, label: 'API Keys' },
  { to: '/operator/crypto-orders', icon: CreditCard, label: 'Crypto Orders' },
];

const NAV_BOTTOM = [
  { to: '/operator/audit-logs', icon: FileText, label: 'Audit Log' },
  { to: '/operator/settings', icon: Settings, label: 'System Settings' },
];

function getPageTitle(pathname: string): string {
  const map: Record<string, string> = {
    '/operator/dashboard': 'Dashboard',
    '/operator/tenants': 'Tenants',
    '/operator/users': 'Users',
    '/operator/api-keys': 'API Keys',
    '/operator/crypto-orders': 'Crypto Orders',
    '/operator/audit-logs': 'Audit Log',
    '/operator/settings': 'System Settings',
  };
  return map[pathname] || 'Operator';
}

export default function OperatorLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const adminName = localStorage.getItem('operator_user')
    ? JSON.parse(localStorage.getItem('operator_user')!).name || 'Super Admin'
    : 'Super Admin';
  const adminEmail = localStorage.getItem('operator_user')
    ? JSON.parse(localStorage.getItem('operator_user')!).email || 'admin@aiops.cloud'
    : 'admin@aiops.cloud';

  const handleLogout = () => {
    localStorage.removeItem('operator_token');
    localStorage.removeItem('operator_user');
    navigate('/operator/login');
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`w-64 bg-[#1a1a2e] border-r border-[#2a2a3e] flex flex-col shrink-0 fixed lg:static inset-y-0 left-0 z-30 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-[#2a2a3e]">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#6366f1] to-purple-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold bg-gradient-to-r from-[#6366f1] to-purple-500 bg-clip-text text-transparent">
              AIOPS
            </span>
            <span className="text-[10px] text-gray-500 block -mt-0.5">Operator</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-[#6366f1]/10 text-[#6366f1] font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-[#252540]'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
          <div className="pt-3 mt-3 border-t border-[#2a2a3e]">
            {NAV_BOTTOM.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-[#6366f1]/10 text-[#6366f1] font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-[#252540]'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#2a2a3e]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366f1] to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {adminName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{adminName}</p>
              <p className="text-[10px] text-gray-500 truncate">{adminEmail}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 border-b border-[#2a2a3e] bg-[#0f0f1a]/80 backdrop-blur sticky top-0 z-10 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-gray-400 hover:text-white transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Operator</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-white font-medium">{getPageTitle(window.location.pathname)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-gray-600 bg-[#1a1a2e] border border-[#2a2a3e] px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              System Online
            </span>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366f1] to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {adminName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
