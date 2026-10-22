import React, { useState } from 'react';
import {
  Plus, Search, Filter, Calendar, Users, Clock, Tag,
  MoreVertical, Edit2, Trash2, Eye, ChevronDown, Repeat
} from 'lucide-react';
import { mockTaskTemplates, mockTaskInstances, mockUsers } from '../data/mockData';
import { TaskTemplate, RecurrenceType } from '../types';

export default function TaskManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterRecurrence, setFilterRecurrence] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskTemplate | null>(null);

  const categories = [...new Set(mockTaskTemplates.map(t => t.category))];

  const filteredTemplates = mockTaskTemplates.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
    const matchesRecurrence = filterRecurrence === 'all' || t.recurrence === filterRecurrence;
    return matchesSearch && matchesCategory && matchesRecurrence;
  });

  const getRecurrenceLabel = (recurrence: RecurrenceType) => {
    const labels: Record<RecurrenceType, string> = {
      ONCE: 'One-time',
      DAILY: 'Daily',
      WEEKLY: 'Weekly',
      MONTHLY: 'Monthly',
      QUARTERLY: 'Quarterly',
      YEARLY: 'Yearly',
    };
    return labels[recurrence];
  };

  const getRecurrenceColor = (recurrence: RecurrenceType) => {
    const colors: Record<RecurrenceType, string> = {
      ONCE: 'bg-slate-100 text-slate-700',
      DAILY: 'bg-blue-100 text-blue-700',
      WEEKLY: 'bg-cyan-100 text-cyan-700',
      MONTHLY: 'bg-purple-100 text-purple-700',
      QUARTERLY: 'bg-amber-100 text-amber-700',
      YEARLY: 'bg-emerald-100 text-emerald-700',
    };
    return colors[recurrence];
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-100 text-red-700 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Task Templates</h2>
          <p className="text-sm text-slate-500">Create and manage recurring and one-time task templates</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Task Template
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={filterRecurrence}
            onChange={(e) => setFilterRecurrence(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Frequencies</option>
            <option value="ONCE">One-time</option>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTemplates.map((template) => {
          const instances = mockTaskInstances.filter(i => i.templateId === template.id);
          const completedInstances = instances.filter(i => i.status === 'COMPLETED').length;
          
          return (
            <div
              key={template.id}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all cursor-pointer"
              onClick={() => setSelectedTask(template)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-slate-800">{template.title}</h3>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getPriorityColor(template.priority)}`}>
                      {template.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">{template.description}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${getRecurrenceColor(template.recurrence)}`}>
                      <Repeat className="w-3 h-3" />
                      {getRecurrenceLabel(template.recurrence)}
                      {template.dueDay && ` (Day ${template.dueDay})`}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      <Tag className="w-3 h-3" />
                      {template.category}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                      <Users className="w-3 h-3" />
                      {instances.length} instances
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                      <Clock className="w-3 h-3" />
                      {completedInstances}/{instances.length} completed
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="View">
                    <Eye className="w-4 h-4 text-slate-400" />
                  </button>
                  <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Edit">
                    <Edit2 className="w-4 h-4 text-slate-400" />
                  </button>
                  <button className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">Create Task Template</h3>
              <p className="text-sm text-slate-500">Define a new task that can be assigned to users</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Task Title</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter task title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Describe the task requirements"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    <option>Reporting</option>
                    <option>Performance</option>
                    <option>Monitoring</option>
                    <option>Field Operations</option>
                    <option>Finance</option>
                    <option>Governance</option>
                    <option>Administration</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    <option>LOW</option>
                    <option>MEDIUM</option>
                    <option>HIGH</option>
                    <option>CRITICAL</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Recurrence</label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="ONCE">One-time</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Day (of month)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="25"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assign To</label>
                <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                  <option value="">Select a user...</option>
                  {mockUsers.filter(u => u.role === 'STANDARD').map(u => (
                    <option key={u.id} value={u.id}>{u.name} - {u.department}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{selectedTask.title}</h3>
                  <p className="text-sm text-slate-500 mt-1">{selectedTask.description}</p>
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] uppercase text-slate-500 font-semibold">Category</p>
                  <p className="text-sm font-medium text-slate-800">{selectedTask.category}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] uppercase text-slate-500 font-semibold">Recurrence</p>
                  <p className="text-sm font-medium text-slate-800">{getRecurrenceLabel(selectedTask.recurrence)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] uppercase text-slate-500 font-semibold">Priority</p>
                  <p className="text-sm font-medium text-slate-800">{selectedTask.priority}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] uppercase text-slate-500 font-semibold">Due Day</p>
                  <p className="text-sm font-medium text-slate-800">{selectedTask.dueDay ? `Day ${selectedTask.dueDay}` : 'N/A'}</p>
                </div>
              </div>

              <h4 className="text-sm font-semibold text-slate-800 mb-3">Task Instances</h4>
              <div className="space-y-2">
                {mockTaskInstances
                  .filter(i => i.templateId === selectedTask.id)
                  .map((instance) => (
                    <div key={instance.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className={`w-2 h-2 rounded-full ${
                        instance.status === 'COMPLETED' ? 'bg-emerald-500' :
                        instance.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                        instance.status === 'OVERDUE' ? 'bg-red-500' :
                        instance.status === 'SUBMITTED' ? 'bg-purple-500' : 'bg-slate-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700">{instance.assignee.name}</p>
                        <p className="text-[10px] text-slate-500">{instance.assignee.department}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-500">Due: {instance.dueDate}</p>
                        <span className={`text-[10px] font-bold uppercase ${
                          instance.status === 'COMPLETED' ? 'text-emerald-600' :
                          instance.status === 'OVERDUE' ? 'text-red-600' : 'text-slate-600'
                        }`}>{instance.status}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedTask(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
