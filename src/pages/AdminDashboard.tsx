import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { DatabaseService } from '../services/database';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import {
  CheckCircle2, Clock, AlertTriangle, ClipboardList, Calendar,
  ArrowUpRight, Zap, RotateCcw
} from 'lucide-react';
import type { TaskInstance, TaskStatus } from '../types';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'stats' | 'kanban'>('stats');
  const [dashboardScope, setDashboardScope] = useState<'all' | 'my'>('my'); // Default to 'my' for logged-in users
  const [stats, setStats] = useState({
    total: 0, completed: 0, pending: 0, overdue: 0, completionRate: 0
  });
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [dashboardScope, user]);

  async function loadData() {
    setLoading(true);
    setStatusFilter(null); // Reset filter when changing scope
    
    let instancesData: TaskInstance[];
    
    if (dashboardScope === 'my' && user) {
      instancesData = await DatabaseService.getInstancesByUser(user.id);
    } else {
      instancesData = await DatabaseService.getInstances();
    }
    
    // Calculate stats with merged categories
    const total = instancesData.length;
    const completed = instancesData.filter(i => i.status === 'COMPLETED').length;
    const pending = instancesData.filter(i => i.status === 'PENDING' || i.status === 'IN_PROGRESS' || i.status === 'SUBMITTED').length;
    const overdue = instancesData.filter(i => i.status === 'OVERDUE').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    setStats({ total, completed, pending, overdue, completionRate });
    setInstances(instancesData);
    setLoading(false);
  }

  const handleStatClick = (status: string) => {
    setStatusFilter(status);
    setViewMode('kanban');
  };

  const handleResetDatabase = () => {
    if (confirm('⚠️ This will DELETE ALL data. Are you sure?')) {
      alert('To reset data, go to Supabase Dashboard → Table Editor and delete all rows.');
    }
  };

  const kanbanColumns: { status: TaskStatus; label: string; color: string; bgColor: string }[] = [
    { status: 'PENDING', label: 'Pending', color: 'text-slate-600', bgColor: 'bg-slate-100' },
    { status: 'COMPLETED', label: 'Completed', color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
    { status: 'OVERDUE', label: 'Overdue', color: 'text-red-600', bgColor: 'bg-red-100' },
  ];

  const statCards = [
    { label: 'Total Tasks', value: stats.total, icon: ClipboardList, change: '+12%', color: 'from-blue-500 to-blue-600', status: null },
    { label: 'Completed', value: stats.completed, icon: CheckCircle2, change: '+8%', color: 'from-emerald-500 to-emerald-600', status: 'COMPLETED' },
    { label: 'Pending', value: stats.pending, icon: Clock, change: '+3%', color: 'from-amber-500 to-amber-600', status: 'PENDING' },
    { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, change: '-2%', color: 'from-red-500 to-red-600', status: 'OVERDUE' },
  ];

  // Build department chart data
  const departmentChartData = () => {
    const deptMap: Record<string, { total: number; completed: number }> = {};
    
    instances.forEach((inst) => {
      const dept = inst.assignee?.department || 'Unknown';
      if (!deptMap[dept]) deptMap[dept] = { total: 0, completed: 0 };
      deptMap[dept].total++;
      if (inst.status === 'COMPLETED') deptMap[dept].completed++;
    });

    return Object.entries(deptMap).map(([name, data]) => ({
      name: name.replace('Regional Office - ', '').replace('Municipality of ', ''),
      completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Welcome back, {user?.name?.split(' ')[0]}!</h1>
            <p className="text-blue-100 text-sm mt-1">
              {dashboardScope === 'all' 
                ? "Here's what's happening across DILG Siquijor today."
                : "Here are your assigned tasks."}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Dashboard Scope Toggle - Only for Admins and Super Admins */}
            {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
              <div className="flex gap-1 bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => setDashboardScope('all')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    dashboardScope === 'all' ? 'bg-white text-blue-700' : 'text-white hover:bg-white/20'
                  }`}
                >
                  All Tasks
                </button>
                <button
                  onClick={() => setDashboardScope('my')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    dashboardScope === 'my' ? 'bg-white text-blue-700' : 'text-white hover:bg-white/20'
                  }`}
                >
                  My Tasks
                </button>
              </div>
            )}
            {user?.role === 'SUPER_ADMIN' && (
              <button
                onClick={handleResetDatabase}
                className="inline-flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-100 text-sm font-medium rounded-lg transition-all border border-red-400/30"
                title="Reset all data"
              >
                <RotateCcw className="w-4 h-4" />
                Reset DB
              </button>
            )}
            <button
              onClick={() => setViewMode('stats')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'stats' ? 'bg-white text-blue-700' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Statistics
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'kanban' ? 'bg-white text-blue-700' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Kanban Board
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div 
            key={stat.label} 
            onClick={() => stat.status && handleStatClick(stat.status)}
            className={`bg-white rounded-xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all ${
              stat.status ? 'cursor-pointer hover:border-blue-300' : ''
            } ${statusFilter === stat.status ? 'ring-2 ring-blue-500 border-blue-300' : ''}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUpRight className={`w-3 h-3 ${stat.change.startsWith('+') ? 'text-emerald-500' : 'text-red-500'}`} />
                  <span className={`text-xs font-medium ${stat.change.startsWith('+') ? 'text-emerald-600' : 'text-red-600'}`}>
                    {stat.change}
                  </span>
                  {stat.status && <span className="text-xs text-blue-500 ml-1">Click to filter</span>}
                </div>
              </div>
              <div className={`w-10 h-10 bg-gradient-to-br ${stat.color} rounded-lg flex items-center justify-center shadow-sm`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {viewMode === 'stats' ? (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Completion Rate */}
            <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Completion Overview</h3>
              <div className="h-56 flex items-center justify-center">
                <div className="text-center">
                  <div className="relative w-32 h-32 mx-auto">
                    <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="50" stroke="#e2e8f0" strokeWidth="10" fill="none" />
                      <circle
                        cx="60" cy="60" r="50"
                        stroke="#10b981"
                        strokeWidth="10"
                        fill="none"
                        strokeDasharray={`${stats.completionRate * 3.14} ${314 - stats.completionRate * 3.14}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-slate-800">{stats.completionRate}%</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 mt-3">Overall Completion Rate</p>
                  <p className="text-xs text-slate-400">{stats.completed} of {stats.total} tasks completed</p>
                </div>
              </div>
            </div>

            {/* Department Performance */}
            <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Department Completion Rates</h3>
              <div className="h-56">
                {departmentChartData().length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentChartData()} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" domain={[0, 100]} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" width={100} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                      <Bar dataKey="completionRate" fill="#1e40af" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                    No data yet. Create tasks to see department performance.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status Breakdown & Overdue Tasks */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Status Breakdown</h3>
              <div className="space-y-3">
                {[
                  { label: 'Pending', count: stats.pending, color: 'bg-slate-400' },
                  { label: 'Completed', count: stats.completed, color: 'bg-emerald-500' },
                  { label: 'Overdue', count: stats.overdue, color: 'bg-red-500' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-600">{item.label}</span>
                      <span className="text-xs font-bold text-slate-700">{item.count}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`${item.color} rounded-full h-2 transition-all duration-500`}
                        style={{ width: `${stats.total > 0 ? (item.count / stats.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-800">Overdue & At Risk Tasks</h3>
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                  {stats.overdue} overdue
                </span>
              </div>
              <div className="space-y-2">
                {instances
                  .filter(t => t.status === 'OVERDUE' || t.status === 'PENDING')
                  .slice(0, 5)
                  .map((task) => (
                    <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                      <div className={`w-2 h-2 rounded-full ${task.status === 'OVERDUE' ? 'bg-red-500' : 'bg-amber-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{task.template?.title}</p>
                        <p className="text-xs text-slate-500">{task.assignee?.name} • {task.assignee?.department}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-slate-600">Due: {task.dueDate}</p>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          task.status === 'OVERDUE' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {task.status}
                        </span>
                      </div>
                    </div>
                  ))}
                {instances.filter(t => t.status === 'OVERDUE' || t.status === 'PENDING').length === 0 && (
                  <div className="text-center py-6">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">All tasks are on track!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Kanban Board */
        <div className="overflow-x-auto">
          {statusFilter && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-slate-600">Filtered by:</span>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                {statusFilter}
              </span>
              <button
                onClick={() => setStatusFilter(null)}
                className="text-sm text-slate-500 hover:text-slate-700 underline"
              >
                Clear filter
              </button>
            </div>
          )}
          <div className="flex gap-4 min-w-max pb-4">
            {kanbanColumns
              .filter(column => !statusFilter || column.status === statusFilter)
              .map((column) => {
                const tasks = instances.filter(t => {
                  // Merge IN_PROGRESS and SUBMITTED into PENDING for display
                  if (column.status === 'PENDING') {
                    return t.status === 'PENDING' || t.status === 'IN_PROGRESS' || t.status === 'SUBMITTED';
                  }
                  return t.status === column.status;
                });
                return (
                  <div key={column.status} className="w-72 flex-shrink-0">
                    <div className={`${column.bgColor} rounded-t-xl px-4 py-3 flex items-center justify-between`}>
                      <h3 className={`text-sm font-bold ${column.color}`}>{column.label}</h3>
                      <span className={`text-xs font-bold ${column.color} bg-white/70 px-2 py-0.5 rounded-full`}>
                        {tasks.length}
                      </span>
                    </div>
                  <div className="bg-slate-50 rounded-b-xl p-3 space-y-3 min-h-[200px]">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-white rounded-lg p-3 shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="text-xs font-semibold text-slate-800 leading-tight">{task.template?.title}</h4>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                            task.template?.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                            task.template?.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                            task.template?.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {task.template?.priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-[9px] font-bold text-blue-700">{task.assignee?.name?.charAt(0)}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 truncate">{task.assignee?.name}</span>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {task.dueDate}
                          </span>
                          <span className="text-[10px] text-slate-400">{task.template?.category}</span>
                        </div>
                      </div>
                    ))}
                    {tasks.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        No tasks
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
