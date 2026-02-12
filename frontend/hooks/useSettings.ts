import { useState, useEffect } from 'react';
import { settings } from '@/lib/api';

interface SiteSettings {
  phone_number: string;
  email_address: string;
  facebook_url?: string;
  twitter_url?: string;
  instagram_url?: string;
  company_name?: string;
  redress_scheme_name?: string;
  redress_scheme_number?: string;
  redress_scheme_url?: string;
  cmp_certificate_filename?: string;
  prs_certificate_filename?: string;
  privacy_policy_filename?: string;
  viewing_min_days_advance?: number;
}

export function useSettings() {
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    phone_number: '',
    email_address: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();

    // Listen for settings updates
    const handleSettingsUpdate = () => {
      fetchSettings();
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    };
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await settings.getAll();
      setSiteSettings({
        phone_number: response.data.phone_number || '',
        email_address: response.data.email_address || '',
        facebook_url: response.data.facebook_url || '',
        twitter_url: response.data.twitter_url || '',
        instagram_url: response.data.instagram_url || '',
        company_name: response.data.company_name || '',
        redress_scheme_name: response.data.redress_scheme_name || '',
        redress_scheme_number: response.data.redress_scheme_number || '',
        redress_scheme_url: response.data.redress_scheme_url || '',
        cmp_certificate_filename: response.data.cmp_certificate_filename || '',
        prs_certificate_filename: response.data.prs_certificate_filename || '',
        privacy_policy_filename: response.data.privacy_policy_filename || '',
        viewing_min_days_advance: parseInt(response.data.viewing_min_days_advance, 10) || 2,
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
      // Keep default empty values
    } finally {
      setLoading(false);
    }
  };

  return { siteSettings, loading };
}
