import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { DatabaseService } from '../services/database';
import type { TaskInstance } from '../types';
import { Folder, CheckCircle2, Clock, AlertTriangle, Calendar, Tag, ExternalLink } from 'lucide-react';

export default function TaskCategories() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

  // Group tasks by category
  const tasksByCategory = tasks.reduce((acc, task) => {
    const category = task.template?.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(task);
    return acc;
  }, {} as Record<string, TaskInstance[]>);

  const categories = Object.keys(tasksByCategory).sort();

  const filteredTasks = selectedCategory 
    ? tasksByCategory[selectedCategory] || []
    : tasks;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'COMPLETED': return { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 };
      case 'IN_PROGRESS': return { color: 'bg-blue-100 text-blue-700', icon: Clock };
      case 'SUBMITTED': return { color: 'bg-purple-100 text-purple-700', icon: Clock };
      case 'OVERDUE': return { color: 'bg-red-100 text-red-700', icon: AlertTriangle };
      default: return { color: 'bg-slate-100 text-slate-700', icon: Clock };
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
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
        <h1 className="text-xl font-bold">Task Categories</h1>
        <p className="text-blue-100 text-sm mt-1">View your tasks organized by category</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Categories Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Folder className="w-4 h-4" />
              Categories
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  !selectedCategory
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                All Tasks ({tasks.length})
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedCategory === category
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {category} ({tasksByCategory[category].length})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tasks List */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-800">
                {selectedCategory || 'All Tasks'}
              </h3>
              <span className="text-xs text-slate-500">{filteredTasks.length} tasks</span>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="text-center py-12">
                <Folder className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No tasks in this category</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task) => {
                  const statusConfig = getStatusConfig(task.status);
                  const StatusIcon = statusConfig.icon;
                  return (
                    <div
                      key={task.id}
                      className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${statusConfig.color}`}>
                          <StatusIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-semibold text-slate-800">{task.template?.title}</h4>
                              <p className="text-xs text-slate-500 mt-0.5">{task.template?.description}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusConfig.color}`}>
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-3">
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <Calendar className="w-3 h-3" />
                              Due: {task.dueDate}
                              {task.template?.dueTime && <span className="ml-1 text-blue-600 font-medium">at {task.template.dueTime}</span>}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <Tag className="w-3 h-3" />
                              {task.template?.category}
                            </span>
                            {task.template?.resourceLink && (
                              <a
                                href={task.template.resourceLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Resource
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
