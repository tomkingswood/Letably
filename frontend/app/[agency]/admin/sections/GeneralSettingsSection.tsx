'use client';

import { useState, useEffect } from 'react';
import { settings, agencies } from '@/lib/api';
import { useAgency } from '@/lib/agency-context';
import { SectionProps } from './index';
import { MessageAlert } from '@/components/ui/MessageAlert';

interface SettingsData {
  company_name: string;
  phone_number: string;
  email_address: string;
  facebook_url: string;
  twitter_url: string;
  instagram_url: string;
  redress_scheme_name: string;
  redress_scheme_number: string;
  redress_scheme_url: string;
  viewing_min_days_advance: string;
  holding_deposit_enabled: string;
  holding_deposit_type: string;
  holding_deposit_amount: string;
}

const defaultSettings: SettingsData = {
  company_name: '',
  phone_number: '',
  email_address: '',
  facebook_url: '',
  twitter_url: '',
  instagram_url: '',
  redress_scheme_name: '',
  redress_scheme_number: '',
  redress_scheme_url: '',
  viewing_min_days_advance: '2',
  holding_deposit_enabled: 'false',
  holding_deposit_type: '1_week_pppw',
  holding_deposit_amount: '100',
};

interface BrandingData {
  primary_color: string;
  secondary_color: string;
  logo_url: string;
  show_powered_by: boolean;
}

const defaultBranding: BrandingData = {
  primary_color: '#1E3A5F',
  secondary_color: '#2563eb',
  logo_url: '',
  show_powered_by: true,
};

export default function GeneralSettingsSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const { agency, agencySlug, refreshAgency } = useAgency();
  const [formData, setFormData] = useState<SettingsData>(defaultSettings);
  const [branding, setBranding] = useState<BrandingData>(defaultBranding);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (agency) {
      setBranding({
        primary_color: agency.primary_color || '#1E3A5F',
        secondary_color: agency.secondary_color || '#2563eb',
        logo_url: agency.logo_url || '',
        show_powered_by: agency.show_powered_by !== false,
      });
    }
  }, [agency]);

  const fetchData = async () => {
    try {
      const settingsRes = await settings.getAll();
      setFormData({ ...defaultSettings, ...settingsRes.data });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to load settings',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await Promise.all([
        settings.update(formData),
        agencies.updateBranding({ ...branding, show_powered_by: true }),
      ]);
      setMessage({ type: 'success', text: 'Settings updated successfully!' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      try { await refreshAgency(); } catch { /* settings saved; context refresh is best-effort */ }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to update settings',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleBrandingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setBranding({ ...branding, [name]: type === 'checkbox' ? checked : value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">General Settings</h2>
          <p className="text-gray-600">Configure your agency's company information and branding</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const form = document.getElementById('settings-form') as HTMLFormElement;
            form?.requestSubmit();
          }}
          disabled={saving}
          className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {message && (
        <MessageAlert type={message.type} message={message.text} className="mb-6" />
      )}

      <form id="settings-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Branding Settings */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Branding</h3>
          <p className="text-gray-600 text-sm mb-4">Customise your agency's colours and logo</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="primary_color" className="block text-sm font-medium text-gray-700 mb-2">
              Primary Colour
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                id="primary_color"
                name="primary_color"
                value={branding.primary_color}
                onChange={handleBrandingChange}
                className="w-12 h-12 rounded cursor-pointer border border-gray-300"
              />
              <input
                type="text"
                value={branding.primary_color}
                onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
                placeholder="#1E3A5F"
              />
            </div>
          </div>

          <div>
            <label htmlFor="secondary_color" className="block text-sm font-medium text-gray-700 mb-2">
              Secondary Colour
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                id="secondary_color"
                name="secondary_color"
                value={branding.secondary_color}
                onChange={handleBrandingChange}
                className="w-12 h-12 rounded cursor-pointer border border-gray-300"
              />
              <input
                type="text"
                value={branding.secondary_color}
                onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
                placeholder="#2563eb"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
            <div className="flex items-center gap-4">
              {branding.logo_url ? (
                <div className="w-24 h-24 border border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                  <img src={branding.logo_url} alt="Agency logo" className="max-w-full max-h-full object-contain" />
                </div>
              ) : (
                <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                  <span className="text-gray-400 text-sm">No logo</span>
                </div>
              )}
              <div className="flex-1">
                <input
                  type="text"
                  value={branding.logo_url}
                  onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="https://example.com/logo.png"
                />
                <p className="mt-1 text-sm text-gray-500">Enter a URL to your logo image</p>
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="show_powered_by"
                checked={true}
                disabled
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-not-allowed"
              />
              <span className="text-sm font-medium text-gray-700">Show "Powered by Letably" in footer</span>
            </label>
            <p className="mt-1 ml-7 text-sm text-gray-500">
              To remove Letably branding, please <a href="mailto:hello@letably.co.uk" className="text-primary hover:underline font-medium">contact us</a> for white-label pricing.
            </p>
          </div>
        </div>

        </div>

        {/* Company Information */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Company Information</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 mb-2">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="company_name"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Your Company Name"
              />
            </div>

            <div>
              <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                id="phone_number"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="0121 123 4567"
              />
            </div>

            <div>
              <label htmlFor="email_address" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email_address"
                name="email_address"
                value={formData.email_address}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="contact@yourcompany.com"
              />
            </div>
          </div>
        </div>

        {/* Social Media Links */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Social Media Links</h3>
          <p className="text-gray-600 text-sm mb-4">Optional links to your social media profiles</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="facebook_url" className="block text-sm font-medium text-gray-700 mb-2">Facebook URL</label>
              <input
                type="url"
                id="facebook_url"
                name="facebook_url"
                value={formData.facebook_url}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="https://facebook.com/yourpage"
              />
            </div>
            <div>
              <label htmlFor="twitter_url" className="block text-sm font-medium text-gray-700 mb-2">Twitter/X URL</label>
              <input
                type="url"
                id="twitter_url"
                name="twitter_url"
                value={formData.twitter_url}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="https://twitter.com/yourhandle"
              />
            </div>
            <div>
              <label htmlFor="instagram_url" className="block text-sm font-medium text-gray-700 mb-2">Instagram URL</label>
              <input
                type="url"
                id="instagram_url"
                name="instagram_url"
                value={formData.instagram_url}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="https://instagram.com/yourhandle"
              />
            </div>
          </div>
        </div>

        {/* Redress Scheme */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Redress Scheme</h3>
          <p className="text-gray-600 text-sm mb-4">Your property redress scheme membership details</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="redress_scheme_name" className="block text-sm font-medium text-gray-700 mb-2">Scheme Name</label>
              <input
                type="text"
                id="redress_scheme_name"
                name="redress_scheme_name"
                value={formData.redress_scheme_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="The Property Ombudsman"
              />
            </div>
            <div>
              <label htmlFor="redress_scheme_number" className="block text-sm font-medium text-gray-700 mb-2">Membership Number</label>
              <input
                type="text"
                id="redress_scheme_number"
                name="redress_scheme_number"
                value={formData.redress_scheme_number}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="12345"
              />
            </div>
            <div>
              <label htmlFor="redress_scheme_url" className="block text-sm font-medium text-gray-700 mb-2">Scheme Website</label>
              <input
                type="url"
                id="redress_scheme_url"
                name="redress_scheme_url"
                value={formData.redress_scheme_url}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="https://www.tpos.co.uk"
              />
            </div>
          </div>
        </div>

        {/* Viewing Settings */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Viewing Settings</h3>

          <div>
            <label htmlFor="viewing_min_days_advance" className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Days Advance for Viewings
            </label>
            <input
              type="number"
              id="viewing_min_days_advance"
              name="viewing_min_days_advance"
              value={formData.viewing_min_days_advance}
              onChange={handleChange}
              min="1"
              max="14"
              className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">How many days in advance must viewings be booked (1-14 days)</p>
          </div>
        </div>

        {/* Holding Deposit Settings */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Holding Deposits</h3>
          <p className="text-gray-600 text-sm mb-4">
            Configure whether a holding deposit is required before approving applications
          </p>

          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.holding_deposit_enabled === 'true'}
                onChange={(e) => setFormData({ ...formData, holding_deposit_enabled: e.target.checked ? 'true' : 'false' })}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <span className="text-sm font-medium text-gray-700">
                Require holding deposit for application approval
              </span>
            </label>

            {formData.holding_deposit_enabled === 'true' && (
              <div className="ml-7 space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Deposit Amount Type</p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="holding_deposit_type"
                        value="1_week_pppw"
                        checked={formData.holding_deposit_type === '1_week_pppw'}
                        onChange={(e) => setFormData({ ...formData, holding_deposit_type: e.target.value })}
                        className="text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">1 week&apos;s rent (PPPW from bedroom)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="holding_deposit_type"
                        value="fixed_amount"
                        checked={formData.holding_deposit_type === 'fixed_amount'}
                        onChange={(e) => setFormData({ ...formData, holding_deposit_type: e.target.value })}
                        className="text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">Fixed amount</span>
                    </label>
                  </div>
                </div>

                {formData.holding_deposit_type === 'fixed_amount' && (
                  <div>
                    <label htmlFor="holding_deposit_amount" className="block text-sm font-medium text-gray-700 mb-2">
                      Fixed Amount
                    </label>
                    <div className="relative w-40">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">&pound;</span>
                      <input
                        type="number"
                        id="holding_deposit_amount"
                        name="holding_deposit_amount"
                        value={formData.holding_deposit_amount}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
