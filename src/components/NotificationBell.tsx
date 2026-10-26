import { useState, useEffect } from 'react';
import { Bell, Check, Trash2, Calendar, AlertCircle, Clock, CheckCircle2, RefreshCw } from 'lucide-react';
import { NotificationService, Notification, NotificationType } from '../services/notification';
import { useAuth } from '../context/AuthContext';

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotifications();
      // Refresh notifications every 30 seconds
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  async function loadNotifications() {
    if (!user) return;
    
    const [notifData, count] = await Promise.all([
      NotificationService.getUserNotifications(user.id),
      NotificationService.getUnreadCount(user.id),
    ]);

    setNotifications(notifData);
    setUnreadCount(count);
  }

  async function handleMarkAsRead(notificationId: string) {
    const success = await NotificationService.markAsRead(notificationId);
    if (success) {
      await loadNotifications();
    }
  }

  async function handleMarkAllAsRead() {
    if (!user) return;
    
    setLoading(true);
    const success = await NotificationService.markAllAsRead(user.id);
    if (success) {
      await loadNotifications();
    }
    setLoading(false);
  }

  async function handleDelete(notificationId: string) {
    const success = await NotificationService.deleteNotification(notificationId);
    if (success) {
      await loadNotifications();
    }
  }

  async function handleDeleteAll() {
    if (!user) return;
    
    if (!confirm('Are you sure you want to delete all notifications? This cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    const result = await NotificationService.deleteAllNotifications(user.id);
    if (result.success) {
      await loadNotifications();
    }
    setLoading(false);
  }

  function getNotificationIcon(type: NotificationType) {
    switch (type) {
      case 'reminder_3days':
        return <Calendar className="w-5 h-5 text-blue-500" />;
      case 'reminder_1day':
        return <Clock className="w-5 h-5 text-orange-500" />;
      case 'overdue':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'recurrence_generated':
        return <RefreshCw className="w-5 h-5 text-green-500" />;
      case 'task_assigned':
        return <CheckCircle2 className="w-5 h-5 text-purple-500" />;
      case 'task_completed':
        return <Check className="w-5 h-5 text-emerald-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  }

  function getNotificationColor(type: NotificationType) {
    switch (type) {
      case 'reminder_3days':
        return 'bg-blue-50 border-blue-200';
      case 'reminder_1day':
        return 'bg-orange-50 border-orange-200';
      case 'overdue':
        return 'bg-red-50 border-red-200';
      case 'recurrence_generated':
        return 'bg-green-50 border-green-200';
      case 'task_assigned':
        return 'bg-purple-50 border-purple-200';
      case 'task_completed':
        return 'bg-emerald-50 border-emerald-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  if (!user) return null;

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      disabled={loading}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                    >
                      {loading ? 'Marking...' : 'Mark all as read'}
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={handleDeleteAll}
                      disabled={loading}
                      className="text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete all
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 hover:bg-slate-50 transition-colors ${
                        !notification.read ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border ${getNotificationColor(notification.type)}`}>
                          {getNotificationIcon(notification.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${!notification.read ? 'text-slate-900' : 'text-slate-700'}`}>
                                {notification.title}
                              </p>
                              <p className="text-xs text-slate-600 mt-0.5">
                                {notification.message}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDelete(notification.id)}
                              className="flex-shrink-0 p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                              title="Delete notification"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-slate-500">
                              {formatDate(notification.createdAt)}
                            </span>
                            {!notification.read && (
                              <button
                                onClick={() => handleMarkAsRead(notification.id)}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                              >
                                Mark as read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2 border-t border-slate-200 bg-slate-50">
                <p className="text-xs text-slate-500 text-center">
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
