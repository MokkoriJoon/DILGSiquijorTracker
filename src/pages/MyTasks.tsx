import React, { useState } from 'react';
import {
  CheckCircle2, Clock, AlertTriangle, FileText, Send,
  Calendar, Tag, ArrowUpRight, Filter, Search, Upload
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { mockTaskInstances } from '../data/mockData';
import { TaskInstance, TaskStatus } from '../types';

export default function MyTasks() {
  const { user } = useAuth();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskInstance | null>(null);

  const myTasks = mockTaskInstances.filter(t => t.assignedTo === user?.id);

  const filteredTasks = myTasks.filter(t => {
    if (filterStatus === 'all') return true;
    return t.status === filterStatus;
  });

  const statusCounts = {
    all: myTasks.length,
    PENDING: myTasks.filter(t => t.status === 'PENDING').length,
    IN_PROGRESS: myTasks.filter(t => t.status === 'IN_PROGRESS').length,
    SUBMITTED: myTasks.filter(t => t.status === 'SUBMITTED').length,
    COMPLETED: myTasks.filter(t => t.status === 'COMPLETED').length,
    OVERDUE: myTasks.filter(t => t.status === 'OVERDUE').length,
  };

  const getStatusConfig = (status: TaskStatus) => {
    switch (status) {
      case 'PENDING':
        return { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock, label: 'Pending' };
      case 'IN_PROGRESS':
        return { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: ArrowUpRight, label: 'In Progress' };
      case 'SUBMITTED':
        return { color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Send, label: 'Submitted' };
      case 'COMPLETED':
        return { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2, label: 'Completed' };
      case 'OVERDUE':
        return { color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle, label: 'Overdue' };
    }
  };

  const getPriorityDot = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      default: return 'bg-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
        <h1 className="text-xl font-bold">My Tasks</h1>
        <p className="text-blue-100 text-sm mt-1">
          Track and manage your assigned tasks and programs
        </p>
        <div className="flex gap-4 mt-4">
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

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'PENDING', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'OVERDUE'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterStatus === status
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {status === 'all' ? 'All' : getStatusConfig(status as TaskStatus).label}
            <span className="ml-1.5 opacity-70">({statusCounts[status]})</span>
          </button>
        ))}
      </div>

      {/* Task Cards */}
      <div className="space-y-3">
        {filteredTasks.map((task) => {
          const statusConfig = getStatusConfig(task.status);
          const StatusIcon = statusConfig.icon;

          return (
            <div
              key={task.id}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${statusConfig.color}`}>
                  <StatusIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-800">{task.template.title}</h3>
                        <div className={`w-2 h-2 rounded-full ${getPriorityDot(task.template.priority)}`} title={task.template.priority} />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{task.template.description}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Calendar className="w-3 h-3" />
                      Due: {task.dueDate}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Tag className="w-3 h-3" />
                      {task.template.category}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <FileText className="w-3 h-3" />
                      {task.template.recurrence}
                    </span>
                  </div>

                  {task.output && (
                    <div className="mt-3 p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                      <p className="text-xs text-emerald-700">
                        <strong>Output:</strong> {task.output}
                      </p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-3">
                    {(task.status === 'PENDING' || task.status === 'OVERDUE') && (
                      <button
                        onClick={() => { setSelectedTask(task); setShowSubmitModal(true); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <Send className="w-3 h-3" />
                        Start Task
                      </button>
                    )}
                    {task.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => { setSelectedTask(task); setShowSubmitModal(true); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <Upload className="w-3 h-3" />
                        Submit Output
                      </button>
                    )}
                    {task.status === 'COMPLETED' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-emerald-600 text-xs font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed {task.completedAt && `on ${task.completedAt}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">No tasks found</h3>
            <p className="text-xs text-slate-500 mt-1">Try changing your filter or check back later</p>
          </div>
        )}
      </div>

      {/* Submit Output Modal */}
      {showSubmitModal && selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">Submit Task Output</h3>
              <p className="text-sm text-slate-500 mt-1">{selectedTask.template.title}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Update Status</label>
                <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Output / Notes</label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Describe your output or add notes..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Attach File (optional)</label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Click to upload or drag and drop</p>
                  <p className="text-[10px] text-slate-400 mt-1">PDF, DOCX, XLSX up to 10MB</p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowSubmitModal(false); setSelectedTask(null); }}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowSubmitModal(false); setSelectedTask(null); }}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
