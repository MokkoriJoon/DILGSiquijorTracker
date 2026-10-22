import { supabase } from '../lib/supabase';

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  path: string;
  taskId?: string;
  uploadedBy?: string;
  createdAt: string;
}

/**
 * Supabase Storage Service
 * Handles file uploads and management using Supabase Storage
 */
export const supabaseStorageService = {
  /**
   * Upload a file to Supabase Storage
   */
  async uploadFile(
    file: File,
    taskId?: string,
    uploadedBy?: string
  ): Promise<UploadedFile | null> {
    try {
      // Create unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = taskId ? `${taskId}/${fileName}` : fileName;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('task-outputs')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('task-outputs')
        .getPublicUrl(filePath);

      // Insert file record into database
      const { data: fileRecord, error: insertError } = await supabase
        .from('uploaded_files')
        .insert({
          name: file.name,
          type: file.type,
          size: file.size,
          url: urlData.publicUrl,
          path: filePath,
          task_id: taskId,
          uploaded_by: uploadedBy,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error saving file record:', insertError);
        // Try to delete the uploaded file
        await supabase.storage.from('task-outputs').remove([filePath]);
        return null;
      }

      return {
        id: fileRecord.id,
        name: fileRecord.name,
        type: fileRecord.type,
        size: fileRecord.size,
        url: fileRecord.url,
        path: fileRecord.path,
        taskId: fileRecord.task_id,
        uploadedBy: fileRecord.uploaded_by,
        createdAt: fileRecord.created_at,
      };
    } catch (error) {
      console.error('Error in uploadFile:', error);
      return null;
    }
  },

  /**
   * Get all files for a specific task
   */
  async getFilesByTask(taskId: string): Promise<UploadedFile[]> {
    const { data, error } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching files:', error);
      return [];
    }

    return data.map((file: any) => ({
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      url: file.url,
      path: file.path,
      taskId: file.task_id,
      uploadedBy: file.uploaded_by,
      createdAt: file.created_at,
    }));
  },

  /**
   * Delete a file from storage and database
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      // Get file record to get the path
      const { data: fileRecord, error: fetchError } = await supabase
        .from('uploaded_files')
        .select('path')
        .eq('id', fileId)
        .single();

      if (fetchError || !fileRecord) {
        console.error('Error fetching file record:', fetchError);
        return false;
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('task-outputs')
        .remove([fileRecord.path]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        return false;
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('uploaded_files')
        .delete()
        .eq('id', fileId);

      if (deleteError) {
        console.error('Error deleting file record:', deleteError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteFile:', error);
      return false;
    }
  },

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{ used: number; fileCount: number }> {
    const { data, error } = await supabase
      .from('uploaded_files')
      .select('size');

    if (error) {
      console.error('Error fetching storage stats:', error);
      return { used: 0, fileCount: 0 };
    }

    const used = data.reduce((sum: number, file: any) => sum + file.size, 0);
    return {
      used,
      fileCount: data.length,
    };
  },

  /**
   * Check if file type is an image
   */
  isImage(type: string): boolean {
    return type.startsWith('image/');
  },

  /**
   * Check if file type is a PDF
   */
  isPdf(type: string): boolean {
    return type === 'application/pdf';
  },

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
};
