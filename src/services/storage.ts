/**
 * File Storage Service
 * 
 * Handles file uploads for task outputs. In development, files are stored
 * as base64 data URLs in localStorage. In production, swap to Supabase Storage.
 * 
 * Production (Supabase Storage):
 * - Use supabase.storage.from('task-outputs').upload(path, file)
 * - Get public URL: supabase.storage.from('task-outputs').getPublicUrl(path)
 */

export interface StoredFile {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string; // Base64 data URL (demo) or public URL (production)
  uploadedAt: string;
  taskId?: string;
  uploadedBy?: string;
}

const FILES_KEY = 'dilg_files';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
];

export const FileStorageService = {
  getAll(): StoredFile[] {
    const data = localStorage.getItem(FILES_KEY);
    return data ? JSON.parse(data) : [];
  },

  getByTask(taskId: string): StoredFile[] {
    return this.getAll().filter(f => f.taskId === taskId);
  },

  getById(id: string): StoredFile | undefined {
    return this.getAll().find(f => f.id === id);
  },

  async upload(file: File, taskId?: string, uploadedBy?: string): Promise<StoredFile> {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type) && file.type !== '') {
      throw new Error(`File type "${file.type}" is not allowed`);
    }

    // Convert to base64 data URL
    const dataUrl = await fileToDataUrl(file);

    const storedFile: StoredFile = {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl,
      uploadedAt: new Date().toISOString(),
      taskId,
      uploadedBy,
    };

    const files = this.getAll();
    files.push(storedFile);

    try {
      localStorage.setItem(FILES_KEY, JSON.stringify(files));
    } catch (e) {
      // localStorage might be full
      throw new Error('Storage limit reached. Please delete some files or use smaller files.');
    }

    return storedFile;
  },

  delete(id: string): boolean {
    const files = this.getAll();
    const filtered = files.filter(f => f.id !== id);
    if (filtered.length === files.length) return false;
    localStorage.setItem(FILES_KEY, JSON.stringify(filtered));
    return true;
  },

  deleteByTask(taskId: string): number {
    const files = this.getAll();
    const taskFiles = files.filter(f => f.taskId === taskId);
    const remaining = files.filter(f => f.taskId !== taskId);
    localStorage.setItem(FILES_KEY, JSON.stringify(remaining));
    return taskFiles.length;
  },

  getStorageUsed(): { used: number; limit: number; percentage: number } {
    const files = this.getAll();
    const used = files.reduce((sum, f) => sum + f.size, 0);
    const limit = 50 * 1024 * 1024; // 50MB demo limit
    return {
      used,
      limit,
      percentage: Math.round((used / limit) * 100),
    };
  },

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  isImage(type: string): boolean {
    return type.startsWith('image/');
  },

  isPdf(type: string): boolean {
    return type === 'application/pdf';
  },

  getFileIcon(type: string): string {
    if (this.isImage(type)) return 'image';
    if (this.isPdf(type)) return 'pdf';
    if (type.includes('word') || type.includes('document')) return 'doc';
    if (type.includes('excel') || type.includes('sheet') || type.includes('csv')) return 'sheet';
    return 'file';
  },
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
