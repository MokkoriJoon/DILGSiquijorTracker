import React, { useState, useEffect } from 'react';
import { RefreshCw, Play, Calendar, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { SchedulerService } from '../services/scheduler';

export default function SchedulerPage() {
  const [stats, setStats] = useState({
    totalTemplates: 0,
    recurringTemplates: 0,
    totalInstances: 0,
    pendingInstances: 0,
    overdueInstances: 0,
  });
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ generated: number; errors: string[] } | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const data = await SchedulerService.getStats();
    setStats(data);
  }

  async function handleRunScheduler() {
    setLoading(true);
    const result = await SchedulerService.generateInstances();
    setLastResult(result);
    setLastRun(new Date().toLocaleString());
    await loadStats();
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Task Scheduler</h2>
          <p className="text-sm text-slate-500">Manage recurring task generation</p>
        </div>
        <button 
          onClick={handleRunScheduler}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-4 h-4" />
          {loading ? 'Running...' : 'Run Scheduler'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <RefreshCw className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-800">Scheduler Status</h3>
        </div>
        <p className="text-sm text-slate-600">
          The scheduler automatically generates task instances based on recurring templates.
          It creates instances for the next 30 days and marks overdue tasks automatically.
        </p>
        
        {lastRun && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs text-green-700">
              <strong>Last Run:</strong> {lastRun}
            </p>
            {lastResult && (
              <p className="text-xs text-green-700 mt-1">
                <strong>Generated:</strong> {lastResult.generated} instances
                {lastResult.errors.length > 0 && (
                  <span className="text-red-600"> | <strong>Errors:</strong> {lastResult.errors.length}</span>
                )}
              </p>
            )}
          </div>
        )}

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700">
            <strong>Daily Recurrence:</strong> Tasks with DAILY recurrence will generate instances based on selected days of the week.
            Missed tasks are automatically marked as OVERDUE but can still be submitted.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">{stats.totalInstances}</p>
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
              <p className="text-xl font-bold text-slate-800">{stats.pendingInstances}</p>
              <p className="text-xs text-slate-500">Pending Tasks</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">{stats.overdueInstances}</p>
              <p className="text-xs text-slate-500">Overdue</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Recurring Templates</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">Total Templates</p>
            <p className="text-2xl font-bold text-slate-800">{stats.totalTemplates}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">Recurring Templates</p>
            <p className="text-2xl font-bold text-slate-800">{stats.recurringTemplates}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
