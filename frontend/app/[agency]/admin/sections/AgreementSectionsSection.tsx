'use client';

import { useState, useEffect } from 'react';
import { agreementSections } from '@/lib/api';
import { getErrorMessage } from '@/lib/types';
import type { Agreement } from '@/lib/types';
import { useAgency } from '@/lib/agency-context';
import { formatTenancyPeriod } from '@/lib/dateUtils';
import { SectionProps } from './index';
import { AgreementEditor } from '@/components/agreement-editor';
import { MessageAlert } from '@/components/ui/MessageAlert';
import AgreementDocument from '@/components/AgreementDocument';

interface AgreementSection {
  id: number;
  section_key: string;
  section_title: string;
  section_content: string;
  section_order: number;
  is_active: boolean;
  landlord_id: number | null;
  agreement_type: string;
  created_at: string;
}

export default function AgreementSectionsSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const { agencySlug } = useAgency();
  const [sections, setSections] = useState<AgreementSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ title: '', content: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Preview state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewAgreement, setPreviewAgreement] = useState<Agreement | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [showTestDataConfig, setShowTestDataConfig] = useState(false);

  // Test data configuration for previews
  const [testData, setTestData] = useState({
    primary_tenant_first_name: 'John',
    primary_tenant_last_name: 'Smith',
    primary_tenant_email: 'john.smith@example.com',
    primary_tenant_phone: '07700900123',
    primary_tenant_rent: '125',
    primary_tenant_deposit: '500',
    primary_tenant_room: 'Room 1 (Double)',
    second_tenant_first_name: 'Jane',
    second_tenant_last_name: 'Doe',
    second_tenant_email: 'jane.doe@example.com',
    second_tenant_phone: '07700900456',
    second_tenant_rent: '115',
    second_tenant_deposit: '450',
    second_tenant_room: 'Room 2 (Single)',
    property_address_line1: '123 Example Street',
    property_city: 'Sheffield',
    property_postcode: 'S1 2AB',
    start_date: '2025-09-01',
    end_date: '2026-08-31',
    council_tax_included: true,
  });

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    try {
      const response = await agreementSections.getAll();
      setSections(response.data.sections || []);
    } catch (error) {
      console.error('Error fetching agreement sections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) return;

    setSaving(true);
    try {
      if (editingId) {
        await agreementSections.update(editingId, {
          section_title: formData.title,
          section_content: formData.content,
        });
        setSections(sections.map(s =>
          s.id === editingId ? { ...s, section_title: formData.title, section_content: formData.content } : s
        ));
      } else {
        const sectionKey = formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        const response = await agreementSections.create({
          section_key: sectionKey,
          section_title: formData.title,
          section_content: formData.content,
          section_order: sections.length,
          is_active: true,
          agreement_type: 'tenancy_agreement',
        });
        setSections([...sections, response.data.section]);
      }
      resetForm();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Failed to save section') });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (section: AgreementSection) => {
    setEditingId(section.id);
    setFormData({ title: section.section_title || '', content: section.section_content || '' });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this agreement section?')) return;

    try {
      await agreementSections.delete(id);
      setSections(sections.filter(s => s.id !== id));
    } catch (err: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Failed to delete section') });
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ title: '', content: '' });
  };

  const buildTestDataPayload = () => ({
    primaryTenant: {
      firstName: testData.primary_tenant_first_name,
      lastName: testData.primary_tenant_last_name,
      phone: testData.primary_tenant_phone,
      room: testData.primary_tenant_room,
      rent: parseFloat(testData.primary_tenant_rent) || 125,
      deposit: parseFloat(testData.primary_tenant_deposit) || 500,
    },
    secondTenant: {
      firstName: testData.second_tenant_first_name,
      lastName: testData.second_tenant_last_name,
      phone: testData.second_tenant_phone,
      room: testData.second_tenant_room,
      rent: parseFloat(testData.second_tenant_rent) || 115,
      deposit: parseFloat(testData.second_tenant_deposit) || 450,
    },
    propertyData: {
      address_line1: testData.property_address_line1,
      city: testData.property_city,
      postcode: testData.property_postcode,
    },
    startDate: testData.start_date,
    endDate: testData.end_date,
    councilTaxIncluded: testData.council_tax_included,
  });

  const handlePreviewAgreement = async (tenancyType: 'room_only' | 'whole_house') => {
    setPreviewLoading(true);
    setPreviewError('');
    setShowPreviewModal(true);
    setPreviewAgreement(null);

    try {
      const response = await agreementSections.previewDefault(tenancyType, buildTestDataPayload());
      setPreviewAgreement(response.data.agreement);
    } catch (err: unknown) {
      setPreviewError(getErrorMessage(err, 'Failed to generate preview'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreviewModal = () => {
    setShowPreviewModal(false);
    setPreviewAgreement(null);
    setPreviewError('');
  };

  const inputClass = 'w-full px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500';

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
          <h2 className="text-2xl font-bold text-gray-900">Default Agreement Sections</h2>
          <p className="text-gray-600">These clauses are included in all tenancy agreements by default. To customise, override, or remove sections for a specific landlord, go to that landlord&apos;s &quot;Agreement Sections&quot; tab.</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Section
        </button>
      </div>

      {/* Messages */}
      {message && (
        <MessageAlert type={message.type} message={message.text} className="mb-6" onDismiss={() => setMessage(null)} />
      )}

      {/* Preview Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Preview Agreement with Test Data</h4>
            <p className="text-sm text-blue-700">Test how your default agreement sections will look with customizable sample data</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setShowTestDataConfig(!showTestDataConfig)}
              className={`px-4 py-2 rounded transition-colors flex items-center gap-2 ${
                showTestDataConfig
                  ? 'bg-blue-700 text-white'
                  : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-100'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Configure Test Data
            </button>
            <button
              onClick={() => handlePreviewAgreement('room_only')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview Room Only
            </button>
            <button
              onClick={() => handlePreviewAgreement('whole_house')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview Whole House
            </button>
          </div>
        </div>

        {/* Test Data Configuration Panel */}
        {showTestDataConfig && (
          <div className="mt-4 pt-4 border-t border-blue-200">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Primary Tenant */}
              <div className="space-y-3">
                <h5 className="font-semibold text-blue-900 text-sm uppercase tracking-wide">Primary Tenant</h5>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={testData.primary_tenant_first_name}
                    onChange={(e) => setTestData(prev => ({ ...prev, primary_tenant_first_name: e.target.value }))}
                    placeholder="First name"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={testData.primary_tenant_last_name}
                    onChange={(e) => setTestData(prev => ({ ...prev, primary_tenant_last_name: e.target.value }))}
                    placeholder="Last name"
                    className={inputClass}
                  />
                </div>
                <input
                  type="email"
                  value={testData.primary_tenant_email}
                  onChange={(e) => setTestData(prev => ({ ...prev, primary_tenant_email: e.target.value }))}
                  placeholder="Email"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={testData.primary_tenant_room}
                  onChange={(e) => setTestData(prev => ({ ...prev, primary_tenant_room: e.target.value }))}
                  placeholder="Room name"
                  className={inputClass}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-blue-700">Rent (&pound;/week)</label>
                    <input
                      type="number"
                      value={testData.primary_tenant_rent}
                      onChange={(e) => setTestData(prev => ({ ...prev, primary_tenant_rent: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-blue-700">Deposit (&pound;)</label>
                    <input
                      type="number"
                      value={testData.primary_tenant_deposit}
                      onChange={(e) => setTestData(prev => ({ ...prev, primary_tenant_deposit: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Second Tenant */}
              <div className="space-y-3">
                <h5 className="font-semibold text-blue-900 text-sm uppercase tracking-wide">Second Tenant (Whole House)</h5>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={testData.second_tenant_first_name}
                    onChange={(e) => setTestData(prev => ({ ...prev, second_tenant_first_name: e.target.value }))}
                    placeholder="First name"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={testData.second_tenant_last_name}
                    onChange={(e) => setTestData(prev => ({ ...prev, second_tenant_last_name: e.target.value }))}
                    placeholder="Last name"
                    className={inputClass}
                  />
                </div>
                <input
                  type="email"
                  value={testData.second_tenant_email}
                  onChange={(e) => setTestData(prev => ({ ...prev, second_tenant_email: e.target.value }))}
                  placeholder="Email"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={testData.second_tenant_room}
                  onChange={(e) => setTestData(prev => ({ ...prev, second_tenant_room: e.target.value }))}
                  placeholder="Room name"
                  className={inputClass}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-blue-700">Rent (&pound;/week)</label>
                    <input
                      type="number"
                      value={testData.second_tenant_rent}
                      onChange={(e) => setTestData(prev => ({ ...prev, second_tenant_rent: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-blue-700">Deposit (&pound;)</label>
                    <input
                      type="number"
                      value={testData.second_tenant_deposit}
                      onChange={(e) => setTestData(prev => ({ ...prev, second_tenant_deposit: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Property & Tenancy */}
              <div className="space-y-3">
                <h5 className="font-semibold text-blue-900 text-sm uppercase tracking-wide">Property & Tenancy</h5>
                <input
                  type="text"
                  value={testData.property_address_line1}
                  onChange={(e) => setTestData(prev => ({ ...prev, property_address_line1: e.target.value }))}
                  placeholder="Address line 1"
                  className={inputClass}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={testData.property_city}
                    onChange={(e) => setTestData(prev => ({ ...prev, property_city: e.target.value }))}
                    placeholder="City"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={testData.property_postcode}
                    onChange={(e) => setTestData(prev => ({ ...prev, property_postcode: e.target.value }))}
                    placeholder="Postcode"
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-blue-700">Start date</label>
                    <input
                      type="date"
                      value={testData.start_date}
                      onChange={(e) => setTestData(prev => ({ ...prev, start_date: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-blue-700">End date</label>
                    <input
                      type="date"
                      value={testData.end_date}
                      onChange={(e) => setTestData(prev => ({ ...prev, end_date: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={testData.council_tax_included}
                      onChange={(e) => setTestData(prev => ({ ...prev, council_tax_included: e.target.checked }))}
                      className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-blue-900">Council tax included in bills</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit Agreement Section' : 'Add New Agreement Section'}
          </h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="e.g., Rent Payment Terms"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
              <AgreementEditor
                value={formData.content}
                onChange={(html) => setFormData({ ...formData, content: html })}
                agreementType="tenancy_agreement"
                placeholder="Enter the agreement clause text..."
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Update Section' : 'Save Section'}
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

      {/* Sections List */}
      {sections.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-gray-400 text-5xl mb-4">&#128196;</div>
          <p className="text-gray-600 mb-4">No agreement sections defined yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Add Your First Section
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((section, index) => (
            <div key={section.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded">
                      #{index + 1}
                    </span>
                    <h3 className="font-semibold text-gray-900">{section.section_title}</h3>
                    {!section.landlord_id && (
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3">
                    {section.section_content}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(section)}
                    className="px-3 py-1.5 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(section.id)}
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

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold">Agreement Preview</h3>
                <p className="text-sm text-white/90 mt-1">Preview with dummy data — default sections only</p>
              </div>
              <button
                onClick={closePreviewModal}
                aria-label="Close preview"
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {previewLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="text-gray-600 mt-4">Generating preview...</p>
                  </div>
                </div>
              )}

              {previewError && <MessageAlert type="error" message={previewError} />}

              {previewAgreement && !previewLoading && (
                <>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <h4 className="font-semibold text-yellow-900 mb-1">Preview Mode — Default Sections Only</h4>
                        <p className="text-sm text-yellow-800">
                          This preview uses sample data and shows only default sections (no landlord overrides). Actual agreements may include landlord-specific sections.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h4 className="font-bold text-blue-900 mb-2">Agreement Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-blue-700 font-medium">Landlord</p>
                        <p className="text-blue-900">{previewAgreement.landlord?.display_name || 'Test Landlord'}</p>
                      </div>
                      <div>
                        <p className="text-blue-700 font-medium">Tenancy Period</p>
                        <p className="text-blue-900">
                          {formatTenancyPeriod(previewAgreement.tenancy?.start_date, previewAgreement.tenancy?.end_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-blue-700 font-medium">Tenancy Type</p>
                        <p className="text-blue-900">
                          {previewAgreement.tenancy?.tenancy_type === 'room_only' ? 'Room Only (1 tenant)' : 'Whole House (2 tenants)'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <AgreementDocument
                    agreement={previewAgreement}
                    showInfoBox={false}
                    showSignatures={false}
                  />
                </>
              )}
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-between items-center bg-gray-50">
              <p className="text-sm text-gray-600">
                {previewAgreement && `${previewAgreement.sections?.length || 0} sections rendered`}
              </p>
              <div className="flex gap-3">
                {previewAgreement && (
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Print Preview
                  </button>
                )}
                <button
                  onClick={closePreviewModal}
                  className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
