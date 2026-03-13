'use client';

import { useState, useEffect } from 'react';
import { agreementSections } from '@/lib/api';
import { getErrorMessage } from '@/lib/types';
import type { Agreement } from '@/lib/types';
import { SectionProps } from './index';
import { AgreementEditor } from '@/components/agreement-editor';
import { MessageAlert } from '@/components/ui/MessageAlert';
import AgreementPreviewBanner from '@/components/admin/AgreementPreviewBanner';
import AgreementPreviewModal from '@/components/admin/AgreementPreviewModal';
import TestDataConfigPanel, { defaultTestData, buildTestDataPayload } from '@/components/admin/TestDataConfigPanel';
import type { TestDataState } from '@/components/admin/TestDataConfigPanel';

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
  const [testData, setTestData] = useState<TestDataState>(defaultTestData);

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

  const handlePreviewAgreement = async (tenancyType: 'room_only' | 'whole_house') => {
    setPreviewLoading(true);
    setPreviewError('');
    setShowPreviewModal(true);
    setPreviewAgreement(null);

    try {
      const response = await agreementSections.previewDefault(tenancyType, buildTestDataPayload(testData));
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
      <AgreementPreviewBanner
        description="Test how your default agreement sections will look with customizable sample data"
        showTestDataConfig={showTestDataConfig}
        onToggleConfig={() => setShowTestDataConfig(!showTestDataConfig)}
        onPreviewRoomOnly={() => handlePreviewAgreement('room_only')}
        onPreviewWholeHouse={() => handlePreviewAgreement('whole_house')}
      >
        {showTestDataConfig && (
          <TestDataConfigPanel testData={testData} setTestData={setTestData} />
        )}
      </AgreementPreviewBanner>

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
                  <div className="flex items-center gap-2">
                    <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded">
                      #{index + 1}
                    </span>
                    <h3 className="font-semibold text-gray-900">{section.section_title}</h3>
                  </div>
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
        <AgreementPreviewModal
          agreement={previewAgreement}
          loading={previewLoading}
          error={previewError}
          onClose={closePreviewModal}
          warningTitle="Preview Mode — Default Sections Only"
          warningText="This preview uses sample data and shows only default sections (no landlord overrides). Actual agreements may include landlord-specific sections."
        />
      )}
    </div>
  );
}
