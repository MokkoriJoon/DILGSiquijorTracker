import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface SiteSettings {
  site_name: string;
  site_description: string;
  logo_url: string;
}

interface SiteSettingsContextType {
  settings: SiteSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: SiteSettings = {
  site_name: 'D.E.N.N.I.S.',
  site_description: 'Digital Ecosystem for Navigation, Notifications, Information, and Schedules',
  logo_url: ''
};

const SiteSettingsContext = createContext<SiteSettingsContextType | undefined>(undefined);

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  async function refreshSettings() {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .single();

      if (error) {
        console.error('Error loading site settings:', error);
        setSettings(defaultSettings);
      } else if (data) {
        setSettings({
          site_name: data.site_name || defaultSettings.site_name,
          site_description: data.site_description || defaultSettings.site_description,
          logo_url: data.logo_url || defaultSettings.logo_url
        });
      }
    } catch (err) {
      console.error('Error fetching site settings:', err);
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshSettings();
  }, []);

  return (
    <SiteSettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  const context = useContext(SiteSettingsContext);
  if (context === undefined) {
    throw new Error('useSiteSettings must be used within a SiteSettingsProvider');
  }
  return context;
}
