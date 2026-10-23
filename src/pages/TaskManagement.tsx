import React, { useState, useEffect } from 'react';
import { DatabaseService } from '../services/database';
import { useAuth } from '../context/AuthContext';
import type { TaskTemplate } from '../types';
import { Plus, Search, Repeat, Tag, Users, Clock } from 'lucide-react';

export default function TaskManagement() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    const data = await DatabaseService.getTemplates();
    setTemplates(data);
    setLoading(false);
  }

  const filteredTemplates = templates.filter(t =>
    t.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Task Templates</h2>
          <p className="text-sm text-slate-500">Create and manage recurring tasks</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Create Task Template
        </button>
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
            <h3 className="text-sm font-semibold text-slate-700">No task templates yet</h3>
            <p className="text-xs text-slate-500 mt-1">Create your first task template to get started</p>
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
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      <Tag className="w-3 h-3" />
                      {template.category}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
