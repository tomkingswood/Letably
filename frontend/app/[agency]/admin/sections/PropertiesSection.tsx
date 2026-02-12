'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { properties as propertiesApi, landlords as landlordsApi } from '@/lib/api';
import { Property, Landlord, LETTING_TYPES, getErrorMessage } from '@/lib/types';
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
  const [reorderMode, setReorderMode] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [originalOrder, setOriginalOrder] = useState<Property[]>([]);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

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
    bathrooms: '',
    communal_areas: '',
    available_from: '',
    property_type: 'House',
    has_parking: false,
    has_garden: false,
    bills_included: true,
    broadband_speed: '',
    description: '',
    map_embed: '',
    street_view_embed: '',
    letting_type: 'Whole House' as 'Whole House' | 'Room Only',
    is_live: true,
    landlord_id: '',
    youtube_url: '',
  });

  const isCreateMode = action === 'new';
  const isEditMode = !!itemId;
  const isListMode = !isCreateMode && !isEditMode;

  useEffect(() => {
    fetchProperties();
    fetchLandlords();
  }, []);

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
        bathrooms: parseInt(formData.bathrooms),
        communal_areas: parseInt(formData.communal_areas) || 0,
        landlord_id: formData.landlord_id ? parseInt(formData.landlord_id) : null,
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
      bathrooms: '',
      communal_areas: '',
      available_from: '',
      property_type: 'House',
      has_parking: false,
      has_garden: false,
      bills_included: true,
      broadband_speed: '',
      description: '',
      map_embed: '',
      street_view_embed: '',
      letting_type: 'Whole House',
      is_live: true,
      landlord_id: '',
      youtube_url: '',
    });
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
    } catch (error) {
      console.error('Error deleting property:', error);
      alert('Failed to delete property');
    }
  };

  const enterReorderMode = () => {
    setOriginalOrder([...properties]);
    setReorderMode(true);
  };

  const cancelReorder = () => {
    setProperties(originalOrder);
    setReorderMode(false);
    setOriginalOrder([]);
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }

    const newOrder = [...properties];
    const draggedItem = newOrder[dragItem.current];
    newOrder.splice(dragItem.current, 1);
    newOrder.splice(dragOverItem.current, 0, draggedItem);

    setProperties(newOrder);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const saveOrder = async () => {
    setSavingOrder(true);
    try {
      const propertyIds = properties.map(p => p.id);
      await propertiesApi.updateDisplayOrder(propertyIds);
      setReorderMode(false);
      setOriginalOrder([]);
    } catch (error) {
      console.error('Error saving order:', error);
      alert('Failed to save property order');
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
                Property Type <span className="text-red-500">*</span>
              </label>
              <select
                name="property_type"
                value={formData.property_type}
                onChange={handleFormChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="House">House</option>
                <option value="Flat">Flat</option>
                <option value="Apartment">Apartment</option>
              </select>
            </div>

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
              label="Bathrooms"
              name="bathrooms"
              type="number"
              min="1"
              value={formData.bathrooms}
              onChange={handleFormChange}
              required
            />

            <Input
              label="Communal Areas"
              name="communal_areas"
              type="number"
              min="0"
              value={formData.communal_areas}
              onChange={handleFormChange}
              placeholder="e.g., 2"
            />

            <Input
              label="Available From"
              name="available_from"
              type="date"
              value={formData.available_from}
              onChange={handleFormChange}
            />

            <Input
              label="Broadband Speed"
              name="broadband_speed"
              value={formData.broadband_speed}
              onChange={handleFormChange}
              placeholder="e.g., 100Mbps"
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="has_parking"
                checked={formData.has_parking}
                onChange={handleFormChange}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <span className="ml-2 text-gray-700">Has Parking</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                name="has_garden"
                checked={formData.has_garden}
                onChange={handleFormChange}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <span className="ml-2 text-gray-700">Has Garden</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                name="bills_included"
                checked={formData.bills_included}
                onChange={handleFormChange}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <span className="ml-2 text-gray-700">Bills Included</span>
            </label>

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

          {/* Google Maps, Street View & YouTube */}
          <div>
            <h3 className="text-xl font-bold mb-4">Media Embeds</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  YouTube Video URL
                </label>
                <input
                  type="url"
                  name="youtube_url"
                  value={formData.youtube_url}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Paste the YouTube video URL (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google Maps Embed Code
                </label>
                <textarea
                  name="map_embed"
                  value={formData.map_embed}
                  onChange={handleFormChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                  placeholder='<iframe src="https://www.google.com/maps/embed?pb=..." width="100%" height="100%" style="border:0;" allowfullscreen="" loading="lazy"></iframe>'
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get embed code from Google Maps &rarr; Share &rarr; Embed a map
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google Street View Embed Code
                </label>
                <textarea
                  name="street_view_embed"
                  value={formData.street_view_embed}
                  onChange={handleFormChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                  placeholder='<iframe src="https://www.google.com/maps/embed?pb=!4v..." width="100%" height="100%" style="border:0;" allowfullscreen="" loading="lazy"></iframe>'
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get embed code from Google Maps Street View &rarr; Share &rarr; Embed a map
                </p>
              </div>
            </div>
          </div>

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
          {reorderMode ? (
            <>
              <button
                onClick={saveOrder}
                disabled={savingOrder}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 w-full sm:w-auto disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {savingOrder ? 'Saving...' : 'Save Order'}
              </button>
              <button
                onClick={cancelReorder}
                disabled={savingOrder}
                className="bg-gray-200 text-gray-700 hover:bg-gray-300 px-6 py-2 rounded-lg font-semibold transition-colors w-full sm:w-auto disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onNavigate?.('properties', { action: 'new' })}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Property
              </button>
              <button
                onClick={enterReorderMode}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Reorder
              </button>
            </>
          )}
        </div>
      </div>

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
              <p className="text-gray-600 mb-1">Available Bedrooms</p>
              <p className="text-3xl font-bold text-blue-600">
                {properties.reduce((sum, p) => {
                  const availableRooms = p.bedrooms?.filter(r => r.status === 'available').length || 0;
                  return sum + availableRooms;
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
              <p className="text-gray-600 mb-1">Let Bedrooms</p>
              <p className="text-3xl font-bold text-gray-600">
                {properties.reduce((sum, p) => {
                  const letRooms = p.bedrooms?.filter(r => r.status === 'let').length || 0;
                  return sum + letRooms;
                }, 0)}
              </p>
            </div>
            <svg className="w-12 h-12 text-gray-400/20" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* Filters - hidden in reorder mode */}
      {!reorderMode && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <input
              type="text"
              placeholder="Search by address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />

            <select
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
      )}

      {/* Reorder Mode Banner */}
      {reorderMode && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            <div>
              <p className="font-medium text-purple-900">Reorder Mode Active</p>
              <p className="text-sm text-purple-700">Drag rows to reorder. This changes the display order on the public properties page.</p>
            </div>
          </div>
        </div>
      )}

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
                    {reorderMode && <th className="w-12 py-3 px-2"></th>}
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Address</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Location</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Bedrooms</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Price PPPW</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Available From</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    {!reorderMode && <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {(reorderMode ? properties : filteredProperties).map((property, index) => {
                    const pricesAvailable = property.bedrooms?.filter(r => r.price_pppw != null).map(r => r.price_pppw!) ?? [];
                    const lowestPrice = pricesAvailable.length > 0 ? Math.min(...pricesAvailable) : null;

                    return (
                      <tr
                        key={property.id}
                        draggable={reorderMode}
                        onDragStart={() => reorderMode && handleDragStart(index)}
                        onDragEnter={() => reorderMode && handleDragEnter(index)}
                        onDragEnd={() => reorderMode && handleDragEnd()}
                        onDragOver={(e) => reorderMode && e.preventDefault()}
                        className={`border-b transition-colors ${reorderMode ? 'cursor-move hover:bg-purple-50' : 'hover:bg-gray-50'}`}
                      >
                        {reorderMode && (
                          <td className="py-3 px-2 text-center">
                            <div className="flex items-center justify-center text-gray-400">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                              </svg>
                            </div>
                          </td>
                        )}
                        <td className="py-3 px-4 font-medium">{property.address_line1}</td>
                        <td className="py-3 px-4">{property.location}</td>
                        <td className="py-3 px-4">{property.bedrooms?.length || 0}</td>
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
                        {!reorderMode && (
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
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {(reorderMode ? properties : filteredProperties).map((property, index) => {
                const lowestPrice = property.bedrooms && property.bedrooms.length > 0
                  ? Math.min(...property.bedrooms.filter(r => r.price_pppw != null).map(r => r.price_pppw!))
                  : null;

                return (
                  <div
                    key={property.id}
                    draggable={reorderMode}
                    onDragStart={() => reorderMode && handleDragStart(index)}
                    onDragEnter={() => reorderMode && handleDragEnter(index)}
                    onDragEnd={() => reorderMode && handleDragEnd()}
                    onDragOver={(e) => reorderMode && e.preventDefault()}
                    className={`border rounded-lg p-4 transition-shadow ${reorderMode ? 'border-purple-200 cursor-move hover:bg-purple-50' : 'border-gray-200 hover:shadow-md'}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      {reorderMode && (
                        <div className="mr-3 text-gray-400">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                          </svg>
                        </div>
                      )}
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

                    {!reorderMode && (
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
                    )}
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
