'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAgency } from '@/lib/agency-context';
import Link from 'next/link';
import { reminders as remindersApi, properties as propertiesApi } from '@/lib/api';
import AdminPageLoading from '@/components/admin/AdminPageLoading';
import { getErrorMessage } from '@/lib/types';
import Button from '@/components/ui/Button';
import { MessageAlert } from '@/components/ui/MessageAlert';
import { formatDateLong } from '@/lib/dateUtils';

interface ManualReminder {
  id: number;
  title: string;
  description: string;
  reminder_date: string;
  severity: 'low' | 'medium' | 'critical';
  property_id: number | null;
  property_address: string | null;
  is_dismissed: boolean;
  created_at: string;
  created_by_email: string | null;
}

interface Property {
  id: number;
  address_line1: string;
  address_line2?: string;
  city?: string;
  postcode?: string;
}

export default function ManageManualRemindersPage() {
  const router = useRouter();
  const { agencySlug } = useAgency();
  const [reminders, setReminders] = useState<ManualReminder[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    reminder_date: '',
    severity: 'medium' as 'low' | 'medium' | 'critical',
    property_id: '',
  });
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    reminder_date: '',
    severity: 'medium' as 'low' | 'medium' | 'critical',
    property_id: '',
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchReminders();
    fetchProperties();
  }, []);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const response = await remindersApi.getAllManual();
      setReminders(response.data);
      setError('');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to fetch reminders'));
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await propertiesApi.getAll();
      setProperties(response.data.properties || []);
    } catch (err: unknown) {
      console.error('Failed to fetch properties:', err);
    }
  };

  const startEdit = (reminder: ManualReminder) => {
    setEditingId(reminder.id);
    setEditForm({
      title: reminder.title,
      description: reminder.description || '',
      reminder_date: reminder.reminder_date,
      severity: reminder.severity,
      property_id: reminder.property_id ? reminder.property_id.toString() : '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      title: '',
      description: '',
      reminder_date: '',
      severity: 'medium',
      property_id: '',
    });
  };

  const saveEdit = async (id: number) => {
    try {
      await remindersApi.updateManual(id, {
        ...editForm,
        property_id: editForm.property_id ? parseInt(editForm.property_id) : null,
      });
      await fetchReminders();
      cancelEdit();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update reminder'));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await remindersApi.createManual({
        title: createForm.title,
        description: createForm.description || undefined,
        reminder_date: createForm.reminder_date,
        severity: createForm.severity,
        property_id: createForm.property_id ? parseInt(createForm.property_id) : undefined,
      });
      setSuccess('Manual reminder created successfully');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setShowCreateForm(false);
      setCreateForm({
        title: '',
        description: '',
        reminder_date: '',
        severity: 'medium',
        property_id: '',
      });
      await fetchReminders();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create reminder'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this reminder?')) return;

    try {
      await remindersApi.deleteManual(id);
      setSuccess('Reminder deleted successfully');
      await fetchReminders();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete reminder'));
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      medium: 'bg-orange-100 text-orange-800 border-orange-200',
      low: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    };
    return colors[severity as keyof typeof colors] || colors.medium;
  };

  const getDaysUntil = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reminderDate = new Date(dateString);
    reminderDate.setHours(0, 0, 0, 0);
    const days = Math.ceil((reminderDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    return `In ${days} days`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminPageLoading text="Loading reminders..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-primary text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">Manage Manual Reminders</h1>
              <p className="text-xl text-white/90">View and edit all manual reminders</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {!showCreateForm && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Reminder
                </button>
              )}
              <button
                onClick={() => router.push(`/${agencySlug}/admin`)}
                className="bg-white text-primary hover:bg-gray-100 px-6 py-2 rounded-lg font-semibold transition-colors w-full sm:w-auto"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Link
              href={`/${agencySlug}/admin?section=reminders`}
              className="text-primary hover:text-orange-700 font-semibold"
            >
              ← Back to Reminders
            </Link>
            {showCreateForm && (
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
            )}
          </div>
          <p className="text-gray-600">
            View and edit all manual reminders, including future reminders not yet shown on the main reminders page.
          </p>
        </div>

        <MessageAlert type="error" message={error} className="mb-6" />
        <MessageAlert type="success" message={success} className="mb-6" />

        {/* Create Form */}
        {showCreateForm && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Create Manual Reminder</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="e.g., Contact landlord about renewal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reminder Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={createForm.reminder_date}
                    onChange={(e) => setCreateForm({ ...createForm, reminder_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  rows={3}
                  placeholder="Additional details (optional)"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Severity <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={createForm.severity}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        severity: e.target.value as 'low' | 'medium' | 'critical',
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Property (Optional)
                  </label>
                  <select
                    value={createForm.property_id}
                    onChange={(e) => setCreateForm({ ...createForm, property_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">General (not property-specific)</option>
                    {properties.map((prop) => (
                      <option key={prop.id} value={prop.id}>
                        {prop.address_line1}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                >
                  Create Reminder
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{reminders.length}</div>
            <div className="text-sm text-gray-600">Total Reminders</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="text-2xl font-bold text-red-700">
              {reminders.filter(r => r.severity === 'critical').length}
            </div>
            <div className="text-sm text-red-600">Critical</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="text-2xl font-bold text-orange-700">
              {reminders.filter(r => r.severity === 'medium').length}
            </div>
            <div className="text-sm text-orange-600">Medium</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-700">
              {reminders.filter(r => r.severity === 'low').length}
            </div>
            <div className="text-sm text-yellow-600">Low</div>
          </div>
        </div>

        {/* Reminders Table */}
        {reminders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600 mb-4">No manual reminders found.</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="text-primary hover:text-orange-700 font-semibold"
            >
              Create your first manual reminder
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title & Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reminder Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Property
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reminders.map((reminder) => (
                    <tr key={reminder.id}>
                      {editingId === reminder.id ? (
                        <>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={editForm.title}
                              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                              className="w-full px-3 py-1 border border-gray-300 rounded mb-2"
                              placeholder="Title"
                            />
                            <textarea
                              value={editForm.description}
                              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                              className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Description"
                              rows={2}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="date"
                              value={editForm.reminder_date}
                              onChange={(e) => setEditForm({ ...editForm, reminder_date: e.target.value })}
                              className="px-3 py-1 border border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={editForm.severity}
                              onChange={(e) =>
                                setEditForm({ ...editForm, severity: e.target.value as any })
                              }
                              className="px-3 py-1 border border-gray-300 rounded"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="critical">Critical</option>
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={editForm.property_id}
                              onChange={(e) => setEditForm({ ...editForm, property_id: e.target.value })}
                              className="px-3 py-1 border border-gray-300 rounded w-full"
                            >
                              <option value="">General</option>
                              {properties.map((prop) => (
                                <option key={prop.id} value={prop.id}>
                                  {prop.address_line1}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit(reminder.id)}
                                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{reminder.title}</div>
                            {reminder.description && (
                              <div className="text-sm text-gray-500 mt-1">{reminder.description}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{formatDateLong(reminder.reminder_date)}</div>
                            <div className="text-xs text-gray-500">{getDaysUntil(reminder.reminder_date)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded border ${getSeverityBadge(
                                reminder.severity
                              )}`}
                            >
                              {reminder.severity.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              {reminder.property_address || (
                                <span className="text-gray-400">General</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEdit(reminder)}
                                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(reminder.id)}
                                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4 p-4">
              {reminders.map((reminder) => (
                <div key={reminder.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  {editingId === reminder.id ? (
                    /* Edit Form */
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded"
                          rows={2}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reminder Date</label>
                        <input
                          type="date"
                          value={editForm.reminder_date}
                          onChange={(e) => setEditForm({ ...editForm, reminder_date: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                        <select
                          value={editForm.severity}
                          onChange={(e) => setEditForm({ ...editForm, severity: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
                        <select
                          value={editForm.property_id}
                          onChange={(e) => setEditForm({ ...editForm, property_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded"
                        >
                          <option value="">General</option>
                          {properties.map((prop) => (
                            <option key={prop.id} value={prop.id}>
                              {prop.address_line1}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(reminder.id)}
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex-1 px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display View */
                    <>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 mb-1">{reminder.title}</h3>
                          {reminder.description && (
                            <p className="text-sm text-gray-600 mb-2">{reminder.description}</p>
                          )}
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded border ${getSeverityBadge(reminder.severity)}`}
                        >
                          {reminder.severity.toUpperCase()}
                        </span>
                      </div>
                      <div className="space-y-2 mb-3 text-sm">
                        <div>
                          <span className="text-gray-600">Reminder Date:</span>
                          <p className="font-medium mt-0.5">{formatDateLong(reminder.reminder_date)}</p>
                          <p className="text-xs text-gray-500">{getDaysUntil(reminder.reminder_date)}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Property:</span>
                          <p className="font-medium mt-0.5">
                            {reminder.property_address || <span className="text-gray-400">General</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(reminder)}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(reminder.id)}
                          className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Email Notifications</h3>
          <p className="text-sm text-blue-800">
            Manual reminder emails are sent on the reminder date at 9:00 AM. Reminders shown here will only appear
            on the main reminders page on or after their reminder date.
          </p>
        </div>
      </div>
    </div>
  );
}
