'use client';

import { useState, useEffect } from 'react';
import { certificateTypes } from '@/lib/api';
import { useAgency } from '@/lib/agency-context';
import { SectionProps } from './index';
import { MessageAlert } from '@/components/ui/MessageAlert';

interface CertificateType {
  id: number;
  name: string;
  display_name: string;
  default_validity_months: number;
  has_expiry: boolean;
  display_order: number;
  is_active: boolean;
}

export default function PropertyCertificateTypesSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const { agencySlug } = useAgency();
  const [types, setTypes] = useState<CertificateType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    default_validity_months: 12,
    has_expiry: true,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    try {
      const response = await certificateTypes.getAll('property');
      setTypes(response.data.certificateTypes || []);
    } catch (error) {
      console.error('Error fetching property certificate types:', error);
      setMessage({ type: 'error', text: 'Failed to load certificate types' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    setMessage(null);
    try {
      if (editingId) {
        await certificateTypes.update(editingId, { ...formData, display_name: formData.name });
        setMessage({ type: 'success', text: 'Certificate type updated successfully' });
      } else {
        await certificateTypes.create({ ...formData, display_name: formData.name, type: 'property' });
        setMessage({ type: 'success', text: 'Certificate type created successfully' });
      }
      resetForm();
      fetchTypes();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to save certificate type'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (type: CertificateType) => {
    setEditingId(type.id);
    setFormData({
      name: type.name,
      default_validity_months: type.default_validity_months || 12,
      has_expiry: type.has_expiry,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this certificate type?')) return;

    try {
      await certificateTypes.delete(id);
      setMessage({ type: 'success', text: 'Certificate type deleted successfully' });
      fetchTypes();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to delete certificate type'
      });
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      name: '',
      default_validity_months: 12,
      has_expiry: true,
    });
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Property Certificate Types</h2>
          <p className="text-gray-600">Manage certificate types for properties (e.g., Gas Safety, EPC, EICR)</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Type
        </button>
      </div>

      {/* Info Note */}
      <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-blue-800">
            These certificate types appear on property edit pages. Agents can upload certificates for each property. Certificates with expiry dates will trigger reminders when approaching expiry.
          </p>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <MessageAlert type={message.type} message={message.text} className="mb-6" />
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit Certificate Type' : 'Add New Certificate Type'}
          </h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="e.g., Gas Safety Certificate, EPC, EICR"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default validity (months)</label>
                <input
                  type="number"
                  value={formData.default_validity_months}
                  onChange={(e) => setFormData({ ...formData, default_validity_months: parseInt(e.target.value) || 12 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  min={1}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="prop_has_expiry"
                checked={formData.has_expiry}
                onChange={(e) => setFormData({ ...formData, has_expiry: e.target.checked })}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="prop_has_expiry" className="text-sm text-gray-700">
                This certificate type has an expiry date
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Update Type' : 'Save Type'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Certificate Types List */}
      {types.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-gray-400 text-5xl mb-4">📋</div>
          <p className="text-gray-600 mb-4">No property certificate types defined yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Add Your First Certificate Type
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {types.map(type => (
            <div key={type.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-900">{type.display_name}</h3>
                  </div>
                  <div className="flex items-center flex-wrap gap-2 text-xs">
                    <span className="text-gray-500">
                      Valid for {type.default_validity_months} months
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${
                      type.has_expiry ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {type.has_expiry ? 'Has Expiry' : 'No Expiry'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(type)}
                    className="px-3 py-1.5 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(type.id)}
                    className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
