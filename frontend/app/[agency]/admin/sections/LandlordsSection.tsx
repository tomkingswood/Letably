'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { landlords as landlordsApi, agreementSections as sectionsApi } from '@/lib/api';
import { useAgency } from '@/lib/agency-context';
import { SectionProps } from './index';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/types';
import type { AgreementSection, Agreement } from '@/lib/types';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import AgreementDocument from '@/components/AgreementDocument';
import { AgreementEditor } from '@/components/agreement-editor';
import { formatTenancyPeriod } from '@/lib/dateUtils';
import { MessageAlert } from '@/components/ui/MessageAlert';

interface Landlord {
  id: number;
  name: string;
  email: string;
  phone?: string;
  property_count?: number;
  properties?: Array<{ id: number; address_line1: string }>;
  created_at: string;
}

// Form data for creating/editing a landlord
const defaultFormData = {
  name: '',
  legal_name: '',
  agreement_display_format: '',
  email: '',
  phone: '',
  address_line1: '',
  address_line2: '',
  city: '',
  postcode: '',
  bank_name: '',
  bank_account_name: '',
  sort_code: '',
  account_number: '',
  utilities_cap_amount: '',
  council_tax_in_bills: true,
  manage_rent: true,
  receive_maintenance_notifications: true,
  receive_tenancy_communications: true,
  notes: '',
  send_welcome_email: true,
};

export default function LandlordsSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const { agencySlug } = useAgency();

  // List view state
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state (for create/edit)
  const [formData, setFormData] = useState(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Delete state
  const [deletingLandlord, setDeletingLandlord] = useState<Landlord | null>(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Agreement sections state (for edit view)
  const [defaultSections, setDefaultSections] = useState<AgreementSection[]>([]);
  const [landlordSections, setLandlordSections] = useState<AgreementSection[]>([]);
  const [showDefaultSections, setShowDefaultSections] = useState(false);
  const [editingInlineId, setEditingInlineId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [originalDefaultContent, setOriginalDefaultContent] = useState<AgreementSection | null>(null);
  const [sectionFormData, setSectionFormData] = useState({
    section_key: '',
    section_title: '',
    section_content: '',
    section_order: '',
    is_active: true,
  });

  // Preview modal state
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
    primary_tenant_address: '45 Test Lane, Manchester, M1 1AA',
    primary_tenant_rent: '125',
    primary_tenant_deposit: '500',
    primary_tenant_room: 'Room 1 (Double)',
    second_tenant_first_name: 'Jane',
    second_tenant_last_name: 'Doe',
    second_tenant_email: 'jane.doe@example.com',
    second_tenant_phone: '07700900456',
    second_tenant_address: '67 Sample Road, Leeds, LS1 1BB',
    second_tenant_rent: '115',
    second_tenant_deposit: '450',
    second_tenant_room: 'Room 2 (Single)',
    property_address_line1: '123 Example Street',
    property_address_line2: '',
    property_city: 'Sheffield',
    property_postcode: 'S1 2AB',
    property_bedrooms: '5',
    property_bathrooms: '2',
    start_date: '2025-09-01',
    end_date: '2026-08-31',
    is_rolling_monthly: false,
    utilities_cap_enabled: true,
    utilities_cap_amount: '50',
    council_tax_included: true,
  });

  // Unsaved changes tracking
  const initialFormData = useRef<string | null>(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // Determine view mode
  const isCreateMode = action === 'new';
  const isEditMode = !!itemId;
  const isListMode = !isCreateMode && !isEditMode;

  const isDirty = useCallback(() => {
    if (!isEditMode || initialFormData.current === null) return false;
    return JSON.stringify(formData) !== initialFormData.current;
  }, [formData, isEditMode]);

  // Warn on browser tab close/refresh with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty()) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Intercept admin header back button navigation
  useEffect(() => {
    const handleBeforeNavigate = (e: Event) => {
      if (isDirty()) {
        e.preventDefault();
        setShowUnsavedWarning(true);
      }
    };
    window.addEventListener('admin:before-navigate', handleBeforeNavigate);
    return () => window.removeEventListener('admin:before-navigate', handleBeforeNavigate);
  }, [isDirty]);

  useEffect(() => {
    if (isListMode) {
      initialFormData.current = null;
      fetchLandlords();
    } else if (isEditMode && itemId) {
      fetchLandlordDetails(itemId);
    } else if (isCreateMode) {
      initialFormData.current = null;
      // Reset form for create mode
      setFormData(defaultFormData);
      setLoading(false);
    }
  }, [action, itemId]);

  const fetchLandlords = async () => {
    try {
      const response = await landlordsApi.getAll();
      const data = (response.data.landlords || []).map((l: any) => ({
        ...l,
        property_count: l.properties?.length || 0,
      }));
      setLandlords(data);
    } catch (error) {
      console.error('Error fetching landlords:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLandlordDetails = async (id: string) => {
    setLoading(true);
    try {
      const [landlordRes, defaultSectionsRes, landlordSectionsRes] = await Promise.all([
        landlordsApi.getById(id),
        sectionsApi.getAll({ landlord_id: 'default', agreement_type: 'tenancy_agreement' }),
        sectionsApi.getAll({ landlord_id: id, agreement_type: 'tenancy_agreement' })
      ]);

      const landlord = landlordRes.data.landlord;
      const loadedFormData = {
        name: landlord.name || '',
        legal_name: landlord.legal_name || '',
        agreement_display_format: landlord.agreement_display_format || '',
        email: landlord.email || '',
        phone: landlord.phone || '',
        address_line1: landlord.address_line1 || '',
        address_line2: landlord.address_line2 || '',
        city: landlord.city || '',
        postcode: landlord.postcode || '',
        bank_name: landlord.bank_name || '',
        bank_account_name: landlord.bank_account_name || '',
        sort_code: landlord.sort_code || '',
        account_number: landlord.account_number || '',
        utilities_cap_amount: landlord.utilities_cap_amount?.toString() || '',
        council_tax_in_bills: landlord.council_tax_in_bills !== undefined ? landlord.council_tax_in_bills : true,
        manage_rent: landlord.manage_rent !== undefined ? landlord.manage_rent : true,
        receive_maintenance_notifications: landlord.receive_maintenance_notifications !== undefined ? landlord.receive_maintenance_notifications : true,
        receive_tenancy_communications: landlord.receive_tenancy_communications !== undefined ? landlord.receive_tenancy_communications : true,
        notes: landlord.notes || '',
        send_welcome_email: true,
      };
      setFormData(loadedFormData);
      initialFormData.current = JSON.stringify(loadedFormData);

      setDefaultSections(defaultSectionsRes.data.sections);
      setLandlordSections(landlordSectionsRes.data.sections.filter((s: AgreementSection) => s.landlord_id));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load landlord'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const response = await landlordsApi.create(formData);
      const newLandlordId = response.data.landlord.id;
      // Navigate to edit the new landlord
      onNavigate?.('landlords', { action: 'edit', id: newLandlordId.toString() });
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to create landlord'));
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await landlordsApi.update(itemId!, formData);
      initialFormData.current = JSON.stringify(formData);
      setSuccess('Landlord updated successfully!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update landlord'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingLandlord) return;
    setDeleteConfirming(true);
    setDeleteError(null);

    try {
      await landlordsApi.delete(deletingLandlord.id);
      setDeletingLandlord(null);
      fetchLandlords();
    } catch (err: unknown) {
      setDeleteError(getErrorMessage(err, 'Failed to delete landlord'));
    } finally {
      setDeleteConfirming(false);
    }
  };

  // Agreement section handlers
  const handleOverrideSection = (defaultSection: AgreementSection) => {
    const inlineId = `default-${defaultSection.section_key}`;
    setEditingInlineId(inlineId);
    setOriginalDefaultContent(defaultSection);
    setSectionFormData({
      section_key: defaultSection.section_key,
      section_title: defaultSection.section_title,
      section_content: defaultSection.section_content,
      section_order: defaultSection.section_order.toString(),
      is_active: true,
    });
  };

  const handleEditSection = (section: AgreementSection, defaultSection?: AgreementSection) => {
    const inlineId = `section-${section.id}`;
    setEditingInlineId(inlineId);
    setOriginalDefaultContent(defaultSection || null);
    setSectionFormData({
      section_key: section.section_key,
      section_title: section.section_title,
      section_content: section.section_content,
      section_order: section.section_order.toString(),
      is_active: section.is_active,
    });
  };

  const handleSectionSubmit = async (e: React.FormEvent, existingSectionId?: number) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const data = {
        landlord_id: parseInt(itemId!),
        section_key: sectionFormData.section_key,
        section_title: sectionFormData.section_title,
        section_content: sectionFormData.section_content,
        section_order: parseInt(sectionFormData.section_order),
        is_active: sectionFormData.is_active,
      };

      const isOverride = editingInlineId?.startsWith('default-');

      if (existingSectionId) {
        await sectionsApi.update(existingSectionId, data);
        setSuccess('Section updated successfully!');
      } else {
        await sectionsApi.create(data);
        setSuccess(isOverride ? 'Section overridden successfully!' : 'Section created successfully!');
      }

      // Refresh sections
      const landlordSectionsRes = await sectionsApi.getAll({ landlord_id: itemId!, agreement_type: 'tenancy_agreement' });
      setLandlordSections(landlordSectionsRes.data.sections.filter((s: AgreementSection) => s.landlord_id));

      handleCancelSection();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save section'));
    }
  };

  const handleDeleteSection = async (sectionId: number, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This will revert to the default section.`)) {
      return;
    }

    try {
      await sectionsApi.delete(sectionId);
      setSuccess('Section deleted - reverted to default');

      // Refresh sections
      const landlordSectionsRes = await sectionsApi.getAll({ landlord_id: itemId!, agreement_type: 'tenancy_agreement' });
      setLandlordSections(landlordSectionsRes.data.sections.filter((s: AgreementSection) => s.landlord_id));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete section'));
    }
  };

  const handleCancelSection = () => {
    setEditingInlineId(null);
    setCreatingNew(false);
    setOriginalDefaultContent(null);
    setSectionFormData({
      section_key: '',
      section_title: '',
      section_content: '',
      section_order: '',
      is_active: true,
    });
  };

  const handlePreviewAgreement = async (tenancyType: 'room_only' | 'whole_house') => {
    setPreviewLoading(true);
    setPreviewError('');
    setShowPreviewModal(true);
    setPreviewAgreement(null);

    try {
      const response = await landlordsApi.previewAgreement(itemId!, tenancyType, testData);
      setPreviewAgreement(response.data);
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

  // Get all sections in order for display
  const getAllSectionsInOrder = () => {
    const allSections: any[] = [];

    defaultSections.forEach(defaultSection => {
      const landlordOverride = landlordSections.find(ls => ls.section_key === defaultSection.section_key);

      if (landlordOverride) {
        allSections.push({
          ...landlordOverride,
          type: 'override',
          defaultSection: defaultSection
        });
      } else {
        allSections.push({
          ...defaultSection,
          type: 'default'
        });
      }
    });

    const defaultSectionKeys = defaultSections.map(ds => ds.section_key);
    landlordSections.forEach(landlordSection => {
      if (!defaultSectionKeys.includes(landlordSection.section_key)) {
        allSections.push({
          ...landlordSection,
          type: 'custom'
        });
      }
    });

    return allSections.sort((a, b) => a.section_order - b.section_order);
  };

  const filteredLandlords = landlords.filter(landlord => {
    return landlord.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      landlord.email?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // CREATE MODE
  if (isCreateMode) {
    return (
      <div>
        {/* Section Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">New Landlord</h2>
          <p className="text-gray-600">Add a new landlord to your portfolio</p>
        </div>

        {/* Messages */}
        <MessageAlert type="success" message={success} className="mb-4" />
        <MessageAlert type="error" message={error} className="mb-4" />

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-xl font-bold mb-6">Landlord Information</h3>

          <form onSubmit={handleCreateSubmit} className="space-y-6">
            {/* Basic Information */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Basic Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Landlord name, company, or family"
                />
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="contact@email.com"
                />
                <Input
                  label="Phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="01234 567890"
                />
              </div>
            </div>

            {/* Portal Access */}
            <div className="border-t pt-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Portal Access</h4>
              <p className="text-sm text-gray-600 mb-3">A login account will be automatically created for this landlord.</p>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="create_send_welcome_email"
                    name="send_welcome_email"
                    checked={formData.send_welcome_email}
                    onChange={handleChange}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <label htmlFor="create_send_welcome_email" className="ml-2 block text-sm text-gray-700">
                    Send welcome email with login setup instructions
                  </label>
                </div>
                {!formData.send_welcome_email && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <p className="text-sm text-amber-800">
                      You will need to manually send a password reset from the Users section for this landlord to access their portal.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="border-t pt-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Address</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Address Line 1"
                  name="address_line1"
                  value={formData.address_line1}
                  onChange={handleChange}
                  placeholder="Street address"
                />
                <Input
                  label="Address Line 2"
                  name="address_line2"
                  value={formData.address_line2}
                  onChange={handleChange}
                  placeholder="Additional address details"
                />
                <Input
                  label="City"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Sheffield"
                />
                <Input
                  label="Postcode"
                  name="postcode"
                  value={formData.postcode}
                  onChange={handleChange}
                  placeholder="S1 2AB"
                />
              </div>
            </div>

            {/* Agreement Information */}
            <div className="border-t pt-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Agreement Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Legal Name"
                  name="legal_name"
                  value={formData.legal_name}
                  onChange={handleChange}
                  placeholder="e.g., Makkar Family Ltd"
                />
                <Input
                  label="Agreement Display Format"
                  name="agreement_display_format"
                  value={formData.agreement_display_format}
                  onChange={handleChange}
                  placeholder="e.g., ABC Lettings Ltd, c/o XYZ Property Ltd"
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                The display format will be shown on tenancy agreements. Leave blank to use the landlord name.
              </p>
            </div>

            {/* Bank Details */}
            <div className="border-t pt-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Bank Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Bank Name"
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={handleChange}
                  placeholder="e.g., LLOYDS, NATWEST"
                />
                <Input
                  label="Bank Account Name"
                  name="bank_account_name"
                  value={formData.bank_account_name}
                  onChange={handleChange}
                  placeholder="e.g., Makkar Family Ltd"
                />
                <Input
                  label="Sort Code"
                  name="sort_code"
                  value={formData.sort_code}
                  onChange={handleChange}
                  placeholder="e.g., 30-98-97"
                />
                <Input
                  label="Account Number"
                  name="account_number"
                  value={formData.account_number}
                  onChange={handleChange}
                  placeholder="e.g., 47215859"
                />
              </div>
            </div>

            {/* Agreement Settings */}
            <div className="border-t pt-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Agreement Settings</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Utilities Cap Amount (£)"
                  name="utilities_cap_amount"
                  type="number"
                  step="0.01"
                  value={formData.utilities_cap_amount}
                  onChange={handleChange}
                  placeholder="e.g., 2150.00"
                />
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="create_council_tax_in_bills"
                      name="council_tax_in_bills"
                      checked={formData.council_tax_in_bills}
                      onChange={handleChange}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label htmlFor="create_council_tax_in_bills" className="ml-2 block text-sm text-gray-700">
                      Council Tax Included in Bills
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="create_manage_rent"
                      name="manage_rent"
                      checked={formData.manage_rent}
                      onChange={handleChange}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label htmlFor="create_manage_rent" className="ml-2 block text-sm text-gray-700">
                      Manage Rent
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="create_receive_maintenance_notifications"
                      name="receive_maintenance_notifications"
                      checked={formData.receive_maintenance_notifications}
                      onChange={handleChange}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label htmlFor="create_receive_maintenance_notifications" className="ml-2 block text-sm text-gray-700">
                      Receive Maintenance Notifications
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="create_receive_tenancy_communications"
                      name="receive_tenancy_communications"
                      checked={formData.receive_tenancy_communications}
                      onChange={handleChange}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label htmlFor="create_receive_tenancy_communications" className="ml-2 block text-sm text-gray-700">
                      Receive Tenancy Communications
                    </label>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Leave utilities cap blank for unlimited. Amount is per year for the whole property.
              </p>
            </div>

            {/* Notes */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Additional notes or comments..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating...' : 'Create Landlord'}
              </Button>
              <Button type="button" variant="outline" onClick={onBack}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // EDIT MODE
  if (isEditMode) {
    return (
      <div>
        {/* Section Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Edit Landlord</h2>
          <p className="text-gray-600">{formData.name || 'Unnamed Landlord'}</p>
        </div>

        {/* Messages */}
        <MessageAlert type="success" message={success} className="mb-4" />
        <MessageAlert type="error" message={error} className="mb-4" />

        {/* Landlord Information Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-xl font-bold mb-6">Landlord Information</h3>

          <form onSubmit={handleEditSubmit} className="space-y-6">
            {/* Basic Information */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Basic Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Landlord name, company, or family"
                />
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="contact@email.com"
                />
                <Input
                  label="Phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="01234 567890"
                />
              </div>
            </div>

            {/* Address */}
            <div className="border-t pt-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Address</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Address Line 1"
                  name="address_line1"
                  value={formData.address_line1}
                  onChange={handleChange}
                  placeholder="Street address"
                />
                <Input
                  label="Address Line 2"
                  name="address_line2"
                  value={formData.address_line2}
                  onChange={handleChange}
                  placeholder="Additional address details"
                />
                <Input
                  label="City"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Sheffield"
                />
                <Input
                  label="Postcode"
                  name="postcode"
                  value={formData.postcode}
                  onChange={handleChange}
                  placeholder="S1 2AB"
                />
              </div>
            </div>

            {/* Agreement Information */}
            <div className="border-t pt-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Agreement Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Legal Name"
                  name="legal_name"
                  value={formData.legal_name}
                  onChange={handleChange}
                  placeholder="e.g., Makkar Family Ltd"
                />
                <Input
                  label="Agreement Display Format"
                  name="agreement_display_format"
                  value={formData.agreement_display_format}
                  onChange={handleChange}
                  placeholder="e.g., ABC Lettings Ltd, c/o XYZ Property Ltd"
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                The display format will be shown on tenancy agreements. Leave blank to use the landlord name.
              </p>
            </div>

            {/* Bank Details */}
            <div className="border-t pt-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Bank Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Bank Name"
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={handleChange}
                  placeholder="e.g., LLOYDS, NATWEST"
                />
                <Input
                  label="Bank Account Name"
                  name="bank_account_name"
                  value={formData.bank_account_name}
                  onChange={handleChange}
                  placeholder="e.g., Makkar Family Ltd"
                />
                <Input
                  label="Sort Code"
                  name="sort_code"
                  value={formData.sort_code}
                  onChange={handleChange}
                  placeholder="e.g., 30-98-97"
                />
                <Input
                  label="Account Number"
                  name="account_number"
                  value={formData.account_number}
                  onChange={handleChange}
                  placeholder="e.g., 47215859"
                />
              </div>
            </div>

            {/* Agreement Settings */}
            <div className="border-t pt-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Agreement Settings</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Utilities Cap Amount (£)"
                  name="utilities_cap_amount"
                  type="number"
                  step="0.01"
                  value={formData.utilities_cap_amount}
                  onChange={handleChange}
                  placeholder="e.g., 2150.00"
                />
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="council_tax_in_bills"
                      name="council_tax_in_bills"
                      checked={formData.council_tax_in_bills}
                      onChange={handleChange}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label htmlFor="council_tax_in_bills" className="ml-2 block text-sm text-gray-700">
                      Council Tax Included in Bills
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="manage_rent"
                      name="manage_rent"
                      checked={formData.manage_rent}
                      onChange={handleChange}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label htmlFor="manage_rent" className="ml-2 block text-sm text-gray-700">
                      Manage Rent
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="receive_maintenance_notifications"
                      name="receive_maintenance_notifications"
                      checked={formData.receive_maintenance_notifications}
                      onChange={handleChange}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label htmlFor="receive_maintenance_notifications" className="ml-2 block text-sm text-gray-700">
                      Receive Maintenance Notifications
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="receive_tenancy_communications"
                      name="receive_tenancy_communications"
                      checked={formData.receive_tenancy_communications}
                      onChange={handleChange}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label htmlFor="receive_tenancy_communications" className="ml-2 block text-sm text-gray-700">
                      Receive Tenancy Communications
                    </label>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Leave utilities cap blank for unlimited. Amount is per year for the whole property.
              </p>
            </div>

            {/* Notes */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Additional notes or comments..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Landlord'}
              </Button>
              <Button type="button" variant="outline" onClick={onBack}>
                Cancel
              </Button>
            </div>
          </form>
        </div>

        {/* Agreement Sections Management */}
        <div className="bg-white rounded-lg shadow-md p-6" id="agreement-sections">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold">Agreement Sections</h3>
              <p className="text-sm text-gray-600 mt-1">
                Customize agreement clauses for this landlord or use defaults
              </p>
            </div>
            {!creatingNew && !editingInlineId && (
              <button
                onClick={() => {
                  setCreatingNew(true);
                  setSectionFormData({
                    section_key: '',
                    section_title: '',
                    section_content: '',
                    section_order: '',
                    is_active: true,
                  });
                }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Create New Section
              </button>
            )}
          </div>

          {/* Preview Buttons */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">Preview Agreement with Test Data</h4>
                <p className="text-sm text-blue-700">Test how your agreement sections will look with customizable sample data</p>
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
                        className="px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <input
                        type="text"
                        value={testData.primary_tenant_last_name}
                        onChange={(e) => setTestData(prev => ({ ...prev, primary_tenant_last_name: e.target.value }))}
                        placeholder="Last name"
                        className="px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <input
                      type="email"
                      value={testData.primary_tenant_email}
                      onChange={(e) => setTestData(prev => ({ ...prev, primary_tenant_email: e.target.value }))}
                      placeholder="Email"
                      className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={testData.primary_tenant_room}
                      onChange={(e) => setTestData(prev => ({ ...prev, primary_tenant_room: e.target.value }))}
                      placeholder="Room name"
                      className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-blue-700">Rent (£/week)</label>
                        <input
                          type="number"
                          value={testData.primary_tenant_rent}
                          onChange={(e) => setTestData(prev => ({ ...prev, primary_tenant_rent: e.target.value }))}
                          className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-blue-700">Deposit (£)</label>
                        <input
                          type="number"
                          value={testData.primary_tenant_deposit}
                          onChange={(e) => setTestData(prev => ({ ...prev, primary_tenant_deposit: e.target.value }))}
                          className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
                        className="px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <input
                        type="text"
                        value={testData.second_tenant_last_name}
                        onChange={(e) => setTestData(prev => ({ ...prev, second_tenant_last_name: e.target.value }))}
                        placeholder="Last name"
                        className="px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <input
                      type="email"
                      value={testData.second_tenant_email}
                      onChange={(e) => setTestData(prev => ({ ...prev, second_tenant_email: e.target.value }))}
                      placeholder="Email"
                      className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={testData.second_tenant_room}
                      onChange={(e) => setTestData(prev => ({ ...prev, second_tenant_room: e.target.value }))}
                      placeholder="Room name"
                      className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-blue-700">Rent (£/week)</label>
                        <input
                          type="number"
                          value={testData.second_tenant_rent}
                          onChange={(e) => setTestData(prev => ({ ...prev, second_tenant_rent: e.target.value }))}
                          className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-blue-700">Deposit (£)</label>
                        <input
                          type="number"
                          value={testData.second_tenant_deposit}
                          onChange={(e) => setTestData(prev => ({ ...prev, second_tenant_deposit: e.target.value }))}
                          className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
                      className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={testData.property_city}
                        onChange={(e) => setTestData(prev => ({ ...prev, property_city: e.target.value }))}
                        placeholder="City"
                        className="px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <input
                        type="text"
                        value={testData.property_postcode}
                        onChange={(e) => setTestData(prev => ({ ...prev, property_postcode: e.target.value }))}
                        placeholder="Postcode"
                        className="px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-blue-700">Start date</label>
                        <input
                          type="date"
                          value={testData.start_date}
                          onChange={(e) => setTestData(prev => ({ ...prev, start_date: e.target.value }))}
                          className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-blue-700">End date</label>
                        <input
                          type="date"
                          value={testData.end_date}
                          onChange={(e) => setTestData(prev => ({ ...prev, end_date: e.target.value }))}
                          disabled={testData.is_rolling_monthly}
                          className={`w-full px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${testData.is_rolling_monthly ? 'bg-gray-100 text-gray-400' : ''}`}
                        />
                      </div>
                    </div>
                    <div className="space-y-2 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={testData.is_rolling_monthly}
                          onChange={(e) => setTestData(prev => ({
                            ...prev,
                            is_rolling_monthly: e.target.checked,
                            end_date: e.target.checked ? '' : prev.end_date
                          }))}
                          className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-blue-900">Rolling monthly tenancy</span>
                      </label>
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

          {/* Create New Section Form */}
          {creatingNew && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h4 className="text-lg font-bold mb-4">Create New Section</h4>
              <form onSubmit={handleSectionSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Section Key"
                    name="section_key"
                    value={sectionFormData.section_key}
                    onChange={(e) => setSectionFormData(prev => ({ ...prev, section_key: e.target.value }))}
                    placeholder="e.g., custom_clause"
                    required
                  />
                  <Input
                    label="Section Title"
                    name="section_title"
                    value={sectionFormData.section_title}
                    onChange={(e) => setSectionFormData(prev => ({ ...prev, section_title: e.target.value }))}
                    placeholder="e.g., Custom Clause"
                    required
                  />
                  <Input
                    label="Section Order"
                    name="section_order"
                    type="number"
                    step="0.1"
                    value={sectionFormData.section_order}
                    onChange={(e) => setSectionFormData(prev => ({ ...prev, section_order: e.target.value }))}
                    placeholder="e.g., 4.5"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Section Content
                  </label>
                  <AgreementEditor
                    value={sectionFormData.section_content}
                    onChange={(html) => setSectionFormData(prev => ({ ...prev, section_content: html }))}
                    agreementType="tenancy_agreement"
                    placeholder="Start typing your agreement section content..."
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="section_is_active"
                    checked={sectionFormData.is_active}
                    onChange={(e) => setSectionFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <label htmlFor="section_is_active" className="ml-2 block text-sm text-gray-700">
                    Active
                  </label>
                </div>

                <div className="flex gap-3">
                  <Button type="submit">
                    Create Section
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancelSection}>
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* All Sections */}
          <div>
            <div className="mb-4 flex items-center gap-4">
              <h4 className="font-bold text-lg">All Agreement Sections ({getAllSectionsInOrder().length})</h4>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span className="text-gray-600">Default</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                  <span className="text-gray-600">Override</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  <span className="text-gray-600">Custom</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {getAllSectionsInOrder().map((section: any) => {
                const isDefault = section.type === 'default';
                const isOverride = section.type === 'override';
                const isCustom = section.type === 'custom';

                const borderColor = isDefault ? 'border-green-200' : isOverride ? 'border-orange-200' : 'border-blue-200';
                const bgColor = isDefault ? 'bg-green-50' : isOverride ? 'bg-orange-50' : 'bg-blue-50';
                const badgeColor = isDefault ? 'bg-green-100 text-green-800' : isOverride ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800';
                const indicatorColor = isDefault ? 'bg-green-500' : isOverride ? 'bg-orange-500' : 'bg-blue-500';

                const inlineId = isDefault ? `default-${section.section_key}` : `section-${section.id}`;
                const isEditing = editingInlineId === inlineId;

                return (
                  <div key={section.id || section.section_key} className={`border ${borderColor} rounded-lg p-4 ${bgColor} relative`}>
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${indicatorColor} rounded-l-lg`}></div>

                    <div className="ml-2">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-bold">{section.section_title}</h5>
                          <span className="text-xs text-gray-500">Order: {section.section_order}</span>
                          <span className={`px-2 py-1 ${badgeColor} text-xs rounded font-medium`}>
                            {isDefault && 'Default'}
                            {isOverride && 'Override'}
                            {isCustom && 'Custom'}
                          </span>
                          {!section.is_active && (
                            <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        {!isEditing && (
                          <div className="flex gap-2">
                            {!isDefault ? (
                              <>
                                <button
                                  onClick={() => handleEditSection(section, isOverride ? section.defaultSection : undefined)}
                                  className="px-3 py-1 bg-gray-700 text-white text-sm rounded hover:bg-gray-800"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteSection(section.id, section.section_title)}
                                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                                >
                                  {isOverride ? 'Revert' : 'Delete'}
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleOverrideSection(section)}
                                className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
                              >
                                Override
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <form onSubmit={(e) => handleSectionSubmit(e, isDefault ? undefined : section.id)} className="space-y-3 mt-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Input
                              label="Section Key"
                              name="section_key"
                              value={sectionFormData.section_key}
                              onChange={(e) => setSectionFormData(prev => ({ ...prev, section_key: e.target.value }))}
                              placeholder="e.g., rent_clause"
                              required
                              disabled={isOverride || !isDefault}
                            />
                            <Input
                              label="Section Title"
                              name="section_title"
                              value={sectionFormData.section_title}
                              onChange={(e) => setSectionFormData(prev => ({ ...prev, section_title: e.target.value }))}
                              placeholder="e.g., Rent Payment"
                              required
                            />
                            <Input
                              label="Section Order"
                              name="section_order"
                              type="number"
                              step="0.1"
                              value={sectionFormData.section_order}
                              onChange={(e) => setSectionFormData(prev => ({ ...prev, section_order: e.target.value }))}
                              placeholder="e.g., 4"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Section Content
                            </label>
                            <AgreementEditor
                              value={sectionFormData.section_content}
                              onChange={(html) => setSectionFormData(prev => ({ ...prev, section_content: html }))}
                              agreementType="tenancy_agreement"
                              placeholder="Start typing your agreement section content..."
                            />
                          </div>

                          {originalDefaultContent && (
                            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <h6 className="text-sm font-semibold text-gray-700">Original Default Section (for reference)</h6>
                              </div>
                              <div className="bg-white border border-gray-200 rounded p-3 max-h-64 overflow-y-auto">
                                <p className="text-xs font-semibold text-gray-500 mb-2">
                                  {originalDefaultContent.section_title} (Key: {originalDefaultContent.section_key})
                                </p>
                                <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700">
                                  {originalDefaultContent.section_content}
                                </pre>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id={`section_is_active_${section.id}`}
                              checked={sectionFormData.is_active}
                              onChange={(e) => setSectionFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                            <label htmlFor={`section_is_active_${section.id}`} className="ml-2 block text-sm text-gray-700">
                              Active
                            </label>
                          </div>

                          <div className="flex gap-3">
                            <Button type="submit">
                              {isDefault ? 'Save Override' : 'Update Section'}
                            </Button>
                            <Button type="button" variant="outline" onClick={handleCancelSection}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>Key:</strong> {section.section_key}
                          </p>
                          <div className="text-sm bg-white p-2 rounded max-h-32 overflow-y-auto">
                            <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700">
                              {section.section_content.substring(0, 200)}
                              {section.section_content.length > 200 && '...'}
                            </pre>
                          </div>
                          {isOverride && section.defaultSection && (
                            <div className="mt-2">
                              <button
                                onClick={() => setShowDefaultSections(!showDefaultSections)}
                                className="text-xs text-gray-500 hover:text-gray-700 underline"
                              >
                                View original default content
                              </button>
                              {showDefaultSections && (
                                <div className="mt-2 text-sm bg-gray-100 p-2 rounded max-h-32 overflow-y-auto">
                                  <p className="text-xs font-semibold text-gray-600 mb-1">Original Default:</p>
                                  <pre className="whitespace-pre-wrap font-mono text-xs text-gray-600">
                                    {section.defaultSection.section_content.substring(0, 200)}
                                    {section.defaultSection.section_content.length > 200 && '...'}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Preview Modal */}
        {showPreviewModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold">Agreement Preview</h3>
                  <p className="text-sm text-white/90 mt-1">Preview with dummy data</p>
                </div>
                <button
                  onClick={closePreviewModal}
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

                <MessageAlert type="error" message={previewError} />

                {previewAgreement && !previewLoading && (
                  <>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                      <div className="flex items-start gap-3">
                        <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <h4 className="font-semibold text-yellow-900 mb-1">Preview Mode - Dummy Data</h4>
                          <p className="text-sm text-yellow-800">
                            This is a preview using sample data. Actual agreements will use real tenant and property information.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <h4 className="font-bold text-blue-900 mb-2">Agreement Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-blue-700 font-medium">Landlord</p>
                          <p className="text-blue-900">{previewAgreement.landlord?.display_name}</p>
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
      {/* Unsaved Changes Warning Modal */}
      <Modal
        isOpen={showUnsavedWarning}
        title="Unsaved Changes"
        onClose={() => setShowUnsavedWarning(false)}
        size="sm"
        footer={
          <ModalFooter
            onCancel={() => setShowUnsavedWarning(false)}
            onConfirm={() => {
              setShowUnsavedWarning(false);
              onNavigate?.('landlords');
            }}
            cancelText="Stay"
            confirmText="Discard Changes"
            confirmColor="red"
          />
        }
      >
        <p className="text-gray-600">
          You have unsaved changes to this landlord. Are you sure you want to leave? Your changes will be lost.
        </p>
      </Modal>
      </div>
    );
  }

  // LIST MODE (default)
  return (
    <div>
      {/* Delete Landlord Confirmation */}
      {deletingLandlord && (() => {
        const hasProperties = (deletingLandlord.properties?.length || 0) > 0;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-red-900 mb-2">Delete Landlord</h3>
              {hasProperties ? (
                <>
                  <p className="text-gray-600 mb-4">
                    <strong>{deletingLandlord.name}</strong> cannot be deleted because they have assigned properties. Please reassign or remove these properties first:
                  </p>
                  <ul className="mb-4 space-y-1">
                    {deletingLandlord.properties!.map(p => (
                      <li key={p.id} className="flex items-center gap-2 text-sm text-gray-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                        {p.address_line1}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setDeletingLandlord(null); setDeleteError(null); }}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 rounded-lg font-semibold transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-600 mb-4">
                    This will permanently remove <strong>{deletingLandlord.name}</strong> and their linked user account from the system.
                  </p>
                  <MessageAlert type="error" message={deleteError} className="mb-4 text-sm" />
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800">
                    <strong>This action cannot be undone.</strong>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDelete}
                      disabled={deleteConfirming}
                      className="flex-1 bg-red-700 hover:bg-red-800 text-white py-2.5 rounded-lg font-semibold disabled:opacity-50 transition-colors"
                    >
                      {deleteConfirming ? 'Deleting...' : 'Delete Landlord'}
                    </button>
                    <button
                      onClick={() => { setDeletingLandlord(null); setDeleteError(null); }}
                      disabled={deleteConfirming}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 rounded-lg font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Landlords</h2>
          <p className="text-gray-600">Manage landlord contacts and property links</p>
        </div>
        <button
          onClick={() => onNavigate?.('landlords', { action: 'new' })}
          className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Landlord
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Total Landlords</p>
          <p className="text-2xl font-bold text-gray-900">{landlords.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">With Properties</p>
          <p className="text-2xl font-bold text-green-600">
            {landlords.filter(l => (l.property_count || 0) > 0).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Without Properties</p>
          <p className="text-2xl font-bold text-gray-500">
            {landlords.filter(l => (l.property_count || 0) === 0).length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Landlords List */}
      <div className="bg-white rounded-lg shadow-md">
        {filteredLandlords.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">No landlords found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Phone</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Properties</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLandlords.map(landlord => (
                  <tr key={landlord.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{landlord.name}</td>
                    <td className="py-3 px-4">{landlord.email}</td>
                    <td className="py-3 px-4">{landlord.phone || '-'}</td>
                    <td className="py-3 px-4">{landlord.property_count || 0}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onNavigate?.('landlords', { action: 'edit', id: landlord.id.toString() })}
                          className="px-3 py-1.5 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => { setDeletingLandlord(landlord); setDeleteError(null); }}
                          className="text-sm px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
