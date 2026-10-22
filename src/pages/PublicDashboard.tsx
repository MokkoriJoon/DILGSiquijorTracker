import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import {
  Building2, CheckCircle2, Clock, AlertTriangle, TrendingUp,
  Shield, ArrowRight, Users, ClipboardList
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { departmentStats, monthlyCompletionData, categoryData, mockTaskInstances } from '../data/mockData';

export default function PublicDashboard() {
  const totalTasks = mockTaskInstances.length;
  const completedTasks = mockTaskInstances.filter(t => t.status === 'COMPLETED').length;
  const pendingTasks = mockTaskInstances.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length;
  const overdueTasks = mockTaskInstances.filter(t => t.status === 'OVERDUE').length;
  const completionRate = Math.round((completedTasks / totalTasks) * 100);

  const stats = [
    { label: 'Total Tasks', value: totalTasks, icon: ClipboardList, color: 'bg-blue-500', lightColor: 'bg-blue-50 text-blue-700' },
    { label: 'Completed', value: completedTasks, icon: CheckCircle2, color: 'bg-emerald-500', lightColor: 'bg-emerald-50 text-emerald-700' },
    { label: 'In Progress', value: pendingTasks, icon: Clock, color: 'bg-amber-500', lightColor: 'bg-amber-50 text-amber-700' },
    { label: 'Overdue', value: overdueTasks, icon: AlertTriangle, color: 'bg-red-500', lightColor: 'bg-red-50 text-red-700' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
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
                  <h1 className="text-2xl lg:text-3xl font-bold">DILG Task Tracker</h1>
                  <p className="text-blue-200 text-sm">Department of the Interior and Local Government</p>
                </div>
              </div>
              <p className="text-blue-100 max-w-xl text-sm lg:text-base">
                Real-time monitoring of departmental programs, task completion, and performance metrics 
                across all regional and provincial offices.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl"
              >
                <Shield className="w-4 h-4" />
                Staff Login
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-all border border-white/20"
              >
                <Users className="w-4 h-4" />
                Admin Portal
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 -mt-12 relative z-10">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{stat.label}</p>
                  <p className="text-3xl font-bold text-slate-800 mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 ${stat.lightColor} rounded-xl flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Completion Rate Banner */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 mb-8 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-8 h-8" />
              </div>
              <div>
                <p className="text-emerald-100 text-sm">Overall Completion Rate</p>
                <p className="text-4xl font-bold">{completionRate}%</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-emerald-100 text-sm">Target: 85%</p>
              <div className="w-48 bg-white/20 rounded-full h-3 mt-2">
                <div
                  className="bg-white rounded-full h-3 transition-all duration-1000"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Monthly Completion Trend */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Monthly Completion Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyCompletionData}>
                  <defs>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="url(#colorTotal)" name="Total Tasks" />
                  <Area type="monotone" dataKey="completed" stroke="#10b981" fill="url(#colorCompleted)" name="Completed" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Task Categories */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Tasks by Category</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    wrapperStyle={{ fontSize: '12px' }}
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Department Performance */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-8">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Department Performance</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentStats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" width={140} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  formatter={(value: number, name: string) => [`${value}%`, name === 'completionRate' ? 'Completion Rate' : name]}
                />
                <Bar dataKey="completionRate" fill="#1e40af" radius={[0, 4, 4, 0]} name="Completion Rate" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800">Recent Activity</h3>
            <span className="text-xs text-slate-500">Last 7 days</span>
          </div>
          <div className="space-y-3">
            {[
              { action: 'Monthly Report submitted', user: 'Juan Cruz', dept: 'NCR', time: '2 hours ago', status: 'completed' },
              { action: 'Quarterly Review in progress', user: 'Ana Reyes', dept: 'Region III', time: '5 hours ago', status: 'in-progress' },
              { action: 'LGU Compliance Dashboard updated', user: 'Lisa Mendoza', dept: 'Cavite', time: '1 day ago', status: 'completed' },
              { action: 'Barangay Assessment started', user: 'Pedro Garcia', dept: 'Region VII', time: '2 days ago', status: 'in-progress' },
              { action: 'Monthly Report overdue', user: 'Pedro Garcia', dept: 'Region VII', time: '3 days ago', status: 'overdue' },
            ].map((activity, idx) => (
              <div key={idx} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                <div className={`w-2 h-2 rounded-full ${
                  activity.status === 'completed' ? 'bg-emerald-500' :
                  activity.status === 'in-progress' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{activity.action}</p>
                  <p className="text-xs text-slate-500">{activity.user} • {activity.dept}</p>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-500">
            © 2025 Department of the Interior and Local Government. All rights reserved.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Republic of the Philippines
          </p>
        </footer>
      </div>
    </div>
  );
}
