import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFilters } from '../context/FilterContext';
import { DatabaseService } from '../services/database';
import { NotificationService } from '../services/notification';
import type { TaskInstance } from '../types';
import { CheckCircle2, Clock, AlertTriangle, Calendar, Tag, Upload, Send, ExternalLink } from 'lucide-react';

export default function MyTasks() {
  const { user } = useAuth();
  const { filters, setFilter } = useFilters();
  const [searchParams] = useSearchParams();
  const highlightTaskId = searchParams.get('highlight');
  const filterParam = searchParams.get('filter');
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<TaskInstance | null>(null);
  
  // Use global filter context
  const statusFilter = filters.statusFilter;
  const setStatusFilter = (value: string | null) => setFilter('statusFilter', value);

  useEffect(() => {
    loadTasks();
  }, [user]);

  useEffect(() => {
    // Handle filter parameter from URL
    if (filterParam) {
      setStatusFilter(filterParam);
    }
  }, [filterParam]);

  useEffect(() => {
    if (highlightTaskId) {
      // Scroll to the highlighted task after a short delay
      setTimeout(() => {
        const element = document.getElementById(`task-${highlightTaskId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add a temporary highlight effect
          element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
          }, 3000);
        }
      }, 300);
    }
  }, [highlightTaskId, tasks]);

  async function loadTasks() {
    if (!user) return;
    setLoading(true);
    const data = await DatabaseService.getInstancesByUser(user.id);
    setTasks(data);
    setLoading(false);
  }

  const handleStatClick = (status: string) => {
    setStatusFilter(status === statusFilter ? null : status);
  };

  const statusCounts = {
    all: tasks.length,
    PENDING: tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS' || t.status === 'SUBMITTED').length,
    COMPLETED: tasks.filter(t => t.status === 'COMPLETED').length,
    OVERDUE: tasks.filter(t => t.status === 'OVERDUE').length,
  };

  const filteredTasks = tasks.filter(task => {
    if (!statusFilter || statusFilter === 'ALL') return true;
    if (statusFilter === 'PENDING') {
      return task.status === 'PENDING' || task.status === 'IN_PROGRESS' || task.status === 'SUBMITTED';
    }
    return task.status === statusFilter;
  });

  async function handleCompleteTask(task: TaskInstance) {
    setTaskToComplete(task);
    setShowCompleteModal(true);
  }

  async function confirmCompleteTask() {
    if (!taskToComplete || !user) return;
    
    const success = await DatabaseService.updateInstanceStatus(taskToComplete.id, 'COMPLETED');
    if (success) {
      // Send notification about task completion
      await NotificationService.notifyTaskCompletion(
        taskToComplete.id,
        taskToComplete.template?.title || 'Task',
        taskToComplete.assignedTo,
        user.id,
        user.name
      );
      
      await loadTasks();
      setShowCompleteModal(false);
      setTaskToComplete(null);
    } else {
      alert('Failed to mark task as complete. Please try again.');
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>;
  }

  return (
    <div className="space-y-4">
      {/* Compact Header with Stats */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-4 text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold">My Tasks</h1>
            <p className="text-blue-100 text-xs mt-0.5">Track and manage your assigned tasks</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleStatClick('COMPLETED')}
              className={`bg-white/10 rounded-md px-3 py-1.5 cursor-pointer transition-all hover:bg-white/20 ${
                statusFilter === 'COMPLETED' ? 'ring-2 ring-white bg-white/30' : ''
              }`}
            >
              <p className="text-lg font-bold">{statusCounts.COMPLETED}</p>
              <p className="text-[10px] text-blue-200">Completed</p>
            </button>
            <button
              onClick={() => handleStatClick('OVERDUE')}
              className={`bg-white/10 rounded-md px-3 py-1.5 cursor-pointer transition-all hover:bg-white/20 ${
                statusFilter === 'OVERDUE' ? 'ring-2 ring-white bg-white/30' : ''
              }`}
            >
              <p className="text-lg font-bold">{statusCounts.OVERDUE}</p>
              <p className="text-[10px] text-blue-200">Overdue</p>
            </button>
            <button
              onClick={() => handleStatClick('PENDING')}
              className={`bg-white/10 rounded-md px-3 py-1.5 cursor-pointer transition-all hover:bg-white/20 ${
                statusFilter === 'PENDING' ? 'ring-2 ring-white bg-white/30' : ''
              }`}
            >
              <p className="text-lg font-bold">{statusCounts.PENDING}</p>
              <p className="text-[10px] text-blue-200">Pending</p>
            </button>
          </div>
        </div>
        {statusFilter && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-blue-100">
              Showing: <span className="font-bold">{statusFilter}</span> ({filteredTasks.length} tasks)
            </span>
            <button
              onClick={() => setStatusFilter(null)}
              className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-xs rounded transition-colors"
            >
              Clear Filter
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-lg border border-slate-200">
            <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">
              {statusFilter ? `No ${statusFilter.toLowerCase()} tasks` : 'No tasks assigned yet'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {statusFilter ? 'Try viewing all tasks' : 'Tasks will appear here when assigned by an admin'}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div key={task.id} id={`task-${task.id}`} className="bg-white rounded-lg border border-slate-200 p-3 hover:shadow-md transition-all">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${
                  task.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                  task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                  task.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {task.status === 'COMPLETED' ? <CheckCircle2 className="w-4 h-4" /> :
                   task.status === 'IN_PROGRESS' ? <Clock className="w-4 h-4" /> :
                   task.status === 'OVERDUE' ? <AlertTriangle className="w-4 h-4" /> :
                   <Clock className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-semibold text-slate-800">{task.template?.title}</h3>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0 ${
                      task.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                      task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                      task.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{task.template?.description}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                      <Calendar className="w-2.5 h-2.5" />
                      {task.dueDate}
                      {task.template?.dueTime && <span className="text-blue-600 font-medium">{task.template.dueTime}</span>}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                      <Tag className="w-2.5 h-2.5" />
                      {task.template?.category}
                    </span>
                    {task.template?.resourceLink && (
                      <a 
                        href={task.template.resourceLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        Resource
                      </a>
                    )}
                  </div>
                  {task.output && (
                    <div className="mt-2 p-1.5 bg-emerald-50 border border-emerald-100 rounded">
                      <p className="text-[10px] text-emerald-700"><strong>Output:</strong> {task.output}</p>
                    </div>
                  )}
                  {task.status !== 'COMPLETED' && (
                    <div className="mt-2">
                      <button
                        onClick={() => handleCompleteTask(task)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-medium rounded transition-colors"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Mark Complete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showCompleteModal && taskToComplete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">Confirm Task Completion</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-900 mb-2">⚠️ Important Notice</p>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      By marking this task as complete, you confirm that:
                    </p>
                    <ul className="text-xs text-amber-800 mt-2 space-y-1 list-disc list-inside">
                      <li>The task has been fully completed</li>
                      <li>All required outputs have been submitted</li>
                      <li>You take full responsibility for the accuracy and completeness of your work</li>
                      <li>You understand that false completion reports may result in disciplinary action</li>
                    </ul>
                    <p className="text-xs text-amber-900 font-bold mt-3">
                      This action is your own responsibility and liability.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-600">
                  <strong>Task:</strong> {taskToComplete.template?.title}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  <strong>Due Date:</strong> {taskToComplete.dueDate}
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCompleteModal(false);
                  setTaskToComplete(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmCompleteTask}
                className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
              >
                Yes, I Confirm Completion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
