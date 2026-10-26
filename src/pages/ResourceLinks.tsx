import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { DatabaseService } from '../services/database';
import type { TaskInstance } from '../types';
import { ExternalLink, Link as LinkIcon, Calendar, Tag, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

export default function ResourceLinks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, [user]);

  async function loadTasks() {
    if (!user) return;
    setLoading(true);
    const data = await DatabaseService.getInstancesByUser(user.id);
    // Filter only tasks with resource links
    const tasksWithLinks = data.filter(task => task.template?.resourceLink);
    setTasks(tasksWithLinks);
    setLoading(false);
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'IN_PROGRESS':
      case 'SUBMITTED': return <Clock className="w-4 h-4 text-blue-600" />;
      case 'OVERDUE': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <Clock className="w-4 h-4 text-slate-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-emerald-50 border-emerald-200';
      case 'IN_PROGRESS':
      case 'SUBMITTED': return 'bg-blue-50 border-blue-200';
      case 'OVERDUE': return 'bg-red-50 border-red-200';
      default: return 'bg-slate-50 border-slate-200';
    }
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
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3">
          <LinkIcon className="w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold">Resource Links</h1>
            <p className="text-blue-100 text-sm mt-1">
              Quick access to all resource links from your assigned tasks
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <LinkIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{tasks.length}</p>
              <p className="text-xs text-slate-500">Total Links</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {tasks.filter(t => t.status === 'COMPLETED').length}
              </p>
              <p className="text-xs text-slate-500">Completed</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length}
              </p>
              <p className="text-xs text-slate-500">Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* Resource Links List */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-4">Your Resource Links</h3>
        
        {tasks.length === 0 ? (
          <div className="text-center py-12">
            <LinkIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No resource links available</p>
            <p className="text-xs text-slate-400 mt-1">
              Resource links will appear here when assigned by an admin
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`border rounded-lg p-4 hover:shadow-md transition-all ${getStatusColor(task.status)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(task.status)}
                      <h4 className="text-sm font-semibold text-slate-800">
                        {task.template?.title}
                      </h4>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />
                        Due: {task.dueDate}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Tag className="w-3 h-3" />
                        {task.template?.category}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        task.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                        task.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>

                    <a
                      href={task.template?.resourceLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open Resource Link
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
