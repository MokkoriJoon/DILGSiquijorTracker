import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { DatabaseService } from '../services/database';
import type { TaskInstance } from '../types';
import { CheckCircle2, Clock, AlertTriangle, Calendar, Tag, Upload, Send } from 'lucide-react';

export default function MyTasks() {
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
    setTasks(data);
    setLoading(false);
  }

  const statusCounts = {
    all: tasks.length,
    PENDING: tasks.filter(t => t.status === 'PENDING').length,
    IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    COMPLETED: tasks.filter(t => t.status === 'COMPLETED').length,
    OVERDUE: tasks.filter(t => t.status === 'OVERDUE').length,
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
        <h1 className="text-xl font-bold">My Tasks</h1>
        <p className="text-blue-100 text-sm mt-1">Track and manage your assigned tasks</p>
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="bg-white/10 rounded-lg px-4 py-2">
            <p className="text-2xl font-bold">{statusCounts.COMPLETED}</p>
            <p className="text-xs text-blue-200">Completed</p>
          </div>
          <div className="bg-white/10 rounded-lg px-4 py-2">
            <p className="text-2xl font-bold">{statusCounts.IN_PROGRESS}</p>
            <p className="text-xs text-blue-200">In Progress</p>
          </div>
          <div className="bg-white/10 rounded-lg px-4 py-2">
            <p className="text-2xl font-bold">{statusCounts.OVERDUE}</p>
            <p className="text-xs text-blue-200">Overdue</p>
          </div>
          <div className="bg-white/10 rounded-lg px-4 py-2">
            <p className="text-2xl font-bold">{statusCounts.PENDING}</p>
            <p className="text-xs text-blue-200">Pending</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-700">No tasks assigned yet</h3>
            <p className="text-xs text-slate-500 mt-1">Tasks will appear here when assigned by an admin</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  task.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                  task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                  task.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {task.status === 'COMPLETED' ? <CheckCircle2 className="w-5 h-5" /> :
                   task.status === 'IN_PROGRESS' ? <Clock className="w-5 h-5" /> :
                   task.status === 'OVERDUE' ? <AlertTriangle className="w-5 h-5" /> :
                   <Clock className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-800">{task.template?.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{task.template?.description}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Calendar className="w-3 h-3" />
                      Due: {task.dueDate}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Tag className="w-3 h-3" />
                      {task.template?.category}
                    </span>
                  </div>
                  {task.output && (
                    <div className="mt-3 p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                      <p className="text-xs text-emerald-700"><strong>Output:</strong> {task.output}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
