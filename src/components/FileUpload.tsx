import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, File, Image, FileText, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { FileStorageService, StoredFile } from '../services/storage';

interface FileUploadProps {
  taskId?: string;
  uploadedBy?: string;
  onUploadComplete?: (file: StoredFile) => void;
  onDelete?: (fileId: string) => void;
  maxFiles?: number;
  accept?: string;
}

export default function FileUpload({
  taskId,
  uploadedBy,
  onUploadComplete,
  onDelete,
  maxFiles = 5,
}: FileUploadProps) {
  const [files, setFiles] = useState<StoredFile[]>(
    taskId ? FileStorageService.getByTask(taskId) : []
  );
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    await processFiles(droppedFiles);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      await processFiles(selectedFiles);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFiles = async (newFiles: File[]) => {
    setError(null);
    
    if (files.length + newFiles.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setUploading(true);
    const uploaded: StoredFile[] = [];

    for (const file of newFiles) {
      try {
        const stored = await FileStorageService.upload(file, taskId, uploadedBy);
        uploaded.push(stored);
        onUploadComplete?.(stored);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    }

    setFiles(prev => [...prev, ...uploaded]);
    setUploading(false);
  };

  const handleDelete = async (fileId: string) => {
    FileStorageService.delete(fileId);
    setFiles(prev => prev.filter(f => f.id !== fileId));
    onDelete?.(fileId);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-5 h-5 text-purple-500" />;
    if (type === 'application/pdf') return <FileText className="w-5 h-5 text-red-500" />;
    if (type.includes('excel') || type.includes('sheet') || type.includes('csv'))
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    return <File className="w-5 h-5 text-blue-500" />;
  };

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt,.csv"
        />
        <div className="flex flex-col items-center gap-2">
          {uploading ? (
            <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          ) : (
            <Upload className={`w-8 h-8 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
          )}
          <div>
            <p className="text-sm font-medium text-slate-700">
              {uploading ? 'Uploading...' : 'Drop files here or click to browse'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              PDF, DOC, XLS, Images up to 10MB • {files.length}/{maxFiles} files
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 group"
            >
              <div className="flex-shrink-0">
                {FileStorageService.isImage(file.type) ? (
                  <img
                    src={file.dataUrl}
                    alt={file.name}
                    className="w-10 h-10 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-slate-200">
                    {getFileIcon(file.type)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {FileStorageService.formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }}
                  className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
