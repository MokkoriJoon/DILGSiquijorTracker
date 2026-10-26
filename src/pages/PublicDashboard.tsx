import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DatabaseService } from '../services/database';
import type { TaskInstance } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Building2, Shield, Users, CheckCircle2, Clock, AlertTriangle,
  ClipboardList, TrendingUp, Calendar, Eye
} from 'lucide-react';

export default function PublicDashboard() {
  const [stats, setStats] = useState({
    total: 0, completed: 0, pending: 0, overdue: 0, completionRate: 0
  });
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(10);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const instancesData = await DatabaseService.getInstances();
    
    // Calculate stats with merged categories
    const total = instancesData.length;
    const completed = instancesData.filter(i => i.status === 'COMPLETED').length;
    const pending = instancesData.filter(i => 
      i.status === 'PENDING' || 
      i.status === 'IN_PROGRESS' || 
      i.status === 'SUBMITTED'
    ).length;
    const overdue = instancesData.filter(i => i.status === 'OVERDUE').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    setStats({ total, completed, pending, overdue, completionRate });
    setInstances(instancesData);
    setLoading(false);
  }

  const handleStatClick = (status: string) => {
    setStatusFilter(status === statusFilter ? null : status);
    setDisplayCount(10); // Reset pagination when filter changes
  };

  const handleShowMore = () => {
    setDisplayCount(prev => prev + 10);
  };

  // Build department chart data
  const departmentData = () => {
    const deptMap: Record<string, { total: number; completed: number }> = {};
    instances.forEach((inst) => {
      const dept = inst.assignee?.department || 'Unknown';
      if (!deptMap[dept]) deptMap[dept] = { total: 0, completed: 0 };
      deptMap[dept].total++;
      if (inst.status === 'COMPLETED') deptMap[dept].completed++;
    });
    return Object.entries(deptMap).map(([name, data]) => ({
      name: name.replace('Municipality of ', ''),
      completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      total: data.total,
      completed: data.completed,
    }));
  };

  // Status breakdown for pie chart
  const statusData = [
    { name: 'Completed', value: stats.completed, color: '#10b981' },
    { name: 'Pending', value: stats.pending, color: '#f59e0b' },
    { name: 'Overdue', value: stats.overdue, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'COMPLETED': return { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 };
      case 'IN_PROGRESS': return { color: 'bg-blue-100 text-blue-700', icon: Clock };
      case 'SUBMITTED': return { color: 'bg-purple-100 text-purple-700', icon: Eye };
      case 'OVERDUE': return { color: 'bg-red-100 text-red-700', icon: AlertTriangle };
      default: return { color: 'bg-slate-100 text-slate-700', icon: Clock };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Building2 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold">DILG Siquijor</h1>
                  <p className="text-blue-200 text-sm">Task Tracker • Region NIR</p>
                </div>
              </div>
              <p className="text-blue-100 max-w-xl text-sm lg:text-base">
                Public view of departmental programs and task progress across DILG Siquijor Provincial Office and all municipalities.
              </p>
            </div>
            <div className="flex gap-3">
              <Link to="/login" className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-lg transition-all shadow-lg">
                <Shield className="w-4 h-4" />
                Staff Login
              </Link>
              <Link to="/register" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-all border border-white/20">
                <Users className="w-4 h-4" />
                Register
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Public View Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Eye className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Public Viewing Mode</p>
            <p className="text-xs text-blue-700 mt-1">
              You are viewing the dashboard in read-only mode. Task details and completion actions are only available to authenticated staff.
            </p>
          </div>
        </div>

        {/* Stats Cards - Clickable */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div 
            onClick={() => handleStatClick('TOTAL')}
            className={`bg-white rounded-xl shadow-sm border-2 p-5 cursor-pointer transition-all hover:shadow-md ${
              statusFilter === 'TOTAL' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Total Tasks</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{stats.total}</p>
                <p className="text-xs text-blue-600 mt-1">Click to filter</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center">
                <ClipboardList className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div 
            onClick={() => handleStatClick('COMPLETED')}
            className={`bg-white rounded-xl shadow-sm border-2 p-5 cursor-pointer transition-all hover:shadow-md ${
              statusFilter === 'COMPLETED' ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Completed</p>
                <p className="text-3xl font-bold text-emerald-600 mt-1">{stats.completed}</p>
                <p className="text-xs text-emerald-600 mt-1">Click to filter</p>
              </div>
              <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div 
            onClick={() => handleStatClick('PENDING')}
            className={`bg-white rounded-xl shadow-sm border-2 p-5 cursor-pointer transition-all hover:shadow-md ${
              statusFilter === 'PENDING' ? 'border-amber-500 ring-2 ring-amber-200' : 'border-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Pending</p>
                <p className="text-3xl font-bold text-amber-600 mt-1">{stats.pending}</p>
                <p className="text-xs text-amber-600 mt-1">Click to filter</p>
              </div>
              <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div 
            onClick={() => handleStatClick('OVERDUE')}
            className={`bg-white rounded-xl shadow-sm border-2 p-5 cursor-pointer transition-all hover:shadow-md ${
              statusFilter === 'OVERDUE' ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Overdue</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{stats.overdue}</p>
                <p className="text-xs text-red-600 mt-1">Click to filter</p>
              </div>
              <div className="w-12 h-12 bg-red-50 text-red-700 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Filter Indicator */}
        {statusFilter && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-blue-900">
                Showing: <span className="font-bold">{statusFilter}</span> tasks
              </span>
              <span className="text-xs text-blue-700">
                ({statusFilter === 'TOTAL' ? stats.total : 
                  statusFilter === 'COMPLETED' ? stats.completed :
                  statusFilter === 'PENDING' ? stats.pending :
                  stats.overdue} tasks)
              </span>
            </div>
            <button
              onClick={() => setStatusFilter(null)}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              Clear Filter
            </button>
          </div>
        )}

        {/* Completion Rate Banner */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 mb-8 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-8 h-8" />
              </div>
              <div>
                <p className="text-emerald-100 text-sm">Overall Completion Rate</p>
                <p className="text-4xl font-bold">{stats.completionRate}%</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-emerald-100 text-sm">Target: 85%</p>
              <div className="w-48 bg-white/20 rounded-full h-3 mt-2">
                <div className="bg-white rounded-full h-3" style={{ width: `${stats.completionRate}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Charts - Compact */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Department Performance */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Completion by Municipality</h3>
            {departmentData().length > 0 ? (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentData()} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8" domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} stroke="#94a3b8" width={100} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                    <Bar dataKey="completionRate" fill="#1e40af" radius={[0, 4, 4, 0]} name="Completion %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-slate-400 text-xs">
                No data available yet
              </div>
            )}
          </div>

          {/* Status Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Task Status Breakdown</h3>
            {statusData.length > 0 ? (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2} dataKey="value">
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: '11px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-slate-400 text-xs">
                No tasks yet
              </div>
            )}
          </div>
        </div>

        {/* All Tasks - Read Only Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800">
              {statusFilter ? `Filtered Tasks - ${statusFilter}` : 'All Tasks (Read-Only View)'}
            </h3>
            <span className="text-xs text-slate-500">
              {statusFilter 
                ? `${instances.filter(t => {
                    if (statusFilter === 'TOTAL') return true;
                    if (statusFilter === 'PENDING') return t.status === 'PENDING' || t.status === 'IN_PROGRESS' || t.status === 'SUBMITTED';
                    return t.status === statusFilter;
                  }).length} tasks`
                : `${instances.length} total tasks`
              }
            </span>
          </div>
          
          {instances.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No tasks have been created yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Task</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Assigned To</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Department</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Due Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Resource</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const filteredTasks = instances.filter(task => {
                      if (!statusFilter || statusFilter === 'TOTAL') return true;
                      if (statusFilter === 'PENDING') {
                        return task.status === 'PENDING' || task.status === 'IN_PROGRESS' || task.status === 'SUBMITTED';
                      }
                      return task.status === statusFilter;
                    });
                    
                    const displayedTasks = filteredTasks.slice(0, displayCount);
                    const hasMore = filteredTasks.length > displayCount;
                    
                    return (
                      <>
                        {displayedTasks.map((task) => {
                          const statusConfig = getStatusConfig(task.status);
                          const StatusIcon = statusConfig.icon;
                          return (
                            <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3">
                                <div>
                                  <p className="text-sm font-medium text-slate-800">{task.template?.title}</p>
                                  <p className="text-xs text-slate-500 mt-0.5">{task.template?.category}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-xs font-bold text-blue-700">
                                      {task.assignee?.name?.charAt(0) || '?'}
                                    </span>
                                  </div>
                                  <span className="text-sm text-slate-700">{task.assignee?.name || 'Unassigned'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-slate-600">{task.assignee?.department || '-'}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-slate-600 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {task.dueDate}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full ${statusConfig.color}`}>
                                  <StatusIcon className="w-3 h-3" />
                                  {task.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {task.template?.resourceLink ? (
                                  <span className="text-xs text-blue-600">📁 Available</span>
                                ) : (
                                  <span className="text-xs text-slate-400">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {hasMore && (
                          <tr>
                            <td colSpan={6} className="px-4 py-4 text-center">
                              <button
                                onClick={handleShowMore}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                Show More ({filteredTasks.length - displayCount} remaining)
                              </button>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-500">© 2025 DILG Region NIR • Siquijor Provincial Office</p>
          <p className="text-xs text-slate-400 mt-1">Republic of the Philippines</p>
        </footer>
      </div>
    </div>
  );
}
