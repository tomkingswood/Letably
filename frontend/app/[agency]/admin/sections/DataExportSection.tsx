'use client';

import { useState, useEffect, useCallback } from 'react';
import { dataExport, getAuthToken } from '@/lib/api';
import { useAgency } from '@/lib/agency-context';
import { MessageAlert } from '@/components/ui/MessageAlert';
import { SectionProps } from './index';

interface ExportJob {
  id: number;
  entity_type: string;
  export_format: 'csv' | 'xml';
  filters: Record<string, any>;
  include_related: boolean;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  file_path?: string;
  file_size?: number;
  row_count?: number;
  error_message?: string;
  retry_count: number;
  created_by_name?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface ExportStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface EntityType {
  id: string;
  name: string;
  description: string;
  filters: string[];
}

interface ExportOptions {
  entityTypes: EntityType[];
  formats: { id: string; name: string; description: string }[];
  filterValues: {
    landlords: { id: number; name: string }[];
    properties: { id: number; name: string }[];
    locations: { id: number; name: string }[];
    statuses: Record<string, string[]>;
    priorities: string[];
    categories: string[];
    tenancy_types: string[];
    application_types: string[];
    payment_types: string[];
  };
}

export default function DataExportSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const { agencySlug } = useAgency();
  const [loading, setLoading] = useState(true);
  const [exports, setExports] = useState<ExportJob[]>([]);
  const [stats, setStats] = useState<ExportStats | null>(null);
  const [options, setOptions] = useState<ExportOptions | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [error, setError] = useState<string | null>(null);

  // New export form state
  const [showNewExportForm, setShowNewExportForm] = useState(false);
  const [selectedEntityType, setSelectedEntityType] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'xml'>('csv');
  const [includeRelated, setIncludeRelated] = useState(true);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [exportsRes, statsRes, optionsRes] = await Promise.all([
        dataExport.getAll({ status: filterStatus === 'all' ? undefined : filterStatus }),
        dataExport.getStats(),
        dataExport.getOptions(),
      ]);

      setExports(exportsRes.data.exports || []);
      setStats(statsRes.data);
      setOptions(optionsRes.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load export data');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh for pending/processing jobs
  useEffect(() => {
    const hasPendingOrProcessing = exports.some(
      e => e.status === 'pending' || e.status === 'processing'
    );

    if (hasPendingOrProcessing) {
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [exports, fetchData]);

  const handleCreateExport = async () => {
    if (!selectedEntityType) return;

    setCreating(true);
    try {
      await dataExport.create({
        entity_type: selectedEntityType,
        export_format: selectedFormat,
        filters,
        include_related: includeRelated,
      });

      setShowNewExportForm(false);
      setSelectedEntityType('');
      setSelectedFormat('csv');
      setIncludeRelated(true);
      setFilters({});
      fetchData();
    } catch (err) {
      console.error('Error creating export:', err);
      setError('Failed to create export');
    } finally {
      setCreating(false);
    }
  };

  const handleRetry = async (id: number) => {
    try {
      await dataExport.retry(id);
      fetchData();
    } catch (err) {
      console.error('Error retrying export:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this export?')) return;

    try {
      await dataExport.delete(id);
      fetchData();
    } catch (err) {
      console.error('Error deleting export:', err);
    }
  };

  const handleDownload = async (id: number, entityType: string, format: string) => {
    const token = getAuthToken();
    const url = dataExport.getDownloadUrl(id);

    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (agencySlug) {
        headers['X-Agency-Slug'] = agencySlug;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${entityType}_export_${id}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Error downloading export:', err);
      setError('Failed to download export file');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getEntityTypeName = (id: string) => {
    return options?.entityTypes.find(e => e.id === id)?.name || id;
  };

  const selectedEntity = options?.entityTypes.find(e => e.id === selectedEntityType);

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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Data Export</h2>
          <p className="text-gray-600">Export your data in CSV or XML format</p>
        </div>
        <button
          onClick={() => setShowNewExportForm(true)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          New Export
        </button>
      </div>

      <MessageAlert type="error" message={error} className="mb-6" onDismiss={fetchData} />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-gray-600 text-sm">Total</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-gray-600 text-sm">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-gray-600 text-sm">Processing</p>
            <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-gray-600 text-sm">Completed</p>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-gray-600 text-sm">Failed</p>
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
          </div>
        </div>
      )}

      {/* New Export Form Modal */}
      {showNewExportForm && options && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-semibold">Create New Export</h3>
            </div>
            <div className="p-6 space-y-6">
              {/* Entity Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Type
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {options.entityTypes.map((entity) => (
                    <button
                      key={entity.id}
                      onClick={() => {
                        setSelectedEntityType(entity.id);
                        setFilters({});
                      }}
                      className={`p-4 border rounded-lg text-left transition-colors ${
                        selectedEntityType === entity.id
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium">{entity.name}</p>
                      <p className="text-sm text-gray-500">{entity.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Format Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Export Format
                </label>
                <div className="flex gap-4">
                  {options.formats.map((format) => (
                    <label key={format.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="format"
                        value={format.id}
                        checked={selectedFormat === format.id}
                        onChange={(e) => setSelectedFormat(e.target.value as 'csv' | 'xml')}
                        className="text-primary focus:ring-primary"
                      />
                      <span className="font-medium">{format.name}</span>
                      <span className="text-sm text-gray-500">({format.description})</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Include Related Data */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeRelated}
                    onChange={(e) => setIncludeRelated(e.target.checked)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span className="font-medium">Include Related Data</span>
                  <span className="text-sm text-gray-500">(e.g., landlord info for properties)</span>
                </label>
              </div>

              {/* Dynamic Filters */}
              {selectedEntity && selectedEntity.filters.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filters (Optional)
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedEntity.filters.includes('status') && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Status</label>
                        <select
                          value={filters.status || ''}
                          onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-primary focus:border-primary"
                        >
                          <option value="">All Statuses</option>
                          {options.filterValues.statuses[selectedEntityType]?.map((s) => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedEntity.filters.includes('landlord_id') && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Landlord</label>
                        <select
                          value={filters.landlord_id || ''}
                          onChange={(e) => setFilters({ ...filters, landlord_id: e.target.value || undefined })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-primary focus:border-primary"
                        >
                          <option value="">All Landlords</option>
                          {options.filterValues.landlords.map((l) => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedEntity.filters.includes('property_id') && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Property</label>
                        <select
                          value={filters.property_id || ''}
                          onChange={(e) => setFilters({ ...filters, property_id: e.target.value || undefined })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-primary focus:border-primary"
                        >
                          <option value="">All Properties</option>
                          {options.filterValues.properties.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    )}


                    {selectedEntity.filters.includes('tenancy_type') && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Tenancy Type</label>
                        <select
                          value={filters.tenancy_type || ''}
                          onChange={(e) => setFilters({ ...filters, tenancy_type: e.target.value || undefined })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-primary focus:border-primary"
                        >
                          <option value="">All Types</option>
                          {options.filterValues.tenancy_types.map((t) => (
                            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedEntity.filters.includes('application_type') && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Application Type</label>
                        <select
                          value={filters.application_type || ''}
                          onChange={(e) => setFilters({ ...filters, application_type: e.target.value || undefined })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-primary focus:border-primary"
                        >
                          <option value="">All Types</option>
                          {options.filterValues.application_types.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedEntity.filters.includes('payment_type') && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Payment Type</label>
                        <select
                          value={filters.payment_type || ''}
                          onChange={(e) => setFilters({ ...filters, payment_type: e.target.value || undefined })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-primary focus:border-primary"
                        >
                          <option value="">All Types</option>
                          {options.filterValues.payment_types.map((t) => (
                            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedEntity.filters.includes('priority') && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Priority</label>
                        <select
                          value={filters.priority || ''}
                          onChange={(e) => setFilters({ ...filters, priority: e.target.value || undefined })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-primary focus:border-primary"
                        >
                          <option value="">All Priorities</option>
                          {options.filterValues.priorities.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedEntity.filters.includes('category') && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Category</label>
                        <select
                          value={filters.category || ''}
                          onChange={(e) => setFilters({ ...filters, category: e.target.value || undefined })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-primary focus:border-primary"
                        >
                          <option value="">All Categories</option>
                          {options.filterValues.categories.map((c) => (
                            <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedEntity.filters.includes('is_live') && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Live Status</label>
                        <select
                          value={filters.is_live === undefined ? '' : String(filters.is_live)}
                          onChange={(e) => setFilters({ ...filters, is_live: e.target.value === '' ? undefined : e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-primary focus:border-primary"
                        >
                          <option value="">All</option>
                          <option value="true">Live Only</option>
                          <option value="false">Not Live</option>
                        </select>
                      </div>
                    )}

                    {selectedEntity.filters.includes('has_signed') && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Signed Status</label>
                        <select
                          value={filters.has_signed === undefined ? '' : String(filters.has_signed)}
                          onChange={(e) => setFilters({ ...filters, has_signed: e.target.value === '' ? undefined : e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-primary focus:border-primary"
                        >
                          <option value="">All</option>
                          <option value="true">Signed</option>
                          <option value="false">Not Signed</option>
                        </select>
                      </div>
                    )}

                    {(selectedEntity.filters.includes('start_date_from') || selectedEntity.filters.includes('due_date_from') || selectedEntity.filters.includes('created_from')) && (
                      <>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Date From</label>
                          <input
                            type="date"
                            value={filters.start_date_from || filters.due_date_from || filters.created_from || ''}
                            onChange={(e) => {
                              const key = selectedEntity.filters.includes('start_date_from') ? 'start_date_from' :
                                selectedEntity.filters.includes('due_date_from') ? 'due_date_from' : 'created_from';
                              setFilters({ ...filters, [key]: e.target.value || undefined });
                            }}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Date To</label>
                          <input
                            type="date"
                            value={filters.start_date_to || filters.due_date_to || filters.created_to || ''}
                            onChange={(e) => {
                              const key = selectedEntity.filters.includes('start_date_to') ? 'start_date_to' :
                                selectedEntity.filters.includes('due_date_to') ? 'due_date_to' : 'created_to';
                              setFilters({ ...filters, [key]: e.target.value || undefined });
                            }}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-primary focus:border-primary"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNewExportForm(false);
                  setSelectedEntityType('');
                  setFilters({});
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateExport}
                disabled={!selectedEntityType || creating}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Export'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'pending', label: 'Pending' },
            { id: 'processing', label: 'Processing' },
            { id: 'completed', label: 'Completed' },
            { id: 'failed', label: 'Failed' },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setFilterStatus(filter.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === filter.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Export Jobs Table */}
      <div className="bg-white rounded-lg shadow-md">
        {exports.length === 0 ? (
          <div className="p-12 text-center">
            <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <p className="text-gray-600 mb-4">No exports yet</p>
            <button
              onClick={() => setShowNewExportForm(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              Create your first export
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Data Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Format</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Progress</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Rows</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Size</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Created</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {exports.map((exp) => (
                  <tr key={exp.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="font-medium">{getEntityTypeName(exp.entity_type)}</span>
                      {exp.created_by_name && (
                        <p className="text-xs text-gray-500">by {exp.created_by_name}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="uppercase text-sm font-medium">{exp.export_format}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(exp.status)}`}>
                        {exp.status}
                      </span>
                      {exp.error_message && (
                        <p className="text-xs text-red-600 mt-1 max-w-xs truncate" title={exp.error_message}>
                          {exp.error_message}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {exp.status === 'processing' ? (
                        <div className="w-24">
                          <div className="bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 rounded-full h-2 transition-all"
                              style={{ width: `${exp.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{exp.progress}%</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {exp.row_count != null ? exp.row_count.toLocaleString() : '-'}
                    </td>
                    <td className="py-3 px-4">
                      {formatFileSize(exp.file_size)}
                    </td>
                    <td className="py-3 px-4">
                      {new Date(exp.created_at).toLocaleString('en-GB', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {exp.status === 'completed' && (
                          <button
                            onClick={() => handleDownload(exp.id, exp.entity_type, exp.export_format)}
                            className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
                          >
                            Download
                          </button>
                        )}
                        {exp.status === 'failed' && (
                          <button
                            onClick={() => handleRetry(exp.id)}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            Retry
                          </button>
                        )}
                        {exp.status !== 'processing' && (
                          <button
                            onClick={() => handleDelete(exp.id)}
                            className="px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-sm font-medium"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Text */}
      <div className="mt-4 text-sm text-gray-500">
        <p>Export files are automatically deleted after 7 days. Large exports are processed in the background.</p>
      </div>
    </div>
  );
}
