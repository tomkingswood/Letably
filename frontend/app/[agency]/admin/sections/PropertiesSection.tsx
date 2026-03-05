'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { properties as propertiesApi, landlords as landlordsApi, propertyAttributes as propertyAttributesApi } from '@/lib/api';
import { Property, Landlord, LETTING_TYPES, PropertyAttributeDefinition, getErrorMessage } from '@/lib/types';
import CustomAttributeField from '@/components/admin/CustomAttributeField';
import { getStatusBadge, getStatusLabel } from '@/lib/statusBadges';
import { useAuth } from '@/lib/auth-context';
import { useAgency } from '@/lib/agency-context';
import { SectionProps } from './index';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import RichTextEditor from '@/components/ui/RichTextEditor';
import EditPropertyView from '../properties/EditPropertyView';
import { MessageAlert } from '@/components/ui/MessageAlert';

export default function PropertiesSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { agencySlug } = useAgency();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [savingOrder, setSavingOrder] = useState(false);
  const isFiltered = searchTerm !== '' || filterLocation !== 'all' || filterStatus !== 'all';

  // Landlords for dropdown
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [landlordsLoading, setLandlordsLoading] = useState(true);

  // Create form state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    address_line1: '',
    address_line2: '',
    city: '',
    postcode: '',
    location: '',
    available_from: '',
    description: '',
    letting_type: 'Whole House' as 'Whole House' | 'Room Only',
    is_live: true,
    landlord_id: '',
  });

  // Custom attributes
  const [attributeDefinitions, setAttributeDefinitions] = useState<PropertyAttributeDefinition[]>([]);
  const [customAttributes, setCustomAttributes] = useState<Record<number, string | number | boolean | null>>({});

  const isCreateMode = action === 'new';
  const isEditMode = !!itemId;
  const isListMode = !isCreateMode && !isEditMode;

  useEffect(() => {
    fetchProperties();
    fetchLandlords();
    fetchAttributeDefinitions();
  }, []);

  const fetchAttributeDefinitions = async () => {
    try {
      const response = await propertyAttributesApi.getDefinitions();
      setAttributeDefinitions(response.data.definitions);
    } catch (err: unknown) {
      console.error('Error fetching attribute definitions:', err);
    }
  };

  // Re-fetch properties when returning to list mode (e.g. after editing)
  useEffect(() => {
    if (isListMode) {
      fetchProperties();
    }
  }, [isListMode]);


  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const response = await propertiesApi.create({
        ...formData,
        landlord_id: formData.landlord_id ? parseInt(formData.landlord_id) : null,
        custom_attributes: customAttributes,
      });

      resetForm();
      setSuccess('Property created successfully!');
      fetchProperties();
      onNavigate?.('properties');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create property'));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      address_line1: '',
      address_line2: '',
      city: '',
      postcode: '',
      location: '',
      available_from: '',
      description: '',
      letting_type: 'Whole House',
      is_live: true,
      landlord_id: '',
    });
    setCustomAttributes({});
    setError('');
    setSuccess('');
  };

  const fetchProperties = async () => {
    try {
      const response = await propertiesApi.getAll();
      setProperties(response.data.properties);
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLandlords = async () => {
    try {
      const response = await landlordsApi.getAll();
      setLandlords(response.data.landlords);
    } catch (err) {
      console.error('Error fetching landlords:', err);
    } finally {
      setLandlordsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this property?')) {
      return;
    }

    try {
      await propertiesApi.delete(id);
      setProperties(properties.filter((p) => p.id !== id));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete property'));
    }
  };

  const moveProperty = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= properties.length) return;
    if (savingOrder) return;

    const newOrder = [...properties];
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setProperties(newOrder);

    setSavingOrder(true);
    try {
      await propertiesApi.updateDisplayOrder(newOrder.map(p => p.id));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save property order'));
      setProperties(properties); // revert on error
    } finally {
      setSavingOrder(false);
    }
  };

  // Get unique locations for filter
  const locations = Array.from(new Set(properties.map(p => p.location))).sort();

  // Filter properties
  const filteredProperties = properties.filter(property => {
    const address = property.address_line1 || '';
    const matchesSearch = address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = filterLocation === 'all' || property.location === filterLocation;
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'live' && property.is_live) ||
      (filterStatus === 'draft' && !property.is_live);
    return matchesSearch && matchesLocation && matchesStatus;
  });

  if (!user) {
    return null;
  }

  // Create Mode - Show inline form
  if (isCreateMode) {
    return (
      <div>
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Add New Property</h2>
            <p className="text-gray-600">Create a new property listing</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              onNavigate?.('properties');
            }}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
        </div>

        <MessageAlert type="error" message={error} className="mb-6" />

        <form onSubmit={handleCreateSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <h3 className="text-xl font-bold">Property Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input
                label="Address Line 1"
                name="address_line1"
                value={formData.address_line1}
                onChange={handleFormChange}
                required
                placeholder="e.g., 60 Burns Road"
              />
            </div>

            <div className="md:col-span-2">
              <Input
                label="Address Line 2"
                name="address_line2"
                value={formData.address_line2}
                onChange={handleFormChange}
                placeholder="Optional"
              />
            </div>

            <Input
              label="City"
              name="city"
              value={formData.city}
              onChange={handleFormChange}
              required
              placeholder="e.g., Sheffield"
            />

            <Input
              label="Postcode"
              name="postcode"
              value={formData.postcode}
              onChange={handleFormChange}
              required
              placeholder="e.g., S3 8DD"
            />

            <Input
              label="Location"
              name="location"
              value={formData.location}
              onChange={handleFormChange}
              placeholder="e.g., City Centre, Broomhill"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Letting Type <span className="text-red-500">*</span>
              </label>
              <select
                name="letting_type"
                value={formData.letting_type}
                onChange={handleFormChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {LETTING_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Whole House: All rooms must be let together. Room Only: Rooms can be let individually.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Landlord
              </label>
              {landlordsLoading ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50">
                  Loading landlords...
                </div>
              ) : (
                <select
                  name="landlord_id"
                  value={formData.landlord_id}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">No landlord assigned</option>
                  {landlords.map(landlord => (
                    <option key={landlord.id} value={landlord.id}>
                      {landlord.name || `Landlord #${landlord.id}`}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Optional: Link this property to a landlord
              </p>
            </div>

            <Input
              label="Available From"
              name="available_from"
              type="date"
              value={formData.available_from}
              onChange={handleFormChange}
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="is_live"
                checked={formData.is_live}
                onChange={handleFormChange}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <span className="ml-2 text-gray-700 font-semibold">Live</span>
            </label>
          </div>

          <div>
            <RichTextEditor
              label="Description"
              value={formData.description}
              onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
              placeholder="Describe the property..."
            />
          </div>

          {/* Custom Property Attributes */}
          {attributeDefinitions.length > 0 && (
            <div>
              <h3 className="text-xl font-bold mb-4">Property Attributes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {attributeDefinitions.map((def) => (
                  <CustomAttributeField
                    key={def.id}
                    definition={def}
                    value={customAttributes[def.id]}
                    onChange={(defId, value) => setCustomAttributes(prev => ({ ...prev, [defId]: value }))}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create Property'}
            </Button>
          </div>
        </form>

      </div>
    );
  }

  // Edit Mode - Show inline edit view
  if (isEditMode && itemId) {
    return (
      <EditPropertyView
        id={itemId}
        onBack={() => onNavigate?.('properties')}
      />
    );
  }

  // List Mode
  return (
    <div>
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Properties Management</h2>
          <p className="text-gray-600">Manage all property listings</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onNavigate?.('properties', { action: 'new' })}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Property
          </button>
        </div>
      </div>

      {error && <MessageAlert type="error" message={error} className="mb-6" onDismiss={() => setError('')} />}
      <MessageAlert type="success" message={success} className="mb-6" />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 mb-1">Total Properties</p>
              <p className="text-3xl font-bold text-primary">{properties.length}</p>
            </div>
            <svg className="w-12 h-12 text-primary/20" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 mb-1">Live Properties</p>
              <p className="text-3xl font-bold text-green-600">{properties.filter(p => p.is_live).length}</p>
            </div>
            <svg className="w-12 h-12 text-green-600/20" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 mb-1">Vacant Bedrooms</p>
              <p className="text-3xl font-bold text-blue-600">
                {properties.reduce((sum, p) => {
                  const vacantRooms = p.bedrooms?.filter(r => r.is_occupied === false).length || 0;
                  return sum + vacantRooms;
                }, 0)}
              </p>
            </div>
            <svg className="w-12 h-12 text-blue-600/20" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 mb-1">Occupied Bedrooms</p>
              <p className="text-3xl font-bold text-gray-600">
                {properties.reduce((sum, p) => {
                  const occupiedRooms = p.bedrooms?.filter(r => r.is_occupied === true).length || 0;
                  return sum + occupiedRooms;
                }, 0)}
              </p>
            </div>
            <svg className="w-12 h-12 text-gray-400/20" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <input
            type="text"
            placeholder="Search by address..."
            aria-label="Search properties by address"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />

          <select
            aria-label="Filter by location"
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="all">All Locations</option>
            {locations.map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>

          <select
            aria-label="Filter by status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="live">Live</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <p className="text-sm text-gray-600">
          Showing {filteredProperties.length} of {properties.length} properties
        </p>
      </div>

      {/* Properties Table/Cards */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredProperties.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="w-16 py-3 px-2 font-semibold text-gray-700 text-center">Order</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Address</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Location</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Bedrooms</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Price PPPW</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Available From</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProperties.map((property, index) => {
                    const pricesAvailable = property.bedrooms?.filter(r => r.price_pppw != null).map(r => Number(r.price_pppw)) ?? [];
                    const lowestPrice = pricesAvailable.length > 0 ? Math.min(...pricesAvailable) : null;
                    const vacantCount = property.bedrooms?.filter(r => r.is_occupied === false).length || 0;
                    const realIndex = properties.indexOf(property);

                    return (
                      <tr
                        key={property.id}
                        className="border-b transition-colors hover:bg-gray-50"
                      >
                        <td className="py-3 px-2 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <button
                              onClick={() => moveProperty(realIndex, 'up')}
                              disabled={realIndex === 0 || savingOrder || isFiltered}
                              className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed"
                              title={isFiltered ? 'Clear filters to reorder' : 'Move up'}
                              aria-label={`Move ${property.address_line1} up`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => moveProperty(realIndex, 'down')}
                              disabled={realIndex === properties.length - 1 || savingOrder || isFiltered}
                              className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed"
                              title={isFiltered ? 'Clear filters to reorder' : 'Move down'}
                              aria-label={`Move ${property.address_line1} down`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium">{property.address_line1}</td>
                        <td className="py-3 px-4">{property.location}</td>
                        <td className="py-3 px-4">
                          {property.bedrooms?.length || 0}
                          {vacantCount > 0 && (
                            <span className="ml-1.5 text-xs text-orange-600 font-medium">({vacantCount} vacant)</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {lowestPrice != null ? `From £${lowestPrice}` : 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          {property.available_from ? new Date(property.available_from).toLocaleDateString('en-GB') : 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge('property', property.is_live ? 'live' : 'draft')}`}>
                            {getStatusLabel('property', property.is_live ? 'live' : 'draft')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => onNavigate?.('properties', { action: 'edit', id: property.id.toString() })}
                              className="px-3 py-1.5 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(property.id)}
                              className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {filteredProperties.map((property) => {
                const lowestPrice = property.bedrooms && property.bedrooms.length > 0
                  ? Math.min(...property.bedrooms.filter(r => r.price_pppw != null).map(r => r.price_pppw!))
                  : null;
                const vacantCount = property.bedrooms?.filter(r => r.is_occupied === false).length || 0;
                const realIndex = properties.indexOf(property);

                return (
                  <div
                    key={property.id}
                    className="border rounded-lg p-4 transition-shadow border-gray-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex flex-col items-center mr-3 gap-0.5">
                        <button
                          onClick={() => moveProperty(realIndex, 'up')}
                          disabled={realIndex === 0 || savingOrder || isFiltered}
                          className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed"
                          title={isFiltered ? 'Clear filters to reorder' : 'Move up'}
                          aria-label={`Move ${property.address_line1} up`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveProperty(realIndex, 'down')}
                          disabled={realIndex === properties.length - 1 || savingOrder || isFiltered}
                          className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed"
                          title={isFiltered ? 'Clear filters to reorder' : 'Move down'}
                          aria-label={`Move ${property.address_line1} down`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-1">{property.address_line1}</h3>
                        <p className="text-sm text-gray-600">{property.location}</p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge('property', property.is_live ? 'live' : 'draft')}`}>
                        {getStatusLabel('property', property.is_live ? 'live' : 'draft')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                      <div>
                        <span className="text-gray-600">Bedrooms:</span>
                        <span className="ml-1 font-medium">{property.bedrooms?.length || 0}</span>
                        {vacantCount > 0 && (
                          <span className="ml-1 text-xs text-orange-600 font-medium">({vacantCount} vacant)</span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-600">Price:</span>
                        <span className="ml-1 font-medium">
                          {lowestPrice != null ? `From £${lowestPrice}` : 'N/A'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600">Available:</span>
                        <span className="ml-1 font-medium">
                          {property.available_from ? new Date(property.available_from).toLocaleDateString('en-GB') : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => onNavigate?.('properties', { action: 'edit', id: property.id.toString() })}
                        className="flex-1 px-3 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(property.id)}
                        className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            {searchTerm || filterLocation !== 'all' || filterStatus !== 'all' ? (
              <div>
                <p className="text-gray-600 mb-4">No properties match your filters</p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterLocation('all');
                    setFilterStatus('all');
                  }}
                  className="text-primary hover:text-primary-dark font-medium"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 mb-4">No properties yet</p>
                <button
                  onClick={() => onNavigate?.('properties', { action: 'new' })}
                  className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg font-bold"
                >
                  Add Your First Property
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
