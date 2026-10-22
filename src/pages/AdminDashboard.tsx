import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  CheckCircle2, Clock, AlertTriangle, TrendingUp, Users,
  ClipboardList, Calendar, ArrowUpRight, Filter, Search
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { mockTaskInstances, departmentStats, monthlyCompletionData, categoryData } from '../data/mockData';
import { TaskStatus } from '../types';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'stats' | 'kanban'>('stats');

  const totalTasks = mockTaskInstances.length;
  const completedTasks = mockTaskInstances.filter(t => t.status === 'COMPLETED').length;
  const inProgressTasks = mockTaskInstances.filter(t => t.status === 'IN_PROGRESS').length;
  const pendingTasks = mockTaskInstances.filter(t => t.status === 'PENDING').length;
  const submittedTasks = mockTaskInstances.filter(t => t.status === 'SUBMITTED').length;
  const overdueTasks = mockTaskInstances.filter(t => t.status === 'OVERDUE').length;
  const completionRate = Math.round((completedTasks / totalTasks) * 100);

  const kanbanColumns: { status: TaskStatus; label: string; color: string; bgColor: string }[] = [
    { status: 'PENDING', label: 'Pending', color: 'text-slate-600', bgColor: 'bg-slate-100' },
    { status: 'IN_PROGRESS', label: 'In Progress', color: 'text-blue-600', bgColor: 'bg-blue-100' },
    { status: 'SUBMITTED', label: 'Submitted', color: 'text-purple-600', bgColor: 'bg-purple-100' },
    { status: 'COMPLETED', label: 'Completed', color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
    { status: 'OVERDUE', label: 'Overdue', color: 'text-red-600', bgColor: 'bg-red-100' },
  ];

  const stats = [
    { label: 'Total Tasks', value: totalTasks, icon: ClipboardList, change: '+12%', color: 'from-blue-500 to-blue-600' },
    { label: 'Completed', value: completedTasks, icon: CheckCircle2, change: '+8%', color: 'from-emerald-500 to-emerald-600' },
    { label: 'In Progress', value: inProgressTasks, icon: Clock, change: '+3%', color: 'from-amber-500 to-amber-600' },
    { label: 'Overdue', value: overdueTasks, icon: AlertTriangle, change: '-2%', color: 'from-red-500 to-red-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Welcome back, {user?.name?.split(' ')[0]}!</h1>
            <p className="text-blue-100 text-sm mt-1">
              Here's what's happening across all departments today.
            </p>
          </div>
          <div className="flex gap-2">
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
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUpRight className={`w-3 h-3 ${stat.change.startsWith('+') ? 'text-emerald-500' : 'text-red-500'}`} />
                  <span className={`text-xs font-medium ${stat.change.startsWith('+') ? 'text-emerald-600' : 'text-red-600'}`}>
                    {stat.change}
                  </span>
                  <span className="text-xs text-slate-400">vs last month</span>
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
            {/* Completion Trend */}
            <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Monthly Task Completion</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyCompletionData}>
                    <defs>
                      <linearGradient id="colorComp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="completed" stroke="#10b981" fill="url(#colorComp)" name="Completed" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Department Performance */}
            <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Department Completion Rates</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" width={120} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                    <Bar dataKey="completionRate" fill="#1e40af" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Task Status Breakdown & Overdue Tasks */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Status Breakdown */}
            <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Status Breakdown</h3>
              <div className="space-y-3">
                {[
                  { label: 'Pending', count: pendingTasks, color: 'bg-slate-400', total: totalTasks },
                  { label: 'In Progress', count: inProgressTasks, color: 'bg-blue-500', total: totalTasks },
                  { label: 'Submitted', count: submittedTasks, color: 'bg-purple-500', total: totalTasks },
                  { label: 'Completed', count: completedTasks, color: 'bg-emerald-500', total: totalTasks },
                  { label: 'Overdue', count: overdueTasks, color: 'bg-red-500', total: totalTasks },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-600">{item.label}</span>
                      <span className="text-xs font-bold text-slate-700">{item.count}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`${item.color} rounded-full h-2 transition-all duration-500`}
                        style={{ width: `${(item.count / item.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Overdue Tasks */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-800">Overdue & At Risk Tasks</h3>
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                  {overdueTasks} overdue
                </span>
              </div>
              <div className="space-y-2">
                {mockTaskInstances
                  .filter(t => t.status === 'OVERDUE' || t.status === 'PENDING')
                  .slice(0, 5)
                  .map((task) => (
                    <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                      <div className={`w-2 h-2 rounded-full ${task.status === 'OVERDUE' ? 'bg-red-500' : 'bg-amber-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{task.template.title}</p>
                        <p className="text-xs text-slate-500">{task.assignee.name} • {task.assignee.department}</p>
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
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Kanban Board */
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-4">
            {kanbanColumns.map((column) => {
              const tasks = mockTaskInstances.filter(t => t.status === column.status);
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
                          <h4 className="text-xs font-semibold text-slate-800 leading-tight">{task.template.title}</h4>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                            task.template.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                            task.template.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                            task.template.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {task.template.priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-[9px] font-bold text-blue-700">{task.assignee.name.charAt(0)}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 truncate">{task.assignee.name}</span>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {task.dueDate}
                          </span>
                          <span className="text-[10px] text-slate-400">{task.template.category}</span>
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
