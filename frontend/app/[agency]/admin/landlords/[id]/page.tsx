'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAgency } from '@/lib/agency-context';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { landlords as landlordsApi, agreementSections as sectionsApi } from '@/lib/api';
import type { Landlord, AgreementSection, Agreement } from '@/lib/types';
import { getErrorMessage } from '@/lib/types';
import AgreementDocument from '@/components/AgreementDocument';
import { AgreementEditor } from '@/components/agreement-editor';
import { formatTenancyPeriod } from '@/lib/dateUtils';
import { MessageAlert } from '@/components/ui/MessageAlert';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function LandlordEditPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { agencySlug } = useAgency();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Landlord form state
  const [formData, setFormData] = useState({
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
  });

  // Agreement sections state
  const [defaultSections, setDefaultSections] = useState<AgreementSection[]>([]);
  const [landlordSections, setLandlordSections] = useState<AgreementSection[]>([]);
  const [showDefaultSections, setShowDefaultSections] = useState(false);
  const [editingInlineId, setEditingInlineId] = useState<string | null>(null); // Format: "default-{key}" or "section-{id}"
  const [creatingNew, setCreatingNew] = useState(false);
  const [originalDefaultContent, setOriginalDefaultContent] = useState<AgreementSection | null>(null);

  // Preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewAgreement, setPreviewAgreement] = useState<Agreement | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [showTestDataConfig, setShowTestDataConfig] = useState(false);

  // Test data configuration for previews
  const [testData, setTestData] = useState({
    // Primary tenant
    primary_tenant_first_name: 'John',
    primary_tenant_last_name: 'Smith',
    primary_tenant_email: 'john.smith@example.com',
    primary_tenant_phone: '07700900123',
    primary_tenant_address: '45 Test Lane, Manchester, M1 1AA',
    primary_tenant_rent: '125',
    primary_tenant_deposit: '500',
    primary_tenant_room: 'Room 1 (Double)',
    // Second tenant (for whole house)
    second_tenant_first_name: 'Jane',
    second_tenant_last_name: 'Doe',
    second_tenant_email: 'jane.doe@example.com',
    second_tenant_phone: '07700900456',
    second_tenant_address: '67 Sample Road, Leeds, LS1 1BB',
    second_tenant_rent: '115',
    second_tenant_deposit: '450',
    second_tenant_room: 'Room 2 (Single)',
    // Property
    property_address_line1: '123 Example Street',
    property_address_line2: '',
    property_city: 'Sheffield',
    property_postcode: 'S1 2AB',
    property_bedrooms: '5',
    property_bathrooms: '2',
    // Tenancy
    start_date: '2025-09-01',
    end_date: '2026-08-31',
    is_rolling_monthly: false,
    // Financials
    utilities_cap_enabled: true,
    utilities_cap_amount: '50',
    council_tax_included: true,
  });

  const [sectionFormData, setSectionFormData] = useState({
    section_key: '',
    section_title: '',
    section_content: '',
    section_order: '',
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [landlordRes, defaultSectionsRes, landlordSectionsRes] = await Promise.all([
        landlordsApi.getById(id),
        sectionsApi.getAll({ landlord_id: 'default', agreement_type: 'tenancy_agreement' }),
        sectionsApi.getAll({ landlord_id: id, agreement_type: 'tenancy_agreement' })
      ]);

      const landlord = landlordRes.data.landlord;
      setFormData({
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
      });

      setDefaultSections(defaultSectionsRes.data.sections);
      setLandlordSections(landlordSectionsRes.data.sections.filter((s: AgreementSection) => s.landlord_id));

    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load landlord'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await landlordsApi.update(id, formData);
      setSuccess('Landlord updated successfully!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update landlord'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOverrideSection = (defaultSection: AgreementSection) => {
    const inlineId = `default-${defaultSection.section_key}`;
    setEditingInlineId(inlineId);
    setOriginalDefaultContent(defaultSection); // Store original for reference
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
    setOriginalDefaultContent(defaultSection || null); // Store original if it's an override
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
        landlord_id: parseInt(id),
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
      const landlordSectionsRes = await sectionsApi.getAll({ landlord_id: id, agreement_type: 'tenancy_agreement' });
      setLandlordSections(landlordSectionsRes.data.sections.filter((s: AgreementSection) => s.landlord_id));

      handleCancelSection();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save section'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      const landlordSectionsRes = await sectionsApi.getAll({ landlord_id: id, agreement_type: 'tenancy_agreement' });
      setLandlordSections(landlordSectionsRes.data.sections.filter((s: AgreementSection) => s.landlord_id));

      window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const isOverridden = (sectionKey: string) => {
    return landlordSections.some(s => s.section_key === sectionKey);
  };

  const handlePreviewAgreement = async (tenancyType: 'room_only' | 'whole_house') => {
    setPreviewLoading(true);
    setPreviewError('');
    setShowPreviewModal(true);
    setPreviewAgreement(null);

    try {
      const response = await landlordsApi.previewAgreement(id, tenancyType, testData);
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

  // Merge all sections and add type indicator
  const getAllSectionsInOrder = () => {
    const allSections: any[] = [];

    // Add all default sections
    defaultSections.forEach(defaultSection => {
      const landlordOverride = landlordSections.find(ls => ls.section_key === defaultSection.section_key);

      if (landlordOverride) {
        // This default section has been overridden
        allSections.push({
          ...landlordOverride,
          type: 'override',
          defaultSection: defaultSection
        });
      } else {
        // This default section is being used as-is
        allSections.push({
          ...defaultSection,
          type: 'default'
        });
      }
    });

    // Add custom landlord sections (those not overriding any default)
    const defaultSectionKeys = defaultSections.map(ds => ds.section_key);
    landlordSections.forEach(landlordSection => {
      if (!defaultSectionKeys.includes(landlordSection.section_key)) {
        allSections.push({
          ...landlordSection,
          type: 'custom'
        });
      }
    });

    // Sort by section_order
    return allSections.sort((a, b) => a.section_order - b.section_order);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-gray-600 mt-4">Loading landlord...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-primary text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Edit Landlord</h1>
              <p className="text-xl text-white/90">{formData.name || 'Unnamed Landlord'}</p>
            </div>
            <Link
              href={`/${agencySlug}/admin?section=landlords`}
              className="bg-white text-primary hover:bg-gray-100 px-6 py-2 rounded-lg font-semibold transition-colors"
            >
              Back to Landlords
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Messages */}
        <MessageAlert type="success" message={success} className="mb-4" />
        <MessageAlert type="error" message={error} className="mb-4" />

        {/* Landlord Information Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold mb-6">Landlord Information</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Name"
                  name="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Landlord name, company, or family"
                />

                <Input
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="contact@email.com"
                />

                <Input
                  label="Phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="01234 567890"
                />
              </div>
            </div>

            {/* Address */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Address Line 1"
                  name="address_line1"
                  value={formData.address_line1}
                  onChange={(e) => setFormData(prev => ({ ...prev, address_line1: e.target.value }))}
                  placeholder="Street address"
                />

                <Input
                  label="Address Line 2"
                  name="address_line2"
                  value={formData.address_line2}
                  onChange={(e) => setFormData(prev => ({ ...prev, address_line2: e.target.value }))}
                  placeholder="Additional address details"
                />

                <Input
                  label="City"
                  name="city"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Sheffield"
                />

                <Input
                  label="Postcode"
                  name="postcode"
                  value={formData.postcode}
                  onChange={(e) => setFormData(prev => ({ ...prev, postcode: e.target.value }))}
                  placeholder="S1 2AB"
                />
              </div>
            </div>

            {/* Agreement Information */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Agreement Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Legal Name"
                  name="legal_name"
                  value={formData.legal_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, legal_name: e.target.value }))}
                  placeholder="e.g., Makkar Family Ltd"
                />

                <Input
                  label="Agreement Display Format"
                  name="agreement_display_format"
                  value={formData.agreement_display_format}
                  onChange={(e) => setFormData(prev => ({ ...prev, agreement_display_format: e.target.value }))}
                  placeholder="e.g., ABC Lettings Ltd, c/o XYZ Property Ltd"
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                The display format will be shown on tenancy agreements. Leave blank to use the landlord name.
              </p>
            </div>

            {/* Bank Details */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Bank Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Bank Name"
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
                  placeholder="e.g., LLOYDS, NATWEST"
                />

                <Input
                  label="Bank Account Name"
                  name="bank_account_name"
                  value={formData.bank_account_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, bank_account_name: e.target.value }))}
                  placeholder="e.g., Makkar Family Ltd"
                />

                <Input
                  label="Sort Code"
                  name="sort_code"
                  value={formData.sort_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, sort_code: e.target.value }))}
                  placeholder="e.g., 30-98-97"
                />

                <Input
                  label="Account Number"
                  name="account_number"
                  value={formData.account_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, account_number: e.target.value }))}
                  placeholder="e.g., 47215859"
                />
              </div>
            </div>

            {/* Agreement Settings */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Agreement Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Utilities Cap Amount (£)"
                  name="utilities_cap_amount"
                  type="number"
                  step="0.01"
                  value={formData.utilities_cap_amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, utilities_cap_amount: e.target.value }))}
                  placeholder="e.g., 2150.00"
                />

                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="council_tax_in_bills"
                      checked={formData.council_tax_in_bills}
                      onChange={(e) => setFormData(prev => ({ ...prev, council_tax_in_bills: e.target.checked }))}
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
                      checked={formData.manage_rent}
                      onChange={(e) => setFormData(prev => ({ ...prev, manage_rent: e.target.checked }))}
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
                      checked={formData.receive_maintenance_notifications}
                      onChange={(e) => setFormData(prev => ({ ...prev, receive_maintenance_notifications: e.target.checked }))}
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
                      checked={formData.receive_tenancy_communications}
                      onChange={(e) => setFormData(prev => ({ ...prev, receive_tenancy_communications: e.target.checked }))}
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
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Additional notes or comments..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit">
                Save Landlord
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push(`/${agencySlug}/admin?section=landlords`)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>

        {/* Agreement Sections Management */}
        <div className="bg-white rounded-lg shadow-md p-6" id="agreement-sections">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Agreement Sections</h2>
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
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Preview Agreement with Test Data</h3>
                <p className="text-sm text-blue-700">Test how your agreement sections will look with customizable sample data</p>
              </div>
              <div className="flex gap-3">
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
                    <h4 className="font-semibold text-blue-900 text-sm uppercase tracking-wide">Primary Tenant</h4>
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
                      value={testData.primary_tenant_phone}
                      onChange={(e) => setTestData(prev => ({ ...prev, primary_tenant_phone: e.target.value }))}
                      placeholder="Phone"
                      className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={testData.primary_tenant_address}
                      onChange={(e) => setTestData(prev => ({ ...prev, primary_tenant_address: e.target.value }))}
                      placeholder="Current address"
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
                    <h4 className="font-semibold text-blue-900 text-sm uppercase tracking-wide">Second Tenant (Whole House)</h4>
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
                      value={testData.second_tenant_phone}
                      onChange={(e) => setTestData(prev => ({ ...prev, second_tenant_phone: e.target.value }))}
                      placeholder="Phone"
                      className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={testData.second_tenant_address}
                      onChange={(e) => setTestData(prev => ({ ...prev, second_tenant_address: e.target.value }))}
                      placeholder="Current address"
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
                    <h4 className="font-semibold text-blue-900 text-sm uppercase tracking-wide">Property & Tenancy</h4>
                    <input
                      type="text"
                      value={testData.property_address_line1}
                      onChange={(e) => setTestData(prev => ({ ...prev, property_address_line1: e.target.value }))}
                      placeholder="Address line 1"
                      className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={testData.property_address_line2}
                      onChange={(e) => setTestData(prev => ({ ...prev, property_address_line2: e.target.value }))}
                      placeholder="Address line 2 (optional)"
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
                        <label className="text-xs text-blue-700">Bedrooms</label>
                        <input
                          type="number"
                          value={testData.property_bedrooms}
                          onChange={(e) => setTestData(prev => ({ ...prev, property_bedrooms: e.target.value }))}
                          className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-blue-700">Bathrooms</label>
                        <input
                          type="number"
                          value={testData.property_bathrooms}
                          onChange={(e) => setTestData(prev => ({ ...prev, property_bathrooms: e.target.value }))}
                          className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
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
                        <label className="text-xs text-blue-700">End date {testData.is_rolling_monthly && <span className="text-blue-500">(N/A for rolling)</span>}</label>
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
                            // Clear end date when rolling monthly is enabled
                            end_date: e.target.checked ? '' : prev.end_date
                          }))}
                          className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-blue-900">Rolling monthly tenancy</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={testData.utilities_cap_enabled}
                          onChange={(e) => setTestData(prev => ({ ...prev, utilities_cap_enabled: e.target.checked }))}
                          className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-blue-900">Utilities cap (£{testData.utilities_cap_amount}/week)</span>
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
              <h3 className="text-lg font-bold mb-4">Create New Section</h3>
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

          {/* All Sections Unified View */}
          <div>
            <div className="mb-4 flex items-center gap-4">
              <h3 className="font-bold text-lg">All Agreement Sections ({getAllSectionsInOrder().length})</h3>
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

                // Color scheme based on type
                const borderColor = isDefault ? 'border-green-200' : isOverride ? 'border-orange-200' : 'border-blue-200';
                const bgColor = isDefault ? 'bg-green-50' : isOverride ? 'bg-orange-50' : 'bg-blue-50';
                const badgeColor = isDefault ? 'bg-green-100 text-green-800' : isOverride ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800';
                const indicatorColor = isDefault ? 'bg-green-500' : isOverride ? 'bg-orange-500' : 'bg-blue-500';

                // Check if this section is being edited
                const inlineId = isDefault ? `default-${section.section_key}` : `section-${section.id}`;
                const isEditing = editingInlineId === inlineId;

                return (
                  <div key={section.id || section.section_key} className={`border ${borderColor} rounded-lg p-4 ${bgColor} relative`}>
                    {/* Type Indicator */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${indicatorColor} rounded-l-lg`}></div>

                    <div className="ml-2">
                      {/* Section Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold">{section.section_title}</h4>
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

                      {/* Inline Edit Form or Display */}
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

                          {/* Original Default Content (for reference when editing override) */}
                          {originalDefaultContent && (
                            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <h4 className="text-sm font-semibold text-gray-700">Original Default Section (for reference)</h4>
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
      </div>

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Agreement Preview</h2>
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

            {/* Modal Body */}
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
                  {/* Preview Info Banner */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <h3 className="font-semibold text-yellow-900 mb-1">Preview Mode - Dummy Data</h3>
                        <p className="text-sm text-yellow-800">
                          This is a preview using sample data. Actual agreements will use real tenant and property information.
                          Tenant: John Smith{previewAgreement.tenancy.tenancy_type === 'whole_house' && ' and Jane Doe'} •
                          Property: 123 Example Street, Sheffield
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Agreement Metadata - Custom for Preview */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h3 className="font-bold text-blue-900 mb-2">Agreement Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-blue-700 font-medium">Landlord</p>
                        <p className="text-blue-900">{previewAgreement.landlord.display_name}</p>
                      </div>
                      <div>
                        <p className="text-blue-700 font-medium">Tenancy Period</p>
                        <p className="text-blue-900">
                          {formatTenancyPeriod(previewAgreement.tenancy.start_date, previewAgreement.tenancy.end_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-blue-700 font-medium">Tenancy Type</p>
                        <p className="text-blue-900">
                          {previewAgreement.tenancy.tenancy_type === 'room_only' ? 'Room Only (1 tenant)' : 'Whole House (2 tenants)'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Agreement Document - Using shared component */}
                  <AgreementDocument
                    agreement={previewAgreement}
                    showInfoBox={false}
                    showSignatures={false}
                  />
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-6 py-4 flex justify-between items-center bg-gray-50">
              <p className="text-sm text-gray-600">
                {previewAgreement && `${previewAgreement.sections.length} sections rendered`}
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
                  className="px-4 py-2 bg-primary text-white rounded hover:bg-orange-600 transition-colors"
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
