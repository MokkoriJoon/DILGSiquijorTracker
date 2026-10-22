import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Notification, NotificationService } from '../services/notifications';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  toasts: Toast[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  deleteNotification: (id: string) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  refreshNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children, userId }: { children: ReactNode; userId?: string }) {
  const [notifications, setNotifications] = useState<Notification[]>(
    NotificationService.getAll(userId)
  );
  const [toasts, setToasts] = useState<Toast[]>([]);

  const refreshNotifications = useCallback(() => {
    setNotifications(NotificationService.getAll(userId));
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    NotificationService.markAsRead(id);
    refreshNotifications();
  };

  const markAllAsRead = () => {
    NotificationService.markAllAsRead(userId);
    refreshNotifications();
  };

  const clearAll = () => {
    NotificationService.clearAll(userId);
    refreshNotifications();
  };

  const deleteNotification = (id: string) => {
    NotificationService.delete(id);
    refreshNotifications();
  };

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID();
    const newToast = { ...toast, id };
    setToasts(prev => [...prev, newToast]);
    
    const duration = toast.duration || 4000;
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        toasts,
        markAsRead,
        markAllAsRead,
        clearAll,
        deleteNotification,
        addToast,
        removeToast,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
