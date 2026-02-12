'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAgency } from '@/lib/agency-context';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { properties as propertiesApi, bedrooms as bedroomsApi, images as imagesApi, landlords as landlordsApi, certificateTypes as certificateTypesApi, certificates as certificatesApi } from '@/lib/api';
import { LETTING_TYPES, Property, Bedroom, Landlord, getErrorMessage } from '@/lib/types';
import { sanitizeHtml } from '@/lib/sanitize';
import { getImageUrl as getFullImageUrl } from '@/lib/image-url';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { MessageAlert } from '@/components/ui/MessageAlert';

interface EditPropertyViewProps {
  id: string;
  onBack: () => void;
}

export default function EditPropertyView({ id, onBack }: EditPropertyViewProps) {
  const { agencySlug, agency } = useAgency();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Bedroom[]>([]);
  const [landlordsLoading, setLandlordsLoading] = useState(true);
  const [landlords, setLandlords] = useState<Landlord[]>([]);

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
    youtube_url: '',
    letting_type: 'Whole House' as 'Whole House' | 'Room Only',
    landlord_id: '',
    is_live: true,
  });

  // Unsaved changes tracking
  const initialFormData = useRef<string | null>(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  const isDirty = useCallback(() => {
    if (initialFormData.current === null) return false;
    return JSON.stringify(formData) !== initialFormData.current;
  }, [formData]);

  // Bedroom form state
  const [showBedroomForm, setShowBedroomForm] = useState(false);
  const [editingBedroomId, setEditingBedroomId] = useState<number | null>(null);
  const [bedroomFormData, setBedroomFormData] = useState({
    bedroom_name: '',
    status: 'available',
    price_pppw: '',
    bedroom_description: '',
    available_from: '',
    youtube_url: '',
  });

  // Image upload state
  const [uploadingPropertyImage, setUploadingPropertyImage] = useState(false);
  const [uploadingBedroomImage, setUploadingBedroomImage] = useState(false);
  const [selectedRoomForImage, setSelectedRoomForImage] = useState<number | null>(null);

  // Certificate system state
  const [certificateTypes, setCertificateTypes] = useState<any[]>([]);
  const [propertyCertificates, setPropertyCertificates] = useState<any[]>([]);
  const [uploadingCertificates, setUploadingCertificates] = useState<{ [typeId: number]: boolean }>({});

  // Image viewer state
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Drag-and-drop state
  const [draggedBedroom, setDraggedBedroom] = useState<number | null>(null);
  const [dragOverBedroom, setDragOverBedroom] = useState<number | null>(null);

  // Bedroom image linking state
  const [showPropertyImagesForBedroom, setShowPropertyImagesForBedroom] = useState<number | null>(null);
  const [linkingImage, setLinkingImage] = useState(false);

  // Update document title when property loads
  useEffect(() => {
    if (property) {
      const propertyTitle = property.address_line1 || 'Property';
      const bedroomInfo = property.bedrooms?.length ? `${property.bedrooms.length} Bed` : '';
      const propertyType = property.property_type || 'Property';
      document.title = `${propertyTitle} - ${bedroomInfo} ${propertyType}`.trim();
    } else {
      document.title = 'Edit Property';
    }
  }, [property]);

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
    fetchProperty();
    fetchLandlords();
    fetchCertificateTypes();
    fetchPropertyCertificates();
  }, [id]);

  const fetchLandlords = async () => {
    try {
      const response = await landlordsApi.getAll();
      setLandlords(response.data.landlords);
    } catch (err: unknown) {
      console.error('Error fetching landlords:', err);
    } finally {
      setLandlordsLoading(false);
    }
  };

  const fetchCertificateTypes = async () => {
    try {
      const response = await certificateTypesApi.getAll('property');
      setCertificateTypes(response.data.certificateTypes);
    } catch (err: unknown) {
      console.error('Error fetching certificate types:', err);
    }
  };

  const fetchPropertyCertificates = async () => {
    try {
      const response = await certificatesApi.getByEntity('property', id);
      setPropertyCertificates(response.data.certificates);
    } catch (err: unknown) {
      console.error('Error fetching property certificates:', err);
    }
  };

  const fetchProperty = async () => {
    try {
      const response = await propertiesApi.getById(id);
      const prop = response.data.property;
      setProperty(prop);
      setRooms(prop.bedrooms || []);

      const loadedFormData = {
        address_line1: prop.address_line1 || '',
        address_line2: prop.address_line2 || '',
        city: prop.city || '',
        postcode: prop.postcode || '',
        location: prop.location,
        bathrooms: prop.bathrooms?.toString() || '',
        communal_areas: prop.communal_areas?.toString() || '0',
        available_from: prop.available_from ? prop.available_from.split('T')[0] : '',
        property_type: prop.property_type,
        has_parking: prop.has_parking,
        has_garden: prop.has_garden,
        bills_included: prop.bills_included,
        broadband_speed: prop.broadband_speed || '',
        description: prop.description || '',
        map_embed: prop.map_embed || '',
        street_view_embed: prop.street_view_embed || '',
        youtube_url: prop.youtube_url || '',
        letting_type: prop.letting_type || 'Whole House',
        landlord_id: prop.landlord_id ? prop.landlord_id.toString() : '',
        is_live: prop.is_live !== undefined ? prop.is_live : true,
      };
      setFormData(loadedFormData);
      initialFormData.current = JSON.stringify(loadedFormData);
    } catch (err: unknown) {
      setError('Failed to load property');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await propertiesApi.update(id, {
        ...formData,
        bathrooms: parseInt(formData.bathrooms),
        communal_areas: parseInt(formData.communal_areas) || 0,
        landlord_id: formData.landlord_id ? parseInt(formData.landlord_id) : null,
      });
      setSuccess('Property updated successfully!');
      initialFormData.current = JSON.stringify(formData);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update property'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  // Bedroom Management
  const handleBedroomChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setBedroomFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddBedroom = () => {
    setEditingBedroomId(null);
    setBedroomFormData({
      bedroom_name: '',
      status: 'available',
      price_pppw: '',
      bedroom_description: '',
      available_from: '',
      youtube_url: '',
    });
    setShowBedroomForm(true);
  };

  const handleEditBedroom = (room: Bedroom) => {
    setEditingBedroomId(room.id);
    setBedroomFormData({
      bedroom_name: room.bedroom_name,
      status: room.status,
      price_pppw: room.price_pppw?.toString() || '',
      bedroom_description: room.bedroom_description || '',
      available_from: room.available_from ? room.available_from.split('T')[0] : '',
      youtube_url: room.youtube_url || '',
    });
    setShowBedroomForm(false);
  };

  const handleCancelEdit = () => {
    setEditingBedroomId(null);
    setBedroomFormData({
      bedroom_name: '',
      status: 'available',
      price_pppw: '',
      bedroom_description: '',
      available_from: '',
      youtube_url: '',
    });
  };

  const handleSaveBedroom = async (roomId?: number) => {
    setError('');
    try {
      if (roomId) {
        await bedroomsApi.update(roomId, {
          ...bedroomFormData,
          price_pppw: bedroomFormData.price_pppw ? parseFloat(bedroomFormData.price_pppw) : null,
        });
        setSuccess('Bedroom updated successfully!');
        setEditingBedroomId(null);
      } else {
        await bedroomsApi.create(id, {
          ...bedroomFormData,
          price_pppw: bedroomFormData.price_pppw ? parseFloat(bedroomFormData.price_pppw) : null,
        });
        setSuccess('Bedroom added successfully!');
        setShowBedroomForm(false);
      }
      fetchProperty();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save bedroom'));
    }
  };

  const handleDeleteBedroom = async (roomId: number) => {
    if (!confirm('Are you sure you want to delete this bedroom?')) return;

    setError('');
    try {
      await bedroomsApi.delete(roomId);
      setSuccess('Bedroom deleted successfully!');
      fetchProperty();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete bedroom'));
    }
  };

  // Image Upload
  const handlePropertyImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPropertyImage(true);
    setError('');

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
      }
      formData.append('property_id', id);
      await imagesApi.upload(formData);
      setSuccess(`${files.length} image(s) uploaded successfully!`);
      fetchProperty();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to upload images'));
    } finally {
      setUploadingPropertyImage(false);
      e.target.value = '';
    }
  };

  const handleBedroomImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, roomId: number) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingBedroomImage(true);
    setError('');

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
      }
      formData.append('property_id', id);
      formData.append('bedroom_id', roomId.toString());
      await imagesApi.upload(formData);
      setSuccess(`${files.length} bedroom image(s) uploaded successfully!`);
      fetchProperty();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to upload bedroom images'));
    } finally {
      setUploadingBedroomImage(false);
      setSelectedRoomForImage(null);
      e.target.value = '';
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    if (!confirm('Are you sure you want to delete this image?')) return;

    setError('');
    try {
      await imagesApi.delete(imageId);
      setSuccess('Image deleted successfully!');
      fetchProperty();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete image'));
    }
  };

  const handleSetPrimaryImage = async (imageId: number) => {
    setError('');
    try {
      await imagesApi.setPrimary(imageId);
      setSuccess('Primary image set successfully!');
      fetchProperty();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to set primary image'));
    }
  };

  // Dynamic Certificate Upload/Delete Handlers
  const handleCertificateUpload = (typeId: number, typeName: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed for certificates');
      e.target.value = '';
      return;
    }

    setUploadingCertificates({ ...uploadingCertificates, [typeId]: true });
    setError('');

    try {
      const formData = new FormData();
      formData.append('certificate', file);
      await certificatesApi.upload('property', id, typeId, formData);
      setSuccess(`${typeName} uploaded successfully!`);
      await fetchPropertyCertificates();
    } catch (err: unknown) {
      setError(getErrorMessage(err, `Failed to upload ${typeName}`));
    } finally {
      setUploadingCertificates({ ...uploadingCertificates, [typeId]: false });
      e.target.value = '';
    }
  };

  const handleCertificateDelete = async (typeId: number, typeName: string) => {
    if (!confirm(`Are you sure you want to delete the ${typeName}?`)) return;

    setError('');
    try {
      await certificatesApi.delete('property', id, typeId);
      setSuccess(`${typeName} deleted successfully!`);
      await fetchPropertyCertificates();
    } catch (err: unknown) {
      setError(getErrorMessage(err, `Failed to delete ${typeName}`));
    }
  };

  const handleCertificateExpiryChange = async (typeId: number, expiryDate: string) => {
    try {
      await certificatesApi.updateExpiry('property', id, typeId, expiryDate || null);
    } catch (err: unknown) {
      console.error('Failed to update expiry date:', err);
    }
  };

  // Drag-and-drop handlers for bedroom reordering
  const handleDragStart = (e: React.DragEvent, roomId: number) => {
    setDraggedBedroom(roomId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, roomId: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (draggedBedroom !== roomId) {
      setDragOverBedroom(roomId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setDragOverBedroom(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetRoomId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverBedroom(null);

    if (!draggedBedroom || draggedBedroom === targetRoomId) {
      setDraggedBedroom(null);
      return;
    }

    const draggedIndex = rooms.findIndex(r => r.id === draggedBedroom);
    const targetIndex = rooms.findIndex(r => r.id === targetRoomId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedBedroom(null);
      return;
    }

    const newRooms = [...rooms];
    const [removed] = newRooms.splice(draggedIndex, 1);
    const adjustedTargetIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
    newRooms.splice(adjustedTargetIndex, 0, removed);

    setRooms(newRooms);
    setDraggedBedroom(null);

    try {
      const bedroomIds = newRooms.map(r => r.id);
      await bedroomsApi.reorder(id, bedroomIds);
      setSuccess('Bedrooms reordered successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to reorder bedrooms'));
      fetchProperty();
    }
  };

  const handleDragEnd = () => {
    setDraggedBedroom(null);
    setDragOverBedroom(null);
  };

  const handleLinkImageToBedroom = async (imageId: number, roomId: number) => {
    setLinkingImage(true);
    setError('');
    try {
      await imagesApi.linkToBedroom(imageId, roomId);
      setSuccess('Image linked to bedroom successfully!');
      fetchProperty();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to link image'));
    } finally {
      setLinkingImage(false);
    }
  };

  const handleUnlinkImageFromBedroom = async (imageId: number, roomId: number) => {
    if (!confirm('Remove this image from the bedroom?')) return;

    setError('');
    try {
      await imagesApi.unlinkFromBedroom(imageId, roomId);
      setSuccess('Image removed from bedroom successfully!');
      fetchProperty();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to unlink image'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Property not found</h1>
          <Button onClick={onBack}>Back to Properties</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Edit Property</h2>
      </div>

      <MessageAlert type="error" message={error} className="mb-6" />
      <MessageAlert type="success" message={success} className="mb-6" />

      {/* Property Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6 mb-6">
        <h3 className="text-xl font-bold">Property Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input
              label="Address Line 1"
              name="address_line1"
              value={formData.address_line1}
              onChange={handleChange}
              required
              placeholder="e.g., 60 Burns Road"
            />
          </div>

          <div className="md:col-span-2">
            <Input
              label="Address Line 2"
              name="address_line2"
              value={formData.address_line2}
              onChange={handleChange}
              placeholder="Optional"
            />
          </div>

          <Input
            label="City"
            name="city"
            value={formData.city}
            onChange={handleChange}
            placeholder="e.g., Sheffield"
          />

          <Input
            label="Postcode"
            name="postcode"
            value={formData.postcode}
            onChange={handleChange}
            placeholder="e.g., S3 8DD"
          />

          <Input
            label="Location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            placeholder="e.g., City Centre, Broomhill"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property Type <span className="text-red-500">*</span>
            </label>
            <select
              name="property_type"
              value={formData.property_type}
              onChange={handleChange}
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
              onChange={handleChange}
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
                onChange={handleChange}
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
            onChange={handleChange}
            required
          />

          <Input
            label="Communal Areas"
            name="communal_areas"
            type="number"
            min="0"
            value={formData.communal_areas}
            onChange={handleChange}
            placeholder="e.g., 2"
          />

          <Input
            label="Available From"
            name="available_from"
            type="date"
            value={formData.available_from}
            onChange={handleChange}
          />

          <Input
            label="Broadband Speed"
            name="broadband_speed"
            value={formData.broadband_speed}
            onChange={handleChange}
            placeholder="e.g., 100Mbps"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="has_parking"
              name="has_parking"
              checked={formData.has_parking}
              onChange={handleChange}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <label htmlFor="has_parking" className="ml-2 block text-sm text-gray-700">Has Parking</label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="has_garden"
              name="has_garden"
              checked={formData.has_garden}
              onChange={handleChange}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <label htmlFor="has_garden" className="ml-2 block text-sm text-gray-700">Has Garden</label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="bills_included"
              name="bills_included"
              checked={formData.bills_included}
              onChange={handleChange}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <label htmlFor="bills_included" className="ml-2 block text-sm text-gray-700">Bills Included</label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_live"
              name="is_live"
              checked={formData.is_live}
              onChange={handleChange}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <label htmlFor="is_live" className="ml-2 block text-sm text-gray-700 font-semibold">Live</label>
          </div>
        </div>

        <div>
          <RichTextEditor
            key={`property-desc-${id}`}
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
                onChange={handleChange}
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
                onChange={handleChange}
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
                onChange={handleChange}
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
            {saving ? 'Saving...' : 'Save Property Changes'}
          </Button>
        </div>
      </form>

      {/* Property Images - only shown when feature is enabled */}
      {agency?.property_images_enabled && (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Property Images</h3>
          <label className={`cursor-pointer inline-block font-semibold rounded transition-colors duration-200 bg-primary hover:bg-primary-dark text-white py-2 px-6 ${uploadingPropertyImage ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handlePropertyImageUpload}
              disabled={uploadingPropertyImage}
              className="hidden"
            />
            {uploadingPropertyImage ? 'Uploading...' : 'Upload Images'}
          </label>
        </div>

        {property.images && property.images.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {property.images.map((image, index) => {
              const imageUrl = typeof image === 'string' ? image : image.file_path;
              const imageId = typeof image === 'string' ? index + 1 : image.id;
              const isPrimary = typeof image === 'string' ? false : Boolean(image.is_primary);

              return (
                <div key={index} className="relative group">
                  <img
                    src={getFullImageUrl(imageUrl)}
                    alt={`Property ${index + 1}`}
                    className={`w-full h-32 object-cover rounded cursor-pointer ${isPrimary ? 'ring-4 ring-primary' : ''}`}
                    onClick={() => setViewingImage(imageUrl)}
                  />
                  {isPrimary && (
                    <div className="absolute top-2 left-2 bg-primary text-white px-2 py-1 rounded text-xs font-semibold">
                      Main
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {!isPrimary && typeof image !== 'string' && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimaryImage(imageId)}
                        className="bg-blue-500 hover:bg-blue-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Set as main image"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(imageId)}
                      className="bg-red-500 hover:bg-red-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete image"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500">No images uploaded yet.</p>
        )}
      </div>
      )}

      {/* Property Certificates - Dynamic System */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-2xl font-bold mb-4 pb-2 border-b border-gray-200">Property Certificates</h3>
        <p className="text-sm text-gray-600 mb-6">
          Upload and manage property certificates. These will be visible to tenants of this property.
        </p>

        <div className="space-y-6">
          {certificateTypes.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No certificate types configured.
              <a href={`/${agencySlug}/admin?section=certificate-types`} className="text-primary hover:underline ml-1">
                Add certificate types
              </a>
            </p>
          ) : (
            certificateTypes.map((certType) => {
              const existingCert = propertyCertificates.find(c => c.certificate_type_id === certType.id);
              const isUploading = uploadingCertificates[certType.id];

              return (
                <div key={certType.id} className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-semibold">{certType.display_name}</h4>
                    {existingCert ? (
                      <div className="flex gap-2">
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}/uploads/${existingCert.file_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block font-semibold rounded transition-colors duration-200 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 text-sm"
                        >
                          View
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCertificateDelete(certType.id, certType.display_name)}
                          className="inline-block font-semibold rounded transition-colors duration-200 bg-red-500 hover:bg-red-600 text-white py-2 px-4 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <label className={`cursor-pointer inline-block font-semibold rounded transition-colors duration-200 bg-primary hover:bg-primary-dark text-white py-2 px-4 text-sm ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={handleCertificateUpload(certType.id, certType.display_name)}
                          disabled={isUploading}
                          className="hidden"
                        />
                        {isUploading ? 'Uploading...' : 'Upload'}
                      </label>
                    )}
                  </div>
                  {certType.description && (
                    <p className="text-sm text-gray-500 mb-2">{certType.description}</p>
                  )}
                  {existingCert && (
                    <div className="max-w-md">
                      <Input
                        label="Expiry Date"
                        type="date"
                        value={existingCert.expiry_date ? existingCert.expiry_date.split('T')[0] : ''}
                        onChange={(e) => {
                          const updated = propertyCertificates.map(c =>
                            c.certificate_type_id === certType.id
                              ? { ...c, expiry_date: e.target.value }
                              : c
                          );
                          setPropertyCertificates(updated);
                        }}
                        onBlur={(e) => handleCertificateExpiryChange(certType.id, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bedrooms Management */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Bedrooms</h3>
          <Button onClick={handleAddBedroom}>Add Bedroom</Button>
        </div>

        {showBedroomForm && (
          <div className="mb-6 p-4 border border-gray-200 rounded bg-gray-50">
            <h4 className="font-bold mb-4">{editingBedroomId ? 'Edit Bedroom' : 'Add New Bedroom'}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Input
                label="Bedroom Name"
                name="bedroom_name"
                value={bedroomFormData.bedroom_name}
                onChange={handleBedroomChange}
                required
                placeholder="e.g., Bedroom 1, Master Bedroom"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  name="status"
                  value={bedroomFormData.status}
                  onChange={handleBedroomChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="available">Available</option>
                  <option value="let">Let</option>
                </select>
              </div>

              <Input
                label="Price per week (optional)"
                name="price_pppw"
                type="number"
                step="0.01"
                min="0"
                value={bedroomFormData.price_pppw}
                onChange={handleBedroomChange}
                placeholder="Leave blank to use property price"
              />

              <Input
                label="Available From (optional)"
                name="available_from"
                type="date"
                value={bedroomFormData.available_from}
                onChange={handleBedroomChange}
                placeholder="Leave blank to use property date"
              />

              <div className="md:col-span-2">
                <RichTextEditor
                  key={`bedroom-desc-form-${editingBedroomId || 'new'}`}
                  label="Bedroom Description"
                  value={bedroomFormData.bedroom_description}
                  onChange={(value) => setBedroomFormData(prev => ({ ...prev, bedroom_description: value }))}
                  placeholder="Describe the bedroom..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  YouTube Video URL (optional)
                </label>
                <input
                  type="url"
                  name="youtube_url"
                  value={bedroomFormData.youtube_url}
                  onChange={handleBedroomChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Paste the YouTube video URL for this specific bedroom
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => handleSaveBedroom()}>
                Add Bedroom
              </Button>
              <Button variant="outline" onClick={() => setShowBedroomForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {rooms.length > 0 ? (
          <div className="space-y-4">
            {rooms.map((room) => {
              const isEditing = editingBedroomId === room.id;
              const isDragging = draggedBedroom === room.id;
              const isOver = dragOverBedroom === room.id;
              return (
                <div
                  key={room.id}
                  draggable={!isEditing}
                  onDragStart={(e) => handleDragStart(e, room.id)}
                  onDragOver={(e) => handleDragOver(e, room.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, room.id)}
                  onDragEnd={handleDragEnd}
                  className={`border border-gray-200 rounded p-4 transition-all ${
                    isDragging ? 'opacity-50 cursor-grabbing' : ''
                  } ${isOver ? 'border-primary border-2 bg-orange-50' : ''} ${
                    !isEditing ? 'cursor-grab' : ''
                  }`}
                >
                  {isEditing ? (
                    <div>
                      <h4 className="font-bold mb-4">Edit Bedroom</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <Input
                          label="Bedroom Name"
                          name="bedroom_name"
                          value={bedroomFormData.bedroom_name}
                          onChange={handleBedroomChange}
                          required
                          placeholder="e.g., Bedroom 1, Master Bedroom"
                        />

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Status <span className="text-red-500">*</span>
                          </label>
                          <select
                            name="status"
                            value={bedroomFormData.status}
                            onChange={handleBedroomChange}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="available">Available</option>
                            <option value="let">Let</option>
                          </select>
                        </div>

                        <Input
                          label="Price per week (optional)"
                          name="price_pppw"
                          type="number"
                          step="0.01"
                          min="0"
                          value={bedroomFormData.price_pppw}
                          onChange={handleBedroomChange}
                          placeholder="Leave blank to use property price"
                        />

                        <Input
                          label="Available From (optional)"
                          name="available_from"
                          type="date"
                          value={bedroomFormData.available_from}
                          onChange={handleBedroomChange}
                          placeholder="Leave blank to use property date"
                        />

                        <div className="md:col-span-2">
                          <RichTextEditor
                            key={`bedroom-desc-inline-${editingBedroomId || 'new'}`}
                            label="Bedroom Description"
                            value={bedroomFormData.bedroom_description}
                            onChange={(value) => setBedroomFormData(prev => ({ ...prev, bedroom_description: value }))}
                            placeholder="Describe the bedroom..."
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            YouTube Video URL (optional)
                          </label>
                          <input
                            type="url"
                            name="youtube_url"
                            value={bedroomFormData.youtube_url}
                            onChange={handleBedroomChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="https://www.youtube.com/watch?v=..."
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Paste the YouTube video URL for this specific bedroom
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={() => handleSaveBedroom(room.id)}>
                          Save Changes
                        </Button>
                        <Button variant="outline" onClick={handleCancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="flex flex-col gap-0.5 mt-1.5 cursor-grab active:cursor-grabbing">
                            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-lg">{room.bedroom_name}</h4>
                          <p className="text-sm text-gray-600">
                            Status: <span className={room.status === 'available' ? 'text-green-600' : 'text-gray-600'}>
                              {room.status === 'available' ? 'Available' : 'Let'}
                            </span>
                          </p>
                          {room.price_pppw && (
                            <p className="text-sm text-gray-600">&pound;{room.price_pppw}/week</p>
                          )}
                          {room.available_from && (
                            <p className="text-sm text-gray-600">
                              Available from: {new Date(room.available_from).toLocaleDateString('en-GB')}
                            </p>
                          )}
                          {room.bedroom_description && (
                            <div
                              className="text-sm text-gray-600 mt-1 prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(room.bedroom_description) }}
                            />
                          )}
                          {room.youtube_url && (
                            <div className="text-sm text-gray-600 mt-1">
                              <span className="font-medium">Video:</span>{' '}
                              <a
                                href={room.youtube_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                Watch on YouTube
                              </a>
                            </div>
                          )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEditBedroom(room)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDeleteBedroom(room.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>

                      {/* Bedroom Images - only shown when feature is enabled */}
                      {agency?.property_images_enabled && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-700">Bedroom Images</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setShowPropertyImagesForBedroom(
                                showPropertyImagesForBedroom === room.id ? null : room.id
                              )}
                              className="cursor-pointer inline-block font-semibold rounded transition-colors duration-200 border-2 border-gray-400 text-gray-700 hover:bg-gray-400 hover:text-white py-1 px-4 text-sm"
                            >
                              {showPropertyImagesForBedroom === room.id ? 'Hide' : 'Link'} Property Images
                            </button>
                            <label className={`cursor-pointer inline-block font-semibold rounded transition-colors duration-200 border-2 border-primary text-primary hover:bg-primary hover:text-white py-1 px-4 text-sm ${uploadingBedroomImage && selectedRoomForImage === room.id ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={(e) => {
                                  setSelectedRoomForImage(room.id);
                                  handleBedroomImageUpload(e, room.id);
                                }}
                                disabled={uploadingBedroomImage && selectedRoomForImage === room.id}
                                className="hidden"
                              />
                              {uploadingBedroomImage && selectedRoomForImage === room.id ? 'Uploading...' : 'Upload New'}
                            </label>
                          </div>
                        </div>

                        {showPropertyImagesForBedroom === room.id && property.images && property.images.length > 0 && (
                          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
                            <p className="text-xs font-medium text-blue-900 mb-2">
                              Click a property image to add it to this bedroom:
                            </p>
                            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                              {property.images.map((image: any, index: number) => {
                                const imageUrl = typeof image === 'string' ? image : image.file_path;
                                const imageId = typeof image === 'string' ? index + 1 : image.id;
                                const isLinked = Array.isArray(room.images) && room.images.some((ri: any) =>
                                  (typeof ri === 'object' && ri.image_id === imageId) || ri === imageUrl
                                );

                                return (
                                  <div
                                    key={index}
                                    className={`relative cursor-pointer border-2 rounded ${
                                      isLinked ? 'border-green-500 opacity-50' : 'border-transparent hover:border-blue-500'
                                    }`}
                                    onClick={() => {
                                      if (!isLinked && !linkingImage) {
                                        handleLinkImageToBedroom(imageId, room.id);
                                      }
                                    }}
                                  >
                                    <img
                                      src={getFullImageUrl(imageUrl)}
                                      alt={`Property ${index + 1}`}
                                      className="w-full h-16 object-cover rounded"
                                    />
                                    {isLinked && (
                                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded">
                                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {room.images && room.images.length > 0 ? (
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                            {room.images.map((img: any, index: number) => {
                              const imageUrl = typeof img === 'object' ? img.file_path : img;
                              const imageId = typeof img === 'object' ? img.image_id : index + 1;
                              const isRoomSpecific = typeof img === 'object' ? Boolean(img.is_room_specific) : false;

                              return (
                                <div key={index} className="relative group">
                                  <img
                                    src={getFullImageUrl(imageUrl)}
                                    alt={`${room.bedroom_name} ${index + 1}`}
                                    className="w-full h-20 object-cover rounded cursor-pointer"
                                    onClick={() => setViewingImage(imageUrl)}
                                  />
                                  <div className={`absolute bottom-1 left-1 px-2 py-0.5 rounded text-xs font-semibold ${
                                    isRoomSpecific
                                      ? 'bg-purple-500 text-white'
                                      : 'bg-blue-500 text-white'
                                  }`}>
                                    {isRoomSpecific ? 'Bedroom' : 'Linked'}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUnlinkImageFromBedroom(imageId, room.id);
                                    }}
                                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                    title={isRoomSpecific ? 'Delete image' : 'Unlink from bedroom'}
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">No images added to this bedroom yet</p>
                        )}
                      </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500">No bedrooms added yet.</p>
        )}
      </div>

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
              onBack();
            }}
            cancelText="Stay"
            confirmText="Discard Changes"
            confirmColor="red"
          />
        }
      >
        <p className="text-gray-600">
          You have unsaved changes to this property. Are you sure you want to leave? Your changes will be lost.
        </p>
      </Modal>

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50"
          onClick={() => setViewingImage(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={() => setViewingImage(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black/50 rounded-full p-2"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={getFullImageUrl(viewingImage)}
              alt="Full size view"
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
