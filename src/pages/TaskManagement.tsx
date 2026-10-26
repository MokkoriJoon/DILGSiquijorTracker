import React, { useState, useEffect } from 'react';
import { DatabaseService } from '../services/database';
import { useAuth } from '../context/AuthContext';
import type { TaskTemplate, RecurrenceType } from '../types';
import { Plus, Search, Repeat, Tag, Users, Clock, Trash2, ExternalLink, X, Edit2 } from 'lucide-react';

export default function TaskManagement() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskTemplate | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [templatesData, usersData] = await Promise.all([
      DatabaseService.getTemplates(),
      DatabaseService.getUsers(),
    ]);
    setTemplates(templatesData);
    setAllUsers(usersData);
    setLoading(false);
  }

  // Role-based permissions
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = user?.role === 'ADMIN';
  const canManageTasks = isSuperAdmin || isAdmin;

  // Filter templates based on role
  // Super Admin sees all tasks, Admin sees only their own tasks
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = isSuperAdmin || t.createdBy === user?.id;
    return matchesSearch && matchesRole;
  });

  const handleDelete = async (id: string, title: string) => {
    if (confirm(`Delete "${title}"? This will also delete all assigned tasks.`)) {
      await DatabaseService.deleteTemplate(id);
      await loadData();
    }
  };

  // Check if current user can edit this task
  const canEditTask = (task: TaskTemplate) => {
    return isSuperAdmin || task.createdBy === user?.id;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Programs / Tasks / Projects</h2>
          <p className="text-sm text-slate-500">
            {isSuperAdmin ? 'Create and manage tasks, assign to users' :
             isAdmin ? 'Create and manage your own tasks' :
             'View assigned tasks'}
          </p>
        </div>
        {canManageTasks && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Program/Task/Project
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <Tag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-700">No programs/tasks yet</h3>
            <p className="text-xs text-slate-500 mt-1">Create your first program/task/project to get started</p>
          </div>
        ) : (
          filteredTemplates.map((template) => (
            <div key={template.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-800">{template.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{template.description}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      <Repeat className="w-3 h-3" />
                      {template.recurrence}
                      {template.dueDay && ` (Day ${template.dueDay})`}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      <Tag className="w-3 h-3" />
                      {template.category}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      template.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                      template.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                      template.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {template.priority}
                    </span>
                    {template.resourceLink && (
                      <a 
                        href={template.resourceLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Resource Link
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canEditTask(template) && (
                    <>
                      <button
                        onClick={() => setEditingTask(template)}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4 text-blue-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id, template.title)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <CreateTaskModal
          users={allUsers}
          currentUser={user}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadData();
          }}
        />
      )}

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          users={allUsers}
          currentUser={user}
          onClose={() => setEditingTask(null)}
          onUpdated={() => {
            setEditingTask(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

interface CreateTaskModalProps {
  users: any[];
  currentUser: any;
  onClose: () => void;
  onCreated: () => void;
}

function CreateTaskModal({ users, currentUser, onClose, onCreated }: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Reporting');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('ONCE');
  const [dueDay, setDueDay] = useState(25);
  const [dueDate, setDueDate] = useState('');
  const [resourceLink, setResourceLink] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(true); // Toggle for private tasks
  
  // Daily recurrence fields
  const [dueDaysOfWeek, setDueDaysOfWeek] = useState<string[]>([]);
  const [dueTime, setDueTime] = useState('17:00'); // Default 5:00 PM

  // Role-based permissions
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isAdmin = currentUser?.role === 'ADMIN';

  // Both Super Admin and Admin can assign to multiple users
  const availableUsers = users;

  const categories = [
    'Reporting', 'LGU Compliance', 'Barangay Governance', 'Peace & Order',
    'Disaster Preparedness', 'Capacity Building', 'Finance & Budget',
    'Administration', 'Field Operations', 'Performance Review'
  ];

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    console.log('[CreateTask] Starting task creation...');
    console.log('[CreateTask] Form data:', { title, description, category, priority, recurrence, dueDay, dueDate, resourceLink, selectedUsers });

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (selectedUsers.length === 0) {
      setError('Please select at least one user to assign');
      return;
    }
    if (recurrence === 'ONCE' && !dueDate) {
      setError('Due date is required for one-time tasks');
      return;
    }
    if (recurrence === 'DAILY' && dueDaysOfWeek.length === 0) {
      setError('Please select at least one day for daily recurrence');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create the task template
      console.log('[CreateTask] Creating template...');
      const result = await DatabaseService.createTemplate({
        title,
        description,
        recurrence,
        dueDay: recurrence !== 'ONCE' && recurrence !== 'DAILY' ? dueDay : undefined,
        dueDaysOfWeek: recurrence === 'DAILY' ? dueDaysOfWeek as any : undefined,
        dueTime: recurrence === 'DAILY' ? dueTime : undefined,
        category,
        priority,
        resourceLink: resourceLink || undefined,
        visible,
        createdBy: currentUser?.id || '',
      });

      console.log('[CreateTask] Template creation result:', result);

      if (!result.template) {
        const errorMsg = `Failed to create task: ${result.error || 'Unknown error'}`;
        console.error('[CreateTask]', errorMsg);
        setError(errorMsg);
        setLoading(false);
        return;
      }

      const template = result.template;
      console.log('[CreateTask] Template created:', template.id);

      // Save task assignments to task_assignments table
      console.log('[CreateTask] Saving assignments for', selectedUsers.length, 'users...');
      const assignmentsSaved = await DatabaseService.updateTaskAssignments(template.id, selectedUsers);
      
      if (!assignmentsSaved) {
        console.warn('[CreateTask] Failed to save assignments, but continuing...');
      }

      // Create initial instances for each selected user
      console.log('[CreateTask] Creating initial instances for', selectedUsers.length, 'users...');
      for (const userId of selectedUsers) {
        let initialDueDate: string;
        
        if (recurrence === 'ONCE') {
          initialDueDate = dueDate;
        } else if (recurrence === 'DAILY') {
          // For daily tasks, find the next occurrence based on selected days
          initialDueDate = calculateNextDailyDueDate(dueDaysOfWeek, dueTime);
        } else {
          initialDueDate = calculateNextDueDate(recurrence, dueDay);
        }

        const instanceResult = await DatabaseService.createInstance({
          templateId: template.id,
          assignedTo: userId,
          dueDate: initialDueDate,
          status: 'PENDING',
        });

        if (!instanceResult) {
          console.warn('[CreateTask] Failed to create instance for user:', userId);
        }
      }

      console.log('[CreateTask] Task creation complete!');
      onCreated();
    } catch (err) {
      const errorMsg = 'Failed to create task: ' + (err instanceof Error ? err.message : 'Unknown error');
      console.error('[CreateTask] Exception:', err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const calculateNextDueDate = (recurrence: RecurrenceType, day: number): string => {
    const now = new Date();
    let target = new Date(now);
    
    switch (recurrence) {
      case 'DAILY':
        target.setDate(now.getDate() + 1);
        break;
      case 'WEEKLY':
        target.setDate(now.getDate() + 7);
        break;
      case 'MONTHLY':
        target.setMonth(now.getMonth() + 1);
        target.setDate(day);
        if (target < now) target.setMonth(target.getMonth() + 1);
        break;
      case 'QUARTERLY':
        target.setMonth(now.getMonth() + 3);
        target.setDate(day);
        if (target < now) target.setMonth(target.getMonth() + 3);
        break;
      case 'YEARLY':
        target.setFullYear(now.getFullYear() + 1);
        target.setDate(day);
        if (target < now) target.setFullYear(target.getFullYear() + 1);
        break;
      default:
        target.setDate(now.getDate() + 7);
    }
    
    return target.toISOString().split('T')[0];
  };

  const calculateNextDailyDueDate = (daysOfWeek: string[], dueTime: string): string => {
    const now = new Date();
    const dayMap: { [key: string]: number } = {
      'SUNDAY': 0,
      'MONDAY': 1,
      'TUESDAY': 2,
      'WEDNESDAY': 3,
      'THURSDAY': 4,
      'FRIDAY': 5,
      'SATURDAY': 6,
    };

    // If no days selected, default to tomorrow
    if (daysOfWeek.length === 0) {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }

    // Find the next occurrence of any selected day
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(now.getDate() + i);
      const dayOfWeek = checkDate.getDay();
      
      const selectedDayNumbers = daysOfWeek.map(d => dayMap[d]);
      if (selectedDayNumbers.includes(dayOfWeek)) {
        return checkDate.toISOString().split('T')[0];
      }
    }

    // Fallback to tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Add Program / Task / Project</h3>
            <p className="text-sm text-slate-500">Create a new task and assign to users</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-red-600 font-bold">⚠️ Error:</span>
                <div className="flex-1">
                  <p className="text-sm text-red-800 font-medium">{error}</p>
                  <p className="text-xs text-red-600 mt-2">
                    Check browser console (F12) for detailed error logs
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Monthly Accomplishment Report"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Describe the task requirements..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Recurrence</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="ONCE">One-time</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>
            {recurrence === 'ONCE' ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due Date *</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ) : recurrence === 'DAILY' ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due Time</label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">Time when task is due (24-hour format)</p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due Day of Month</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={dueDay}
                  onChange={(e) => setDueDay(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="25"
                />
              </div>
            )}
          </div>

          {/* Daily Recurrence - Day Selection */}
          {recurrence === 'DAILY' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Recur on which days? *
              </label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dueDaysOfWeek.includes('MONDAY')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDueDaysOfWeek([...dueDaysOfWeek, 'MONDAY']);
                      } else {
                        setDueDaysOfWeek(dueDaysOfWeek.filter(d => d !== 'MONDAY'));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Monday</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dueDaysOfWeek.includes('TUESDAY')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDueDaysOfWeek([...dueDaysOfWeek, 'TUESDAY']);
                      } else {
                        setDueDaysOfWeek(dueDaysOfWeek.filter(d => d !== 'TUESDAY'));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Tuesday</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dueDaysOfWeek.includes('WEDNESDAY')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDueDaysOfWeek([...dueDaysOfWeek, 'WEDNESDAY']);
                      } else {
                        setDueDaysOfWeek(dueDaysOfWeek.filter(d => d !== 'WEDNESDAY'));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Wednesday</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dueDaysOfWeek.includes('THURSDAY')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDueDaysOfWeek([...dueDaysOfWeek, 'THURSDAY']);
                      } else {
                        setDueDaysOfWeek(dueDaysOfWeek.filter(d => d !== 'THURSDAY'));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Thursday</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dueDaysOfWeek.includes('FRIDAY')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDueDaysOfWeek([...dueDaysOfWeek, 'FRIDAY']);
                      } else {
                        setDueDaysOfWeek(dueDaysOfWeek.filter(d => d !== 'FRIDAY'));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Friday</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dueDaysOfWeek.includes('SATURDAY')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDueDaysOfWeek([...dueDaysOfWeek, 'SATURDAY']);
                      } else {
                        setDueDaysOfWeek(dueDaysOfWeek.filter(d => d !== 'SATURDAY'));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Saturday</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dueDaysOfWeek.includes('SUNDAY')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDueDaysOfWeek([...dueDaysOfWeek, 'SUNDAY']);
                      } else {
                        setDueDaysOfWeek(dueDaysOfWeek.filter(d => d !== 'SUNDAY'));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Sunday</span>
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDueDaysOfWeek(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'])}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Monday-Friday
                </button>
                <button
                  type="button"
                  onClick={() => setDueDaysOfWeek(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Whole Week
                </button>
                <button
                  type="button"
                  onClick={() => setDueDaysOfWeek([])}
                  className="px-3 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                >
                  Clear
                </button>
              </div>
              <p className="text-xs text-blue-700 mt-2">
                Select which days of the week this task should recur
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Resource Link (Google Drive, etc.)
            </label>
            <input
              type="url"
              value={resourceLink}
              onChange={(e) => setResourceLink(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="https://drive.google.com/..."
            />
            <p className="text-xs text-slate-500 mt-1">
              Optional: Link to shared folder where task outputs are stored
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={visible}
                onChange={(e) => setVisible(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">Visible</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {visible 
                    ? 'Task is visible to everyone and counts in total statistics' 
                    : 'Task is private - only visible to assigned users and not counted in statistics'}
                </p>
              </div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Assign to Users * ({selectedUsers.length} selected)
            </label>
            <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
              {availableUsers.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  No users registered yet
                </div>
              ) : (
                availableUsers.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(u.id)}
                      onChange={() => toggleUser(u.id)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-700">{u.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.department}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      u.role === 'ADMIN' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {u.role}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create & Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditTaskModal({ task, users, currentUser, onClose, onUpdated }: { 
  task: TaskTemplate; 
  users: any[]; 
  currentUser: any; 
  onClose: () => void; 
  onUpdated: () => void; 
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [category, setCategory] = useState(task.category);
  const [priority, setPriority] = useState(task.priority);
  const [recurrence, setRecurrence] = useState(task.recurrence);
  const [dueDay, setDueDay] = useState(task.dueDay || 25);
  const [resourceLink, setResourceLink] = useState(task.resourceLink || '');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load current assignments
  useEffect(() => {
    loadCurrentAssignments();
  }, [task.id]);

  async function loadCurrentAssignments() {
    const instances = await DatabaseService.getInstancesByTemplate(task.id);
    const userIds = instances.map((inst: any) => inst.assignedTo);
    setSelectedUsers(userIds);
  }

  const categories = [
    'Reporting', 'LGU Compliance', 'Barangay Governance', 'Peace & Order',
    'Disaster Preparedness', 'Capacity Building', 'Finance & Budget',
    'Administration', 'Field Operations', 'Performance Review'
  ];

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (selectedUsers.length === 0) {
      setError('Please select at least one user to assign');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Update task template
      const result = await DatabaseService.updateTemplate(task.id, {
        title,
        description,
        recurrence,
        dueDay: recurrence !== 'ONCE' ? dueDay : undefined,
        category,
        priority,
        resourceLink: resourceLink || undefined,
      });

      if (!result) {
        setError('Failed to update task');
        setLoading(false);
        return;
      }

      // Update assignments
      await DatabaseService.updateTaskAssignments(task.id, selectedUsers);

      onUpdated();
    } catch (err) {
      setError('Failed to update task: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Edit Program / Task / Project</h3>
            <p className="text-sm text-slate-500">Update task details</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-red-600 font-bold">⚠️ Error:</span>
                <div className="flex-1">
                  <p className="text-sm text-red-800 font-medium">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Monthly Accomplishment Report"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Describe the task requirements..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Recurrence</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="ONCE">One-time</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>
            {recurrence !== 'ONCE' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due Day of Month</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={dueDay}
                  onChange={(e) => setDueDay(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="25"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Resource Link (Google Drive, etc.)
            </label>
            <input
              type="url"
              value={resourceLink}
              onChange={(e) => setResourceLink(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="https://drive.google.com/..."
            />
            <p className="text-xs text-slate-500 mt-1">
              Link to shared folder where task outputs are stored
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Assigned Users ({selectedUsers.length} selected)
            </label>
            <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
              {users.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  No users registered yet
                </div>
              ) : (
                users.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(u.id)}
                      onChange={() => toggleUser(u.id)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-700">{u.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.department}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      u.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' :
                      u.role === 'ADMIN' ? 'bg-amber-100 text-amber-700' : 
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {u.role === 'SUPER_ADMIN' ? 'Super Admin' : 
                       u.role === 'ADMIN' ? 'Admin' : 'Standard'}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
