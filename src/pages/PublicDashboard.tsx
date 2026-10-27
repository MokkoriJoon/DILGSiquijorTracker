import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DatabaseService } from '../services/database';
import { useSiteSettings } from '../context/SiteSettingsContext';
import type { TaskInstance } from '../types';
import {
  Building2, Shield, Users, CheckCircle2, Clock, AlertTriangle,
  ClipboardList, Calendar, Eye, X
} from 'lucide-react';
import { formatName } from '../utils/format';

export default function PublicDashboard() {
  const { settings } = useSiteSettings();
  const [stats, setStats] = useState({
    total: 0, completed: 0, pending: 0, overdue: 0
  });
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [recurrenceFilter, setRecurrenceFilter] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const instancesData = await DatabaseService.getInstances({ includeInvisible: false });
    
    const total = instancesData.length;
    const completed = instancesData.filter(i => i.status === 'COMPLETED').length;
    const pending = instancesData.filter(i => 
      i.status === 'PENDING' || 
      i.status === 'IN_PROGRESS' || 
      i.status === 'SUBMITTED'
    ).length;
    const overdue = instancesData.filter(i => i.status === 'OVERDUE').length;
    
    setStats({ total, completed, pending, overdue });
    setInstances(instancesData);
    setLoading(false);
  }

  const handleStatClick = (status: string) => {
    setStatusFilter(status === statusFilter ? null : status);
  };

  const getFilteredTasks = () => {
    if (!statusFilter || statusFilter === 'TOTAL') {
      return instances;
    }
    
    if (statusFilter === 'PENDING') {
      return instances.filter(i => 
        i.status === 'PENDING' || 
        i.status === 'IN_PROGRESS' || 
        i.status === 'SUBMITTED'
      );
    }
    
    return instances.filter(i => i.status === statusFilter);
  };

  // Get tasks filtered by recurrence type
  const getTasksByRecurrence = (recurrenceType: string) => {
    // Deduplicate by template
    const uniqueTemplates = new Map<string, TaskInstance[]>();
    instances.forEach(task => {
      if (task.template && task.template.recurrence === recurrenceType) {
        if (!uniqueTemplates.has(task.template.id)) {
          uniqueTemplates.set(task.template.id, []);
        }
        uniqueTemplates.get(task.template.id)!.push(task);
      }
    });

    return Array.from(uniqueTemplates.entries()).map(([templateId, assignees]) => ({
      template: assignees[0].template,
      assignees: assignees
    }));
  };

  // Get OVERDUE tasks (for urgent display)
  const getOverdueTasks = () => {
    const overdueTasks = instances.filter(task => task.status === 'OVERDUE');
    
    // Deduplicate by template
    const uniqueTemplates = new Map<string, TaskInstance[]>();
    overdueTasks.forEach(task => {
      if (task.template) {
        if (!uniqueTemplates.has(task.template.id)) {
          uniqueTemplates.set(task.template.id, []);
        }
        uniqueTemplates.get(task.template.id)!.push(task);
      }
    });

    return Array.from(uniqueTemplates.entries()).map(([templateId, assignees]) => ({
      template: assignees[0].template,
      assignees: assignees
    }));
  };

  // Get tasks due TODAY or TOMORROW (urgent reminders)
  const getUrgentTasks = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const urgentTasks = instances.filter(task => {
      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      // Exclude overdue tasks (they're shown separately)
      if (task.status === 'OVERDUE') return false;
      // Include tasks due today or tomorrow
      return dueDate.getTime() === today.getTime() || dueDate.getTime() === tomorrow.getTime();
    });

    // Deduplicate by template
    const uniqueTemplates = new Map<string, TaskInstance[]>();
    urgentTasks.forEach(task => {
      if (task.template) {
        if (!uniqueTemplates.has(task.template.id)) {
          uniqueTemplates.set(task.template.id, []);
        }
        uniqueTemplates.get(task.template.id)!.push(task);
      }
    });

    return Array.from(uniqueTemplates.entries()).map(([templateId, assignees]) => ({
      template: assignees[0].template,
      assignees: assignees
    }));
  };

  // Get upcoming tasks (due within next 7 days, excluding overdue) grouped by recurrence
  const getUpcomingTasksByRecurrence = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    const upcomingTasks = instances.filter(task => {
      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      // Exclude overdue tasks (they're shown separately)
      if (task.status === 'OVERDUE') return false;
      return dueDate >= today && dueDate <= sevenDaysFromNow;
    });

    // Deduplicate by template
    const uniqueTemplates = new Map<string, TaskInstance[]>();
    upcomingTasks.forEach(task => {
      if (task.template) {
        if (!uniqueTemplates.has(task.template.id)) {
          uniqueTemplates.set(task.template.id, []);
        }
        uniqueTemplates.get(task.template.id)!.push(task);
      }
    });

    // Group by recurrence type
    const grouped: Record<string, Array<{ template: any; assignees: TaskInstance[] }>> = {
      'DAILY': [],
      'WEEKLY': [],
      'MONTHLY': [],
      'QUARTERLY': [],
      'YEARLY': [],
      'ONCE': [],
    };

    uniqueTemplates.forEach((assignees) => {
      const recurrence = assignees[0]?.template?.recurrence || 'ONCE';
      if (grouped[recurrence]) {
        grouped[recurrence].push({
          template: assignees[0].template,
          assignees: assignees
        });
      }
    });

    return grouped;
  };

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
      {/* Hero Header - Compact */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="w-12 h-12 rounded-xl object-cover shadow-lg" />
              ) : (
                <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-xl lg:text-2xl font-bold">{settings.site_name}</h1>
                <p className="text-blue-200 text-xs">{settings.site_description}</p>
              </div>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-lg transition-all shadow-lg text-sm"
            >
              <Shield className="w-4 h-4" />
              Staff Login
            </Link>
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

        {/* OVERDUE Tasks - Urgent Alert Section */}
        {(() => {
          const overdueTasks = getOverdueTasks();
          if (overdueTasks.length === 0) return null;

          return (
            <div className="mb-6">
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                  <h3 className="text-lg font-bold text-red-800">
                    ⚠️ OVERDUE Tasks ({overdueTasks.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {overdueTasks.map((taskData) => {
                    const { template, assignees } = taskData;
                    return (
                      <div key={template.id} className="bg-white rounded-lg p-3 border-2 border-red-200">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-red-900 truncate">
                              {template.title}
                            </p>
                            <p className="text-xs text-red-700 mt-0.5">
                              {template.category} • {template.recurrence}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {assignees.slice(0, 5).map((assignee, idx) => (
                                <span 
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full border border-red-300"
                                >
                                  <div className="w-4 h-4 bg-red-200 rounded-full flex items-center justify-center">
                                    <span className="text-[8px] font-bold text-red-900">
                                      {assignee.assignee?.name ? formatName(assignee.assignee.name).charAt(0) : '?'}
                                    </span>
                                  </div>
                                  {assignee.assignee?.name ? formatName(assignee.assignee.name) : 'Unassigned'}
                                  <span className="text-red-600 font-semibold">(Due: {assignee.dueDate})</span>
                                </span>
                              ))}
                              {assignees.length > 5 && (
                                <span className="text-xs text-red-600 font-semibold">
                                  +{assignees.length - 5} more
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* URGENT Tasks - Due Today or Tomorrow */}
        {(() => {
          const urgentTasks = getUrgentTasks();
          if (urgentTasks.length === 0) return null;

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(today.getDate() + 1);

          const tasksDueToday = urgentTasks.filter(t => {
            const dueDate = new Date(t.assignees[0].dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate.getTime() === today.getTime();
          });

          const tasksDueTomorrow = urgentTasks.filter(t => {
            const dueDate = new Date(t.assignees[0].dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate.getTime() === tomorrow.getTime();
          });

          return (
            <div className="mb-6">
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-6 h-6 text-amber-600" />
                  <h3 className="text-lg font-bold text-amber-800">
                    ⏰ URGENT Tasks Due Soon ({urgentTasks.length})
                  </h3>
                </div>

                {/* Tasks Due Today */}
                {tasksDueToday.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-bold text-amber-900 mb-2">
                      📅 Due TODAY ({tasksDueToday.length})
                    </h4>
                    <div className="space-y-2">
                      {tasksDueToday.map((taskData) => {
                        const { template, assignees } = taskData;
                        return (
                          <div key={template.id} className="bg-white rounded-lg p-3 border-2 border-amber-200">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-amber-900 truncate">
                                  {template.title}
                                </p>
                                <p className="text-xs text-amber-700 mt-0.5">
                                  {template.category} • {template.recurrence}
                                  {template.dueTime && <span className="ml-2 font-semibold">at {template.dueTime}</span>}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {assignees.slice(0, 5).map((assignee, idx) => (
                                    <span 
                                      key={idx}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full border border-amber-300"
                                    >
                                      <div className="w-4 h-4 bg-amber-200 rounded-full flex items-center justify-center">
                                        <span className="text-[8px] font-bold text-amber-900">
                                          {assignee.assignee?.name ? formatName(assignee.assignee.name).charAt(0) : '?'}
                                        </span>
                                      </div>
                                      {assignee.assignee?.name ? formatName(assignee.assignee.name) : 'Unassigned'}
                                    </span>
                                  ))}
                                  {assignees.length > 5 && (
                                    <span className="text-xs text-amber-600 font-semibold">
                                      +{assignees.length - 5} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tasks Due Tomorrow */}
                {tasksDueTomorrow.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-amber-900 mb-2">
                      📅 Due TOMORROW ({tasksDueTomorrow.length})
                    </h4>
                    <div className="space-y-2">
                      {tasksDueTomorrow.map((taskData) => {
                        const { template, assignees } = taskData;
                        return (
                          <div key={template.id} className="bg-white rounded-lg p-3 border-2 border-amber-200">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-amber-900 truncate">
                                  {template.title}
                                </p>
                                <p className="text-xs text-amber-700 mt-0.5">
                                  {template.category} • {template.recurrence}
                                  {template.dueTime && <span className="ml-2 font-semibold">at {template.dueTime}</span>}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {assignees.slice(0, 5).map((assignee, idx) => (
                                    <span 
                                      key={idx}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full border border-amber-300"
                                    >
                                      <div className="w-4 h-4 bg-amber-200 rounded-full flex items-center justify-center">
                                        <span className="text-[8px] font-bold text-amber-900">
                                          {assignee.assignee?.name ? formatName(assignee.assignee.name).charAt(0) : '?'}
                                        </span>
                                      </div>
                                      {assignee.assignee?.name ? formatName(assignee.assignee.name) : 'Unassigned'}
                                    </span>
                                  ))}
                                  {assignees.length > 5 && (
                                    <span className="text-xs text-amber-600 font-semibold">
                                      +{assignees.length - 5} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

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
                <p className="text-xs text-blue-600 mt-1">Click to view all</p>
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

        {/* Clear Filter Button */}
        {statusFilter && (
          <div className="mb-6 flex items-center justify-between bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700">
                Showing: <span className="font-bold text-blue-600">{statusFilter}</span> tasks
              </span>
              <span className="text-xs text-slate-500">
                ({getFilteredTasks().length} tasks)
              </span>
            </div>
            <button
              onClick={() => setStatusFilter(null)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Clear Filter
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          {!statusFilter ? (
            // Folder View - Upcoming Tasks
            <>
              {/* Recurrence Filter Buttons */}
              <div className="mb-6">
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setRecurrenceFilter(null)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      recurrenceFilter === null
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    📅 All Upcoming
                  </button>
                  <button
                    onClick={() => setRecurrenceFilter('DAILY')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      recurrenceFilter === 'DAILY'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    🔄 Daily
                  </button>
                  <button
                    onClick={() => setRecurrenceFilter('WEEKLY')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      recurrenceFilter === 'WEEKLY'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    📅 Weekly
                  </button>
                  <button
                    onClick={() => setRecurrenceFilter('MONTHLY')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      recurrenceFilter === 'MONTHLY'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    🗓️ Monthly
                  </button>
                  <button
                    onClick={() => setRecurrenceFilter('QUARTERLY')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      recurrenceFilter === 'QUARTERLY'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    📊 Quarterly
                  </button>
                  <button
                    onClick={() => setRecurrenceFilter('SEMESTER')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      recurrenceFilter === 'SEMESTER'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    📆 Semester
                  </button>
                  <button
                    onClick={() => setRecurrenceFilter('YEARLY')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      recurrenceFilter === 'YEARLY'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    🎯 Yearly
                  </button>
                  <button
                    onClick={() => setRecurrenceFilter('ONCE')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      recurrenceFilter === 'ONCE'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    📌 One-time
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-800">
                  {recurrenceFilter ? `${recurrenceFilter} Tasks` : '📅 Upcoming Tasks (Next 7 Days)'}
                </h3>
                <span className="text-xs text-slate-500">
                  {recurrenceFilter ? 'All Tasks View' : 'Reminder View'}
                </span>
              </div>
              
              {(() => {
                // If recurrence filter is active, show all tasks for that recurrence
                if (recurrenceFilter) {
                  const filteredTasks = getTasksByRecurrence(recurrenceFilter);
                  
                  if (filteredTasks.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500">No {recurrenceFilter.toLowerCase()} tasks found</p>
                      </div>
                    );
                  }

                  const recurrenceConfig = {
                    'DAILY': { icon: '🔄', color: 'bg-blue-50 border-blue-200', label: 'Daily Tasks' },
                    'WEEKLY': { icon: '📅', color: 'bg-purple-50 border-purple-200', label: 'Weekly Tasks' },
                    'MONTHLY': { icon: '🗓️', color: 'bg-green-50 border-green-200', label: 'Monthly Tasks' },
                    'QUARTERLY': { icon: '📊', color: 'bg-orange-50 border-orange-200', label: 'Quarterly Tasks' },
                    'SEMESTER': { icon: '📆', color: 'bg-indigo-50 border-indigo-200', label: 'Semester Tasks' },
                    'YEARLY': { icon: '🎯', color: 'bg-red-50 border-red-200', label: 'Yearly Tasks' },
                    'ONCE': { icon: '📌', color: 'bg-slate-50 border-slate-200', label: 'One-time Tasks' },
                  };

                  const config = recurrenceConfig[recurrenceFilter as keyof typeof recurrenceConfig];

                  return (
                    <div className={`border-2 rounded-lg p-4 ${config.color}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">{config.icon}</span>
                        <h4 className="text-sm font-bold text-slate-800">{config.label}</h4>
                        <span className="text-xs bg-white px-2 py-0.5 rounded-full font-semibold text-slate-600">
                          {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        {filteredTasks.map((taskData) => {
                          const { template, assignees } = taskData;
                          
                          return (
                            <div key={template.id} className="bg-white rounded-lg p-3 border border-slate-200 hover:shadow-md transition-shadow">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-800 truncate">
                                    {template.title}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {template.category}
                                  </p>
                                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {assignees.length} instance{assignees.length !== 1 ? 's' : ''}
                                      {template.dueTime && (
                                        <span className="text-blue-600 font-medium">at {template.dueTime}</span>
                                      )}
                                    </span>
                                  </div>
                                  {/* Assigned Users */}
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {assignees.slice(0, 5).map((assignee, idx) => (
                                      <span 
                                        key={idx}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-full"
                                      >
                                        <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center">
                                          <span className="text-[8px] font-bold text-blue-700">
                                            {assignee.assignee?.name ? formatName(assignee.assignee.name).charAt(0) : '?'}
                                          </span>
                                        </div>
                                        {assignee.assignee?.name ? formatName(assignee.assignee.name) : 'Unassigned'}
                                        <span className="text-slate-500">({assignee.dueDate})</span>
                                      </span>
                                    ))}
                                    {assignees.length > 5 && (
                                      <span className="text-xs text-slate-500">
                                        +{assignees.length - 5} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                // Default: Show upcoming tasks (next 7 days)
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
                  'SEMESTER': { icon: '📆', color: 'bg-indigo-50 border-indigo-200', label: 'Semester Tasks' },
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
                            {tasks.slice(0, 10).map((taskData) => {
                              const { template, assignees } = taskData;
                              const earliestDue = assignees.reduce((earliest, current) => 
                                new Date(current.dueDate) < new Date(earliest.dueDate) ? current : earliest
                              );
                              
                              return (
                                <div key={template.id} className="bg-white rounded-lg p-3 border border-slate-200 hover:shadow-md transition-shadow">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-slate-800 truncate">
                                        {template.title}
                                      </p>
                                      <p className="text-xs text-slate-500 mt-0.5">
                                        {template.category}
                                      </p>
                                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
                                        <span className="flex items-center gap-1">
                                          <Calendar className="w-3 h-3" />
                                          Due: {earliestDue.dueDate}
                                          {template.dueTime && (
                                            <span className="text-blue-600 font-medium">at {template.dueTime}</span>
                                          )}
                                        </span>
                                      </div>
                                      {/* Assigned Users */}
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {assignees.slice(0, 5).map((assignee, idx) => (
                                          <span 
                                            key={idx}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-full"
                                          >
                                            <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center">
                                              <span className="text-[8px] font-bold text-blue-700">
                                                {assignee.assignee?.name ? formatName(assignee.assignee.name).charAt(0) : '?'}
                                              </span>
                                            </div>
                                            {assignee.assignee?.name ? formatName(assignee.assignee.name) : 'Unassigned'}
                                          </span>
                                        ))}
                                        {assignees.length > 5 && (
                                          <span className="text-xs text-slate-500">
                                            +{assignees.length - 5} more
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
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
            </>
          ) : (
            // Filtered View - All Tasks
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-800">
                  All Tasks ({getFilteredTasks().length})
                </h3>
              </div>
              
              {getFilteredTasks().length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No tasks found</p>
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
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {getFilteredTasks().map((task) => {
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
                                    {task.assignee?.name ? formatName(task.assignee.name).charAt(0) : '?'}
                                  </span>
                                </div>
                                <span className="text-sm text-slate-700">{task.assignee?.name ? formatName(task.assignee.name) : 'Unassigned'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-slate-600">{task.assignee?.department || '-'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-slate-600">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {task.dueDate}
                                  {task.template?.dueTime && <span className="text-blue-600 font-medium">at {task.template.dueTime}</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full ${statusConfig.color}`}>
                                <StatusIcon className="w-3 h-3" />
                                {task.status.replace('_', ' ')}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-500">
            © 2026 D.E.N.N.I.S. • DILG Region NIR • Siquijor Provincial Office
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Republic of the Philippines
          </p>
        </footer>
      </div>
    </div>
  );
}
