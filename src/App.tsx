import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Layout from './components/Layout';
import PublicDashboard from './pages/PublicDashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import TaskManagement from './pages/TaskManagement';
import UserManagement from './pages/UserManagement';
import MyTasks from './pages/MyTasks';
import SchedulerPage from './pages/SchedulerPage';
import Profile from './pages/Profile';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return (
    <NotificationProvider userId={user.id}>
      <Layout>{children}</Layout>
    </NotificationProvider>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<PublicDashboard />} />
      <Route path="/login" element={
        user ? <Navigate to="/dashboard" replace /> : <Login />
      } />
      <Route path="/register" element={
        user ? <Navigate to="/dashboard" replace /> : <Register />
      } />
      
      {/* Protected routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/tasks" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <TaskManagement />
        </ProtectedRoute>
      } />
      <Route path="/users" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <UserManagement />
        </ProtectedRoute>
      } />
      <Route path="/scheduler" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <SchedulerPage />
        </ProtectedRoute>
      } />
      <Route path="/my-tasks" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'STANDARD']}>
          <MyTasks />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      } />
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
