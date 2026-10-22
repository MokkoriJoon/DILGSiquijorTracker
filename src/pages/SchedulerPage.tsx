import React, { useState, useEffect } from 'react';
import {
  RefreshCw, Play, Eye, Calendar, Clock, CheckCircle2,
  AlertTriangle, Zap, Settings, Mail, Bell
} from 'lucide-react';
import { runScheduler, previewScheduler } from '../services/scheduler';
import { InstanceService } from '../services/database';
import { NotificationService, EmailConfigService, EmailConfig } from '../services/notifications';
import { useNotifications } from '../context/NotificationContext';

export default function SchedulerPage() {
  const [preview, setPreview] = useState<Array<{
    templateTitle: string;
    recurrence: string;
    nextDueDate: string;
    assignees: string[];
  }>>([]);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    generated: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [emailConfig, setEmailConfig] = useState<EmailConfig>(EmailConfigService.get());
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const { addToast, refreshNotifications } = useNotifications();
  const stats = InstanceService.getStats();

  useEffect(() => {
    loadPreview();
    const savedLastRun = localStorage.getItem('dilg_scheduler_last_run');
    if (savedLastRun) setLastRun(savedLastRun);
  }, []);

  const loadPreview = () => {
    const data = previewScheduler();
    setPreview(data);
  };

  const handleRunScheduler = async () => {
    setIsRunning(true);
    
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const result = runScheduler();
    setLastResult({
      generated: result.generated,
      skipped: result.skipped,
      errors: result.errors,
    });
    
    const now = new Date().toISOString();
    setLastRun(now);
    localStorage.setItem('dilg_scheduler_last_run', now);
    
    // Create notification
    NotificationService.notifySchedulerRun(result.generated, result.errors.length);
    refreshNotifications();
    
    // Show toast
    if (result.generated > 0) {
      addToast({
        type: 'success',
        title: 'Scheduler Complete',
        message: `Generated ${result.generated} new task instances`,
      });
    } else {
      addToast({
        type: 'info',
        title: 'Scheduler Complete',
        message: 'No new instances needed at this time',
      });
    }
    
    setIsRunning(false);
    loadPreview();
  };

  const handleSaveEmailConfig = () => {
    EmailConfigService.update(emailConfig);
    addToast({
      type: 'success',
      title: 'Settings Saved',
      message: 'Email notification preferences updated',
    });
    setShowEmailConfig(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Task Scheduler</h2>
          <p className="text-sm text-slate-500">Manage recurring task generation and notification settings</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEmailConfig(!showEmailConfig)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Email Settings
          </button>
          <button
            onClick={handleRunScheduler}
            disabled={isRunning}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            {isRunning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isRunning ? 'Running...' : 'Run Scheduler'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">{stats.total}</p>
              <p className="text-xs text-slate-500">Total Instances</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">{stats.completionRate}%</p>
              <p className="text-xs text-slate-500">Completion Rate</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">{stats.pending + stats.inProgress}</p>
              <p className="text-xs text-slate-500">Active Tasks</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">{stats.overdue}</p>
              <p className="text-xs text-slate-500">Overdue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Email Config Panel */}
      {showEmailConfig && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-800">Email Notification Settings</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={emailConfig.enabled}
                onChange={(e) => setEmailConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <div>
                <p className="text-sm font-medium text-slate-700">Enable Email Notifications</p>
                <p className="text-xs text-slate-500">Send emails for task events</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={emailConfig.overdueAlert}
                onChange={(e) => setEmailConfig(prev => ({ ...prev, overdueAlert: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <div>
                <p className="text-sm font-medium text-slate-700">Overdue Alerts</p>
                <p className="text-xs text-slate-500">Notify when tasks become overdue</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={emailConfig.completionAlert}
                onChange={(e) => setEmailConfig(prev => ({ ...prev, completionAlert: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <div>
                <p className="text-sm font-medium text-slate-700">Completion Alerts</p>
                <p className="text-xs text-slate-500">Notify admins when tasks are completed</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={emailConfig.dailyDigest}
                onChange={(e) => setEmailConfig(prev => ({ ...prev, dailyDigest: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <div>
                <p className="text-sm font-medium text-slate-700">Daily Digest</p>
                <p className="text-xs text-slate-500">Send daily summary email</p>
              </div>
            </label>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reminder Days Before Deadline
              </label>
              <input
                type="number"
                min="1"
                max="14"
                value={emailConfig.reminderDays}
                onChange={(e) => setEmailConfig(prev => ({ ...prev, reminderDays: parseInt(e.target.value) || 3 }))}
                className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-500 ml-2">days before deadline</span>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSaveEmailConfig}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Last Run Result */}
      {lastResult && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <Zap className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-800">Last Scheduler Run</h3>
            {lastRun && (
              <span className="text-xs text-slate-500">
                {new Date(lastRun).toLocaleString()}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <p className="text-2xl font-bold text-emerald-700">{lastResult.generated}</p>
              <p className="text-xs text-emerald-600">Generated</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-slate-700">{lastResult.skipped}</p>
              <p className="text-xs text-slate-500">Skipped</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-700">{lastResult.errors.length}</p>
              <p className="text-xs text-red-600">Errors</p>
            </div>
          </div>
        </div>
      )}

      {/* Scheduler Preview */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <Eye className="w-5 h-5 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800">Upcoming Task Generation Preview</h3>
          <span className="text-xs text-slate-500">Next 30 days</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Template</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Recurrence</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Next Due Date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Assignees</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {preview.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <p className="text-sm font-medium text-slate-800">{item.templateTitle}</p>
                  </td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                      {item.recurrence}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm text-slate-600">{item.nextDueDate}</span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-wrap gap-1">
                      {item.assignees.map((name, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                          {name}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {preview.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                    No recurring templates found. Create a recurring task template first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Bell className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-800">How the Scheduler Works</h4>
            <ul className="text-xs text-blue-700 mt-2 space-y-1">
              <li>• The scheduler generates new task instances from recurring templates</li>
              <li>• It looks ahead 30 days to create upcoming instances</li>
              <li>• Tasks past their due date are automatically marked as overdue</li>
              <li>• In production, this runs automatically via a cron job (daily at midnight)</li>
              <li>• Email notifications are sent based on your configured preferences</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
