'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAgency } from '@/lib/agency-context';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { landlords as landlordsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/types';
import { MessageAlert } from '@/components/ui/MessageAlert';

export default function NewLandlordPage() {
  const router = useRouter();
  const { agencySlug } = useAgency();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const response = await landlordsApi.create(formData);
      const newLandlordId = response.data.landlord.id;
      // Redirect to the edit page for the new landlord
      router.push(`/${agencySlug}/admin/landlords/${newLandlordId}`);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to create landlord'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-primary text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">New Landlord</h1>
              <p className="text-xl text-white/90">Add a new landlord to your portfolio</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/${agencySlug}/admin?section=landlords`}
                className="bg-white text-primary hover:bg-gray-100 px-6 py-2 rounded-lg font-semibold transition-colors text-center"
              >
                Back to Landlords
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <MessageAlert type="error" message={error} className="mb-6" />

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
          {/* Basic Information */}
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-gray-900 border-b pb-2">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Display Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="e.g., John Smith Properties"
              />
              <Input
                label="Legal Name"
                name="legal_name"
                value={formData.legal_name}
                onChange={handleChange}
                placeholder="e.g., John Smith Ltd"
              />
              <Input
                label="Agreement Display Format"
                name="agreement_display_format"
                value={formData.agreement_display_format}
                onChange={handleChange}
                placeholder="How name appears on agreements"
              />
              <Input
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="landlord@example.com"
              />
              <Input
                label="Phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+44 7700 900000"
              />
            </div>
          </div>

          {/* Address */}
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-gray-900 border-b pb-2">Address</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Address Line 1"
                name="address_line1"
                value={formData.address_line1}
                onChange={handleChange}
                placeholder="123 Main Street"
              />
              <Input
                label="Address Line 2"
                name="address_line2"
                value={formData.address_line2}
                onChange={handleChange}
                placeholder="Apartment 4"
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
                placeholder="S1 1AA"
              />
            </div>
          </div>

          {/* Bank Details */}
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-gray-900 border-b pb-2">Bank Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Bank Name"
                name="bank_name"
                value={formData.bank_name}
                onChange={handleChange}
                placeholder="Barclays"
              />
              <Input
                label="Account Name"
                name="bank_account_name"
                value={formData.bank_account_name}
                onChange={handleChange}
                placeholder="John Smith Ltd"
              />
              <Input
                label="Sort Code"
                name="sort_code"
                value={formData.sort_code}
                onChange={handleChange}
                placeholder="12-34-56"
              />
              <Input
                label="Account Number"
                name="account_number"
                value={formData.account_number}
                onChange={handleChange}
                placeholder="12345678"
              />
            </div>
          </div>

          {/* Settings */}
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-gray-900 border-b pb-2">Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Utilities Cap Amount"
                name="utilities_cap_amount"
                type="number"
                value={formData.utilities_cap_amount}
                onChange={handleChange}
                placeholder="Monthly cap for utilities"
              />
              <div className="space-y-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="council_tax_in_bills"
                    checked={formData.council_tax_in_bills}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span>Council Tax in Bills</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="manage_rent"
                    checked={formData.manage_rent}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span>Manage Rent Collection</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="receive_maintenance_notifications"
                    checked={formData.receive_maintenance_notifications}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span>Receive Maintenance Notifications</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="receive_tenancy_communications"
                    checked={formData.receive_tenancy_communications}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span>Receive Tenancy Communications</span>
                </label>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-gray-900 border-b pb-2">Notes</h2>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Internal notes about this landlord..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create Landlord'}
            </Button>
            <Link
              href={`/${agencySlug}/admin?section=landlords`}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
