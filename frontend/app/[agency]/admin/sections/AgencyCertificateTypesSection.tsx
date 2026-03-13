'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { certificateTypes as certificateTypesApi, certificates as certificatesApi } from '@/lib/api';
import { useAgency } from '@/lib/agency-context';
import { MessageAlert } from '@/components/ui/MessageAlert';
import { getErrorMessage } from '@/lib/types';
import { SectionProps } from './index';

interface CertificateType {
  id: number;
  name: string;
  display_name: string;
  has_expiry: boolean;
  display_order: number;
  is_active: boolean;
}

interface Certificate {
  id: number;
  certificate_type_id: number;
  file_path: string;
  original_filename: string;
  expiry_date: string | null;
}

export default function AgencyCertificateTypesSection(_props: SectionProps) {
  const { agency } = useAgency();
  const [types, setTypes] = useState<CertificateType[]>([]);
  const [agencyCertificates, setAgencyCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    has_expiry: false,
  });
  const [saving, setSaving] = useState(false);
  const [uploadingCertificates, setUploadingCertificates] = useState<Record<number, boolean>>({});
  const [pendingUpload, setPendingUpload] = useState<{ typeId: number; typeName: string; file: File; hasExpiry: boolean } | null>(null);
  const [uploadExpiryDate, setUploadExpiryDate] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const fetchTypes = useCallback(async () => {
    try {
      const response = await certificateTypesApi.getAll('agency');
      setTypes(response.data.certificateTypes || []);
    } catch (err: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Failed to load agency certificate types') });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCertificates = useCallback(async () => {
    if (!agency?.id) return;
    try {
      const response = await certificatesApi.getByEntity('agency', agency.id);
      setAgencyCertificates(response.data.certificates || []);
    } catch (err: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Failed to load agency certificates') });
    }
  }, [agency?.id]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  useEffect(() => {
    if (agency?.id) fetchCertificates();
  }, [agency?.id, fetchCertificates]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    setMessage(null);
    try {
      if (editingId) {
        await certificateTypesApi.update(editingId, { ...formData, display_name: formData.name });
        setMessage({ type: 'success', text: 'Type updated successfully' });
      } else {
        await certificateTypesApi.create({ ...formData, display_name: formData.name, type: 'agency' });
        setMessage({ type: 'success', text: 'Type created successfully' });
      }
      resetForm();
      fetchTypes();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Failed to save type') });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (type: CertificateType) => {
    setEditingId(type.id);
    setFormData({
      name: type.name,
      has_expiry: type.has_expiry,
    });
    setShowForm(true);
  };

  const handleDeleteType = async (id: number) => {
    if (!confirm('Are you sure you want to delete this type? Any uploaded certificate will also be removed.')) return;

    try {
      await certificateTypesApi.delete(id);
      setMessage({ type: 'success', text: 'Type deleted successfully' });
      fetchTypes();
      fetchCertificates();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Failed to delete type') });
    }
  };

  const handleFileSelect = (typeId: number, typeName: string, hasExpiry: boolean) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (hasExpiry) {
      // Show expiry date prompt before uploading
      setPendingUpload({ typeId, typeName, file, hasExpiry });
      setUploadExpiryDate('');
    } else {
      // Upload immediately
      doUpload(typeId, typeName, file, null);
    }
    e.target.value = '';
  };

  const handleConfirmUpload = () => {
    if (!pendingUpload) return;
    if (pendingUpload.hasExpiry && !uploadExpiryDate) return;
    doUpload(pendingUpload.typeId, pendingUpload.typeName, pendingUpload.file, uploadExpiryDate || null);
    setPendingUpload(null);
    setUploadExpiryDate('');
  };

  const doUpload = async (typeId: number, typeName: string, file: File, expiryDate: string | null) => {
    if (!agency?.id) return;

    setUploadingCertificates(prev => ({ ...prev, [typeId]: true }));
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('certificate', file);
      if (expiryDate) {
        fd.append('expiry_date', expiryDate);
      }
      await certificatesApi.upload('agency', agency.id, typeId, fd);
      setMessage({ type: 'success', text: `${typeName} uploaded successfully` });
      await fetchCertificates();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(err, `Failed to upload ${typeName}`) });
    } finally {
      setUploadingCertificates(prev => ({ ...prev, [typeId]: false }));
    }
  };

  const handleDeleteCertificate = async (typeId: number, typeName: string) => {
    if (!confirm(`Are you sure you want to delete the uploaded ${typeName}?`)) return;
    if (!agency?.id) return;

    try {
      await certificatesApi.delete('agency', agency.id, typeId);
      setMessage({ type: 'success', text: `${typeName} deleted successfully` });
      await fetchCertificates();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(err, `Failed to delete ${typeName}`) });
    }
  };

  const handleExpiryChange = async (typeId: number, expiryDate: string) => {
    if (!agency?.id) return;
    try {
      await certificatesApi.updateExpiry('agency', agency.id, typeId, expiryDate || null);
    } catch (err: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Failed to update expiry date') });
      await fetchCertificates();
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', has_expiry: false });
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
          <h2 className="text-2xl font-bold text-gray-900">Agency Certificates</h2>
          <p className="text-gray-600">Manage certificates for the agency as a whole (e.g., Deposit Protection, How to Rent Guide)</p>
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
            These certificates apply to the agency as a whole, not individual properties or tenancies. Add a certificate type, then upload the document directly below. Certificates with expiry dates will trigger reminders when approaching expiry.
          </p>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <MessageAlert type={message.type} message={message.text} className="mb-6" />
      )}

      {/* Expiry Date Prompt Modal */}
      {pendingUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Expiry Date Required</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please enter the expiry date for <strong>{pendingUpload.typeName}</strong>.
            </p>
            <input
              type="date"
              value={uploadExpiryDate}
              onChange={(e) => setUploadExpiryDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setPendingUpload(null); setUploadExpiryDate(''); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={!uploadExpiryDate}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium disabled:opacity-50"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit Type' : 'Add New Type'}
          </h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="e.g., Deposit Protection Certificate, How to Rent Guide"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="agency_has_expiry"
                checked={formData.has_expiry}
                onChange={(e) => setFormData({ ...formData, has_expiry: e.target.checked })}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="agency_has_expiry" className="text-sm text-gray-700">
                This type has an expiry date
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

      {/* Types List with Upload */}
      {types.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-gray-400 text-5xl mb-4">&#128203;</div>
          <p className="text-gray-600 mb-4">No agency certificate types defined yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Add Your First Type
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {types.map(type => {
            const existingCert = agencyCertificates.find(c => c.certificate_type_id === type.id);
            const isUploading = uploadingCertificates[type.id];

            return (
              <div key={type.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <h3 className="font-semibold text-gray-900">{type.display_name}</h3>
                    </div>
                    <div className="flex items-center flex-wrap gap-2 text-xs ml-11">
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
                      onClick={() => handleDeleteType(type.id)}
                      className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Document Upload Area */}
                <div className="border-t pt-4">
                  {existingCert ? (
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>{existingCert.original_filename}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {type.has_expiry && (
                          <input
                            type="date"
                            value={existingCert.expiry_date ? existingCert.expiry_date.split('T')[0] : ''}
                            onChange={(e) => {
                              setAgencyCertificates(prev => prev.map(c =>
                                c.certificate_type_id === type.id
                                  ? { ...c, expiry_date: e.target.value }
                                  : c
                              ));
                            }}
                            onBlur={(e) => handleExpiryChange(type.id, e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        )}
                        <a
                          href={certificatesApi.getDownloadUrl(existingCert.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium transition-colors"
                        >
                          View
                        </a>
                        <label className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm font-medium transition-colors cursor-pointer">
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            onChange={handleFileSelect(type.id, type.display_name, type.has_expiry)}
                            className="hidden"
                          />
                          Replace
                        </label>
                        <button
                          onClick={() => handleDeleteCertificate(type.id, type.display_name)}
                          className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">No document uploaded</span>
                      <label className={`px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded text-sm font-medium transition-colors cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          onChange={handleFileSelect(type.id, type.display_name, type.has_expiry)}
                          disabled={isUploading}
                          className="hidden"
                          ref={el => { fileInputRefs.current[type.id] = el; }}
                        />
                        {isUploading ? 'Uploading...' : 'Upload Document'}
                      </label>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
