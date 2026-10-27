import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { supabase } from '../lib/supabase';
import { Settings, Save, Image, Type, FileText, CheckCircle2, Upload } from 'lucide-react';
import { compressImage, formatFileSize, getCompressionRatio } from '../utils/imageCompression';

interface SiteSettings {
  site_name: string;
  site_description: string;
  logo_url: string;
}

export default function SiteSettingsPage() {
  const { user } = useAuth();
  const { refreshSettings } = useSiteSettings();
  const [settings, setSettings] = useState<SiteSettings>({
    site_name: 'D.E.N.N.I.S.',
    site_description: 'Digital Ecosystem for Navigation, Notifications, Information, and Schedules',
    logo_url: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading settings:', error);
        setMessage({ type: 'error', text: 'Failed to load settings' });
      } else if (data) {
        setSettings({
          site_name: data.site_name || 'D.E.N.N.I.S.',
          site_description: data.site_description || 'Digital Ecosystem for Navigation, Notifications, Information, and Schedules',
          logo_url: data.logo_url || ''
        });
      }
    } catch (err) {
      console.error('Error:', err);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({
          id: 1, // Single row for site settings
          site_name: settings.site_name,
          site_description: settings.site_description,
          logo_url: settings.logo_url,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (error) {
        throw error;
      }

      // Refresh the global site settings context
      await refreshSettings();

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    }

    setSaving(false);
  }

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type - explicitly accept PNG, JPEG, JPG, WebP, SVG
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Please upload a PNG, JPEG, WebP, or SVG image' });
      return;
    }

    // Validate file size (max 5MB before compression)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image must be less than 5MB' });
      return;
    }

    try {
      setMessage({ type: 'success', text: 'Compressing image...' });

      // Compress image (skip for SVG as it's already optimized)
      let fileToUpload: File | Blob = file;
      let compressionInfo = '';

      if (file.type !== 'image/svg+xml') {
        const originalSize = file.size;
        
        // Determine output format - preserve PNG transparency
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/webp';
        
        fileToUpload = await compressImage(file, {
          maxWidth: 800,
          maxHeight: 800,
          quality: 0.8,
          outputType: outputType as any
        });

        const compressedSize = fileToUpload.size;
        const ratio = getCompressionRatio(originalSize, compressedSize);
        compressionInfo = ` (${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)}, ${ratio} smaller)`;
      }

      setMessage({ type: 'success', text: 'Uploading logo...' });

      // Determine file extension
      const fileExt = fileToUpload.type.split('/')[1] || 'png';
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `site/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('site-assets')
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
          contentType: fileToUpload.type
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('site-assets')
        .getPublicUrl(filePath);

      setSettings({ ...settings, logo_url: publicUrl });
      setMessage({ type: 'success', text: `Logo uploaded successfully${compressionInfo}!` });
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      console.error('Error uploading logo:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      // Provide helpful error messages
      if (errorMessage.includes('bucket') || errorMessage.includes('storage')) {
        setMessage({ 
          type: 'error', 
          text: 'Storage bucket not found. Please create "site-assets" bucket in Supabase Dashboard → Storage' 
        });
      } else if (errorMessage.includes('policy') || errorMessage.includes('permission')) {
        setMessage({ 
          type: 'error', 
          text: 'Permission denied. Please check storage bucket RLS policies in Supabase' 
        });
      } else {
        setMessage({ type: 'error', text: `Failed to upload logo: ${errorMessage}` });
      }
    }
  }

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
      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold">Site Settings</h1>
            <p className="text-purple-100 text-sm mt-1">
              Customize your website appearance and branding
            </p>
          </div>
        </div>
      </div>

      {/* Message Alert */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <span>⚠️</span>
            )}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        </div>
      )}

      {/* Settings Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        {/* Site Name */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2">
            <Type className="w-4 h-4" />
            Site Name
          </label>
          <input
            type="text"
            value={settings.site_name}
            onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="D.E.N.N.I.S."
          />
          <p className="text-xs text-slate-500 mt-1">
            This will appear in the header and browser title
          </p>
        </div>

        {/* Site Description */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2">
            <FileText className="w-4 h-4" />
            Site Description
          </label>
          <textarea
            value={settings.site_description}
            onChange={(e) => setSettings({ ...settings, site_description: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            placeholder="Digital Ecosystem for Navigation, Notifications, Information, and Schedules"
          />
          <p className="text-xs text-slate-500 mt-1">
            Brief description shown in the public dashboard
          </p>
        </div>

        {/* Logo Upload */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2">
            <Image className="w-4 h-4" />
            Site Logo
          </label>
          
          {settings.logo_url && (
            <div className="mb-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-600 mb-2">Current Logo:</p>
              <img 
                src={settings.logo_url} 
                alt="Site Logo" 
                className="h-16 w-auto object-contain"
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="flex-1 cursor-pointer">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600">Click to upload logo</p>
                <p className="text-xs text-slate-500 mt-1">PNG (with transparency), JPEG, WebP, SVG</p>
                <p className="text-xs text-blue-600 mt-1 font-medium">✨ Auto-compressed for optimization</p>
                <p className="text-xs text-slate-400 mt-1">Max 5MB before compression</p>
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t border-slate-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Settings className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-800">About Site Settings</h4>
            <p className="text-xs text-blue-700 mt-1">
              These settings affect the entire website. Changes will be visible to all users immediately after saving.
              Only Super Admins can modify these settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
