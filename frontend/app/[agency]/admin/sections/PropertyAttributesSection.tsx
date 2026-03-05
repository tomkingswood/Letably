'use client';

import { useEffect, useState } from 'react';
import { propertyAttributes as propertyApi, bedroomAttributes as bedroomApi } from '@/lib/api';
import { PropertyAttributeDefinition, getErrorMessage } from '@/lib/types';
import { SectionProps } from './index';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { MessageAlert } from '@/components/ui/MessageAlert';
import { Modal, ModalFooter } from '@/components/ui/Modal';

const ATTRIBUTE_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'dropdown', label: 'Dropdown' },
];

type TabType = 'property' | 'room';

function AttributePanel({ api, entityLabel }: { api: typeof propertyApi; entityLabel: string }) {
  const [definitions, setDefinitions] = useState<PropertyAttributeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('text');
  const [formRequired, setFormRequired] = useState(false);
  const [formOptions, setFormOptions] = useState<string[]>(['']);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchDefinitions();
  }, []);

  const fetchDefinitions = async () => {
    try {
      const response = await api.getDefinitions();
      setDefinitions(response.data.definitions);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load attribute definitions'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormType('text');
    setFormRequired(false);
    setFormOptions(['']);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const cleanOptions = formOptions.filter(o => o.trim() !== '');

    if (formType === 'dropdown' && cleanOptions.length === 0) {
      setError('Dropdown attributes require at least one option');
      setSaving(false);
      return;
    }

    try {
      if (editingId) {
        await api.updateDefinition(editingId, {
          name: formName,
          attribute_type: formType,
          options: formType === 'dropdown' ? cleanOptions : undefined,
          is_required: formRequired,
        });
        setSuccess('Attribute updated successfully');
      } else {
        await api.createDefinition({
          name: formName,
          attribute_type: formType,
          options: formType === 'dropdown' ? cleanOptions : undefined,
          is_required: formRequired,
        });
        setSuccess('Attribute created successfully');
      }
      resetForm();
      fetchDefinitions();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save attribute'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (def: PropertyAttributeDefinition) => {
    setFormName(def.name);
    setFormType(def.attribute_type);
    setFormRequired(def.is_required);
    setFormOptions(def.options?.length ? [...def.options] : ['']);
    setEditingId(def.id);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);

    try {
      await api.deleteDefinition(deleteId);
      setSuccess('Attribute deleted successfully');
      setDeleteId(null);
      fetchDefinitions();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete attribute'));
    } finally {
      setDeleting(false);
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newOrder = [...definitions];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setDefinitions(newOrder);

    try {
      await api.reorderDefinitions(newOrder.map(d => d.id));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to reorder'));
      fetchDefinitions();
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === definitions.length - 1) return;
    const newOrder = [...definitions];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setDefinitions(newOrder);

    try {
      await api.reorderDefinitions(newOrder.map(d => d.id));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to reorder'));
      fetchDefinitions();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div />
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          Add Attribute
        </Button>
      </div>

      <MessageAlert type="error" message={error} className="mb-4" />
      <MessageAlert type="success" message={success} className="mb-4" />

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-bold mb-4">{editingId ? 'Edit Attribute' : 'New Attribute'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              placeholder={entityLabel === 'Property' ? 'e.g., Bathrooms, Property Type, Has Parking' : 'e.g., YouTube Video URL, Room Size, Furnished'}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {ATTRIBUTE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {formType === 'dropdown' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
                <div className="space-y-2">
                  {formOptions.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...formOptions];
                          newOpts[i] = e.target.value;
                          setFormOptions(newOpts);
                        }}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {formOptions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFormOptions(formOptions.filter((_, j) => j !== i))}
                          className="text-red-500 hover:text-red-700 px-2"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFormOptions([...formOptions, ''])}
                    className="text-sm text-primary hover:text-primary-dark"
                  >
                    + Add option
                  </button>
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formRequired}
                onChange={(e) => setFormRequired(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Required field</span>
            </label>

            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : (editingId ? 'Update' : 'Create')}
              </Button>
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Definitions List */}
      {definitions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
          <p className="text-lg mb-2">No custom attributes defined yet</p>
          <p className="text-sm">Click &quot;Add Attribute&quot; to create custom {entityLabel.toLowerCase()} attributes.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Order</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Required</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Options</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {definitions.map((def, index) => (
                <tr key={def.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        title="Move up"
                      >
                        &#9650;
                      </button>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index === definitions.length - 1}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        title="Move down"
                      >
                        &#9660;
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{def.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {ATTRIBUTE_TYPES.find(t => t.value === def.attribute_type)?.label || def.attribute_type}
                  </td>
                  <td className="px-4 py-3">
                    {def.is_required ? (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Required</span>
                    ) : (
                      <span className="text-xs text-gray-400">Optional</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {def.options?.join(', ') || '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(def)}
                      className="text-primary hover:text-primary-dark text-sm mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(def.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteId !== null}
        title="Delete Attribute"
        onClose={() => setDeleteId(null)}
        footer={
          <ModalFooter
            onCancel={() => setDeleteId(null)}
            onConfirm={handleDelete}
            confirmText={deleting ? 'Deleting...' : 'Delete'}
            confirmColor="red"
            isLoading={deleting}
          />
        }
      >
        <p className="text-gray-600">
          Are you sure you want to delete this attribute? All {entityLabel.toLowerCase()} values for this attribute will be permanently removed.
        </p>
      </Modal>
    </div>
  );
}

export default function PropertyAttributesSection({ onNavigate }: SectionProps) {
  const [activeTab, setActiveTab] = useState<TabType>('property');

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Custom Attributes</h2>
        <p className="text-gray-600 mt-1">
          Define custom attributes for properties and rooms
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('property')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'property'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Property Attributes
        </button>
        <button
          onClick={() => setActiveTab('room')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'room'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Room Attributes
        </button>
      </div>

      {activeTab === 'property' ? (
        <AttributePanel key="property" api={propertyApi} entityLabel="Property" />
      ) : (
        <AttributePanel key="room" api={bedroomApi} entityLabel="Room" />
      )}
    </div>
  );
}
