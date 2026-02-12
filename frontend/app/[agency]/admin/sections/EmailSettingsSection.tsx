'use client';

import { useState, useEffect } from 'react';
import { smtp } from '@/lib/api';
import { useAgency } from '@/lib/agency-context';
import { getErrorMessage } from '@/lib/types';
import { SectionProps } from './index';
import { MessageAlert } from '@/components/ui/MessageAlert';

export default function EmailSettingsSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const { agencySlug } = useAgency();
  const [emailMode, setEmailMode] = useState<'platform' | 'custom'>('platform');
  const [formData, setFormData] = useState({
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    from_email: '',
    from_name: '',
    sending_paused: false,
    queue_interval_seconds: 60,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [configured, setConfigured] = useState(false);
  const [platformFromEmail, setPlatformFromEmail] = useState('noreply@letably.com');
  const [platformFromName, setPlatformFromName] = useState('Letably');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await smtp.getSettings();
      setConfigured(response.data.configured);
      setEmailMode(response.data.settings.email_mode || 'platform');
      setPlatformFromEmail(response.data.platform_from_email || 'noreply@letably.com');
      setPlatformFromName(response.data.platform_from_name || 'Letably');

      const settings = response.data.settings || {};
      setFormData({
        host: settings.host || '',
        port: settings.port || 587,
        secure: settings.secure || false,
        username: settings.username || '',
        password: '', // Don't populate password for security
        from_email: settings.from_email || '',
        from_name: settings.from_name || '',
        sending_paused: settings.sending_paused || false,
        queue_interval_seconds: settings.queue_interval_seconds || 60,
      });
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: getErrorMessage(err, 'Failed to load SMTP settings'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = async (newMode: 'platform' | 'custom') => {
    setSavingMode(true);
    setMessage(null);

    try {
      await smtp.updateEmailMode(newMode);
      setEmailMode(newMode);
      setMessage({
        type: 'success',
        text: newMode === 'platform'
          ? 'Now using Letably email service'
          : 'Switched to custom SMTP. Please configure your settings below.',
      });
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: getErrorMessage(err, 'Failed to update email mode'),
      });
    } finally {
      setSavingMode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await smtp.updateSettings(formData);
      setMessage({
        type: 'success',
        text: 'SMTP settings updated successfully!',
      });
      setConfigured(true);
      setEmailMode('custom');

      // Clear password field after save for security
      setFormData({ ...formData, password: '' });
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: getErrorMessage(err, 'Failed to update SMTP settings'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) : value,
    });
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setMessage(null);

    try {
      const response = await smtp.testConnection();
      setMessage({
        type: response.data.success ? 'success' : 'error',
        text: response.data.message,
      });
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: getErrorMessage(err, 'Failed to test SMTP connection'),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!testEmail) {
      setMessage({
        type: 'error',
        text: 'Please enter an email address',
      });
      return;
    }

    setSendingTest(true);
    setMessage(null);

    try {
      const response = await smtp.sendTestEmail(testEmail);
      setMessage({
        type: response.data.success ? 'success' : 'error',
        text: response.data.message,
      });
      if (response.data.success) {
        setTestEmail('');
      }
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: getErrorMessage(err, 'Failed to send test email'),
      });
    } finally {
      setSendingTest(false);
    }
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
      {/* Link to Email Queue */}
      <div className="mb-6 flex items-center justify-end gap-4">
        <button
          onClick={() => onNavigate?.('email-queue')}
          className="text-primary hover:text-primary-dark font-semibold"
        >
          View Email Queue →
        </button>
      </div>

      {message && (
        <MessageAlert type={message.type} message={message.text} className="mb-6" />
      )}

      {/* Email Mode Selection */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Email Service</h2>
        <p className="text-gray-600 mb-6">
          Choose how your agency sends automated emails (tenancy agreements, notifications, etc.)
        </p>

        <div className="space-y-4">
          {/* Platform Email Option */}
          <label
            className={`block p-4 border-2 rounded-lg cursor-pointer transition-colors ${
              emailMode === 'platform'
                ? 'border-primary bg-primary/5'
                : 'border-gray-200 hover:border-gray-300'
            } ${savingMode ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-start gap-4">
              <input
                type="radio"
                name="emailMode"
                value="platform"
                checked={emailMode === 'platform'}
                onChange={() => handleModeChange('platform')}
                disabled={savingMode}
                className="mt-1 w-4 h-4 text-primary border-gray-300 focus:ring-primary"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">Use Letably Email</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Recommended</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Emails will be sent from <strong>{platformFromEmail}</strong>
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  No configuration required. We handle email delivery for you.
                </p>
              </div>
            </div>
          </label>

          {/* Custom SMTP Option */}
          <label
            className={`block p-4 border-2 rounded-lg cursor-pointer transition-colors ${
              emailMode === 'custom'
                ? 'border-primary bg-primary/5'
                : 'border-gray-200 hover:border-gray-300'
            } ${savingMode ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-start gap-4">
              <input
                type="radio"
                name="emailMode"
                value="custom"
                checked={emailMode === 'custom'}
                onChange={() => handleModeChange('custom')}
                disabled={savingMode}
                className="mt-1 w-4 h-4 text-primary border-gray-300 focus:ring-primary"
              />
              <div className="flex-1">
                <span className="font-semibold text-gray-900">Use Custom SMTP</span>
                <p className="text-sm text-gray-600 mt-1">
                  Send emails from your own domain using your SMTP server
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Requires SMTP configuration below. Better for branding.
                </p>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Send Test Email - Available for both modes */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Send Test Email</h2>
        <p className="text-gray-600 mb-4">
          Send a test email to verify your email configuration is working correctly.
          {emailMode === 'platform' && (
            <span className="block mt-1 text-sm">
              Test email will be sent from <strong>{platformFromEmail}</strong>
            </span>
          )}
        </p>

        <form onSubmit={handleSendTestEmail} className="flex gap-4">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="recipient@example.com"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <button
            type="submit"
            disabled={sendingTest}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sendingTest ? 'Sending...' : 'Send Test Email'}
          </button>
        </form>
      </div>

      {/* Custom SMTP Configuration - Only show when custom mode is selected */}
      {emailMode === 'custom' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-2 text-gray-900">Custom SMTP Configuration</h2>
          <p className="text-gray-600 mb-6">
            Configure your SMTP server to send emails from your own domain. All passwords are encrypted and stored securely.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* SMTP Server Configuration */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-medium mb-4 text-gray-900">SMTP Server</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label htmlFor="host" className="block text-sm font-medium text-gray-700 mb-2">
                    SMTP Host <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="host"
                    name="host"
                    value={formData.host}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="smtp.gmail.com"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Your SMTP server hostname
                  </p>
                </div>

                <div>
                  <label htmlFor="port" className="block text-sm font-medium text-gray-700 mb-2">
                    Port <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="port"
                    name="port"
                    value={formData.port}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="587"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Typically 587 (TLS) or 465 (SSL)
                  </p>
                </div>

                <div className="flex items-center pt-8">
                  <input
                    type="checkbox"
                    id="secure"
                    name="secure"
                    checked={formData.secure}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <label htmlFor="secure" className="ml-2 text-sm font-medium text-gray-700">
                    Use SSL (port 465)
                  </label>
                </div>
              </div>
            </div>

            {/* Authentication */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-medium mb-4 text-gray-900">Authentication</h3>

              <div className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="your-email@gmail.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password {!configured && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required={!configured}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder={configured ? 'Leave blank to keep existing password' : 'Your SMTP password'}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    {configured
                      ? 'Leave blank to keep existing password. Password is encrypted and never displayed.'
                      : 'Your password will be encrypted and stored securely.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Sender Information */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-medium mb-4 text-gray-900">Sender Information</h3>

              <div className="space-y-4">
                <div>
                  <label htmlFor="from_email" className="block text-sm font-medium text-gray-700 mb-2">
                    From Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="from_email"
                    name="from_email"
                    value={formData.from_email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="noreply@yourdomain.com"
                  />
                </div>

                <div>
                  <label htmlFor="from_name" className="block text-sm font-medium text-gray-700 mb-2">
                    From Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="from_name"
                    name="from_name"
                    value={formData.from_name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Your Company Name"
                  />
                </div>
              </div>
            </div>

            {/* Queue Configuration */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-medium mb-4 text-gray-900">Queue Configuration</h3>

              <div>
                <label htmlFor="queue_interval_seconds" className="block text-sm font-medium text-gray-700 mb-2">
                  Queue Processing Interval (seconds)
                </label>
                <input
                  type="number"
                  id="queue_interval_seconds"
                  name="queue_interval_seconds"
                  value={formData.queue_interval_seconds}
                  onChange={handleChange}
                  min="10"
                  max="3600"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <p className="mt-1 text-sm text-gray-500">
                  How often emails are sent (10-3600 seconds). Default: 60
                </p>
              </div>

              <div className="mt-4 flex items-center">
                <input
                  type="checkbox"
                  id="sending_paused"
                  name="sending_paused"
                  checked={formData.sending_paused}
                  onChange={handleChange}
                  className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                />
                <label htmlFor="sending_paused" className="ml-2 text-sm font-medium text-gray-700">
                  Pause email sending
                </label>
              </div>
              {formData.sending_paused && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 font-medium">
                    Email sending is paused. Emails will queue but not send.
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4">
              <button
                type="submit"
                disabled={saving}
                className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Save SMTP Settings'}
              </button>

              {configured && (
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              {emailMode === 'platform' ? (
                <>
                  <strong>Using Letably Email:</strong> Your emails are sent through our reliable email infrastructure.
                  Recipients will see emails from {platformFromEmail}.
                </>
              ) : (
                <>
                  <strong>Security Note:</strong> All passwords are encrypted using AES-256-CBC encryption before being stored.
                  Passwords are never displayed and are only decrypted when sending emails.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
