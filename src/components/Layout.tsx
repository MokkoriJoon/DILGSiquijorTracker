import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from './NotificationBell';
import ToastContainer from './ToastContainer';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  LogOut,
  Menu,
  X,
  Shield,
  Building2,
  ChevronRight,
  RefreshCw,
  Folder,
  Link as LinkIcon,
  Settings,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Role-based navigation
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = user?.role === 'ADMIN';
  const canManageUsers = isSuperAdmin; // Only Super Admin can manage users
  const canManageTasks = isSuperAdmin || isAdmin; // Both can manage tasks

  const navItems = canManageUsers
    ? [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/my-tasks', label: 'My Tasks', icon: ClipboardList },
        { path: '/categories', label: 'Task Categories', icon: Folder },
        { path: '/resource-links', label: 'Resource Links', icon: LinkIcon },
        { path: '/tasks', label: 'Task Management', icon: ClipboardList },
        { path: '/users', label: 'User Management', icon: Users },
        { path: '/scheduler', label: 'Scheduler', icon: RefreshCw },
        ...(isSuperAdmin ? [
          { path: '/scheduler-debug', label: 'Scheduler Debug', icon: RefreshCw },
          { path: '/site-settings', label: 'Site Settings', icon: Settings }
        ] : []),
        { path: '/profile', label: 'My Profile', icon: Shield },
      ]
    : canManageTasks
    ? [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/my-tasks', label: 'My Tasks', icon: ClipboardList },
        { path: '/categories', label: 'Task Categories', icon: Folder },
        { path: '/resource-links', label: 'Resource Links', icon: LinkIcon },
        { path: '/tasks', label: 'Task Management', icon: ClipboardList },
        { path: '/profile', label: 'My Profile', icon: Shield },
      ]
    : [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/my-tasks', label: 'My Tasks', icon: ClipboardList },
        { path: '/categories', label: 'Task Categories', icon: Folder },
        { path: '/resource-links', label: 'Resource Links', icon: LinkIcon },
        { path: '/profile', label: 'My Profile', icon: Shield },
      ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-blue-900 to-blue-950 text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-blue-800">
          <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight">D.E.N.N.I.S.</h1>
            <p className="text-[10px] text-blue-300 leading-tight">Digital Ecosystem</p>
          </div>
          <button
            className="lg:hidden ml-auto text-blue-300 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="mt-6 px-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-800 text-white shadow-lg shadow-blue-900/50'
                    : 'text-blue-200 hover:bg-blue-800/50 hover:text-white'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-blue-800">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 bg-blue-700 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold">{user?.name?.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-blue-300 truncate">{user?.department}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-blue-300 hover:text-white transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2 px-3">
            <Shield className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold">
              {user?.role} Access
            </span>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-4 lg:px-8 py-4 flex items-center gap-4 sticky top-0 z-30">
          <button
            className="lg:hidden text-slate-600 hover:text-slate-900"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-800">
              {navItems.find(i => i.path === location.pathname)?.label || 'Dashboard'}
            </h2>
            <p className="text-xs text-slate-500">
              DILG Region NIR • Siquijor Province
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 ml-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>Connected</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}
