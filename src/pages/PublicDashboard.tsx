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
import { formatName } from '../utils/format';

export default function PublicDashboard() {
  const [stats, setStats] = useState({
    total: 0, completed: 0, pending: 0, overdue: 0, completionRate: 0
  });
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    // Public dashboard should NOT include invisible tasks
    const instancesData = await DatabaseService.getInstances({ includeInvisible: false });
    
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



  // Get upcoming tasks (due within next 7 days) grouped by recurrence
  const getUpcomingTasksByRecurrence = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    // Filter tasks due within next 7 days
    const upcomingTasks = instances.filter(task => {
      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= today && dueDate <= sevenDaysFromNow;
    });

    // Deduplicate by template (show each task template only once)
    const uniqueTemplates = new Map<string, TaskInstance>();
    upcomingTasks.forEach(task => {
      if (task.template && !uniqueTemplates.has(task.template.id)) {
        uniqueTemplates.set(task.template.id, task);
      }
    });

    // Group by recurrence type
    const grouped: Record<string, TaskInstance[]> = {
      'DAILY': [],
      'WEEKLY': [],
      'MONTHLY': [],
      'QUARTERLY': [],
      'YEARLY': [],
      'ONCE': [],
    };

    uniqueTemplates.forEach(task => {
      const recurrence = task.template?.recurrence || 'ONCE';
      if (grouped[recurrence]) {
        grouped[recurrence].push(task);
      }
    });

    return grouped;
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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Total Tasks</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center">
                <ClipboardList className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Completed</p>
                <p className="text-3xl font-bold text-emerald-600 mt-1">{stats.completed}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Pending</p>
                <p className="text-3xl font-bold text-amber-600 mt-1">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Overdue</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{stats.overdue}</p>
              </div>
              <div className="w-12 h-12 bg-red-50 text-red-700 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>



        {/* Main Content: Completion Rate on top, then Charts on left, Tasks on right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Completion Rate + Charts Column - Left Side */}
          <div className="lg:col-span-1 space-y-4">
            {/* Completion Rate Banner */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-emerald-100 text-xs">Overall Completion Rate</p>
                  <p className="text-2xl font-bold">{stats.completionRate}%</p>
                  <p className="text-emerald-100 text-xs mt-1">Target: 85%</p>
                </div>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2 mt-3">
                <div className="bg-white rounded-full h-2" style={{ width: `${stats.completionRate}%` }} />
              </div>
            </div>

            {/* Department Performance */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">By Municipality</h3>
              {departmentData().length > 0 ? (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentData()} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 9 }} stroke="#94a3b8" domain={[0, 100]} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 8 }} stroke="#94a3b8" width={80} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '10px' }} />
                      <Bar dataKey="completionRate" fill="#1e40af" radius={[0, 4, 4, 0]} name="Completion %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-400 text-xs">
                  No data available yet
                </div>
              )}
            </div>

            {/* Status Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Status Breakdown</h3>
              {statusData.length > 0 ? (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: '10px' }} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-400 text-xs">
                  No tasks yet
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Tasks Folder View - Right Side */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-800">
                  📅 Upcoming Tasks (Next 7 Days)
                </h3>
                <span className="text-xs text-slate-500">
                  Reminder view - tasks due soon
                </span>
              </div>
              
              {(() => {
                const groupedTasks = getUpcomingTasksByRecurrence();
                const hasAnyTasks = Object.values(groupedTasks).some(tasks => tasks.length > 0);
                
                if (!hasAnyTasks) {
                  return (
                    <div className="text-center py-12">
                      <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm text-slate-500">No upcoming tasks in the next 7 days</p>
                    </div>
                  );
                }

                const recurrenceConfig = {
                  'DAILY': { icon: '🔄', color: 'bg-blue-50 border-blue-200', label: 'Daily Tasks' },
                  'WEEKLY': { icon: '📅', color: 'bg-purple-50 border-purple-200', label: 'Weekly Tasks' },
                  'MONTHLY': { icon: '🗓️', color: 'bg-green-50 border-green-200', label: 'Monthly Tasks' },
                  'QUARTERLY': { icon: '📊', color: 'bg-orange-50 border-orange-200', label: 'Quarterly Tasks' },
                  'YEARLY': { icon: '🎯', color: 'bg-red-50 border-red-200', label: 'Yearly Tasks' },
                  'ONCE': { icon: '📌', color: 'bg-slate-50 border-slate-200', label: 'One-time Tasks' },
                };

                return (
                  <div className="space-y-4">
                    {Object.entries(groupedTasks).map(([recurrence, tasks]) => {
                      if (tasks.length === 0) return null;
                      
                      const config = recurrenceConfig[recurrence as keyof typeof recurrenceConfig];
                      
                      return (
                        <div key={recurrence} className={`border-2 rounded-lg p-4 ${config.color}`}>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-2xl">{config.icon}</span>
                            <h4 className="text-sm font-bold text-slate-800">{config.label}</h4>
                            <span className="text-xs bg-white px-2 py-0.5 rounded-full font-semibold text-slate-600">
                              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            {tasks.slice(0, 10).map((task) => (
                              <div key={task.id} className="bg-white rounded-lg p-3 border border-slate-200 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 truncate">
                                      {task.template?.title}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      {task.template?.category}
                                    </p>
                                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        Due: {task.dueDate}
                                        {task.template?.dueTime && (
                                          <span className="text-blue-600 font-medium">at {task.template.dueTime}</span>
                                        )}
                                      </span>
                                      {task.template?.resourceLink && (
                                        <span className="text-blue-600">📁 Resource</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {tasks.length > 10 && (
                              <p className="text-xs text-slate-500 text-center pt-2">
                                + {tasks.length - 10} more {recurrence.toLowerCase()} tasks
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
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
