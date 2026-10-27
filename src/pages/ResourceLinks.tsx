import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { DatabaseService } from '../services/database';
import type { TaskInstance } from '../types';
import { ExternalLink, Link as LinkIcon, Calendar, Tag, CheckCircle2, Clock, AlertTriangle, Bookmark, Plus, Edit2, Trash2 } from 'lucide-react';

export default function ResourceLinks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    if (!user) return;
    setLoading(true);
    
    // Load task resource links
    const data = await DatabaseService.getInstancesByUser(user.id);
    const tasksWithLinks = data.filter(task => task.template?.resourceLink);
    setTasks(tasksWithLinks);
    
    // Load personal bookmarks
    const bookmarksData = await DatabaseService.getPersonalBookmarks(user.id);
    setBookmarks(bookmarksData);
    
    setLoading(false);
  }

  async function handleDeleteBookmark(id: string) {
    if (!confirm('Delete this bookmark?')) return;
    
    const success = await DatabaseService.deletePersonalBookmark(id);
    if (success) {
      setBookmarks(bookmarks.filter(b => b.id !== id));
    }
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
                        {task.template?.dueTime && <span className="ml-1 text-blue-600 font-medium">at {task.template.dueTime}</span>}
                      </span>
                      {task.template?.startDate && task.template?.recurrence === 'DAILY' && (
                        <span className="inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                          <Clock className="w-3 h-3" />
                          Starts: {task.template.startDate}
                        </span>
                      )}
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

      {/* Personal Bookmarks Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-semibold text-slate-800">Personal Bookmarks</h3>
          </div>
          <button
            onClick={() => {
              setEditingBookmark(null);
              setShowBookmarkModal(true);
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Bookmark
          </button>
        </div>

        {bookmarks.length === 0 ? (
          <div className="text-center py-8">
            <Bookmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No personal bookmarks yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Add your favorite links for quick access
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                className="border border-slate-200 rounded-lg p-3 hover:shadow-md transition-all bg-amber-50/30"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="text-sm font-semibold text-slate-800 truncate flex-1">
                    {bookmark.title}
                  </h4>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingBookmark(bookmark);
                        setShowBookmarkModal(true);
                      }}
                      className="p-1 hover:bg-blue-100 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                    </button>
                    <button
                      onClick={() => handleDeleteBookmark(bookmark.id)}
                      className="p-1 hover:bg-red-100 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
                
                {bookmark.description && (
                  <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                    {bookmark.description}
                  </p>
                )}
                
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    {bookmark.category}
                  </span>
                </div>

                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors w-full justify-center"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Link
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bookmark Modal */}
      {showBookmarkModal && (
        <BookmarkModal
          bookmark={editingBookmark}
          userId={user?.id || ''}
          onClose={() => {
            setShowBookmarkModal(false);
            setEditingBookmark(null);
          }}
          onSaved={() => {
            setShowBookmarkModal(false);
            setEditingBookmark(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function BookmarkModal({ bookmark, userId, onClose, onSaved }: {
  bookmark: any;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(bookmark?.title || '');
  const [url, setUrl] = useState(bookmark?.url || '');
  const [description, setDescription] = useState(bookmark?.description || '');
  const [category, setCategory] = useState(bookmark?.category || 'General');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const categories = ['General', 'Work', 'Reference', 'Tools', 'Learning', 'Other'];

  const handleSubmit = async () => {
    if (!title.trim() || !url.trim()) {
      setError('Title and URL are required');
      return;
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (bookmark) {
        // Update existing bookmark
        const result = await DatabaseService.updatePersonalBookmark(bookmark.id, {
          title,
          url,
          description,
          category,
        });

        if (!result.success) {
          setError(result.error || 'Failed to update bookmark');
          setLoading(false);
          return;
        }
      } else {
        // Create new bookmark
        const result = await DatabaseService.createPersonalBookmark({
          userId,
          title,
          url,
          description,
          category,
        });

        if (!result.success) {
          setError(result.error || 'Failed to create bookmark');
          setLoading(false);
          return;
        }
      }

      onSaved();
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">
            {bookmark ? 'Edit Bookmark' : 'Add Bookmark'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <span className="text-xl">×</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
              placeholder="My Favorite Link"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">URL *</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 resize-none"
              placeholder="Optional description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
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
            className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? 'Saving...' : bookmark ? 'Update' : 'Add Bookmark'}
          </button>
        </div>
      </div>
    </div>
  );
}
