'use client';

import { useState } from 'react';
import { useAgency } from '@/lib/agency-context';
import { tenancies as tenanciesApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/types';
import { useTenancyFilters } from '../tenancies/hooks/useTenancyFilters';
import {
  TenancyCard,
  TenancyStatsCards,
  TenancyFilters,
  CreateTenancyView,
  CreateMigrationTenancyView,
} from '../tenancies/components';
import TenancyDetailView from '../tenancies/TenancyDetailView';
import { MessageAlert } from '@/components/ui/MessageAlert';
import { SectionProps } from './index';

export default function TenanciesSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const { agencySlug } = useAgency();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'migration'>('list');
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  const {
    tenancies,
    stats,
    loading,
    searchQuery,
    setSearchQuery,
    statusGroupFilter,
    setStatusGroupFilter,
    typeFilter,
    setTypeFilter,
    hasActiveFilters,
    clearFilters,
    refreshData,
  } = useTenancyFilters();

  const isViewMode = action === 'view' && !!itemId;

  const handleDeleteTenancy = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this tenancy? The applications will be reverted to approved status.')) {
      return;
    }

    try {
      await tenanciesApi.delete(id);
      setSuccess('Tenancy deleted successfully!');
      refreshData();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to delete tenancy'));
    }
  };

  const handleCreateSuccess = () => {
    setSuccess('Tenancy created successfully!');
    setCurrentView('list');
    refreshData();
  };

  // View mode - render tenancy detail inline
  if (isViewMode) {
    return (
      <TenancyDetailView
        id={itemId}
        onBack={() => onNavigate?.('tenancies')}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-gray-600 mt-4">Loading tenancies...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tenancies</h2>
          <p className="text-gray-600">Manage all property tenancies</p>
        </div>
        <div className="flex gap-3">
          {currentView === 'list' && (
            <div className="relative">
              <button
                onClick={() => setShowCreateMenu(!showCreateMenu)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium flex items-center gap-2"
              >
                + New Tenancy
                <svg className={`w-4 h-4 transition-transform ${showCreateMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showCreateMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowCreateMenu(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
                    <button
                      onClick={() => {
                        setCurrentView('create');
                        setShowCreateMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100"
                    >
                      <div className="font-medium text-gray-900">From Application</div>
                      <div className="text-sm text-gray-600">Create from completed applications</div>
                    </button>
                    <button
                      onClick={() => {
                        setCurrentView('migration');
                        setShowCreateMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-amber-50"
                    >
                      <div className="font-medium text-amber-700 flex items-center gap-2">
                        <span>Warning:</span> Migration Tenancy
                      </div>
                      <div className="text-sm text-gray-600">Create without application (for migration)</div>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <MessageAlert type="success" message={success} className="mb-4" onDismiss={() => setSuccess('')} />
      <MessageAlert type="error" message={error} className="mb-4" onDismiss={() => setError('')} />

      {/* Main Content */}
      {currentView === 'list' ? (
        <>
          {/* Stats Cards */}
          <TenancyStatsCards
            stats={stats}
            activeFilter={statusGroupFilter}
            onFilterChange={setStatusGroupFilter}
          />

          {/* Filters */}
          <TenancyFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
          />

          {/* Tenancies List */}
          {tenancies.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-12 text-center">
              <div className="text-gray-400 text-5xl mb-4">📋</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {hasActiveFilters ? 'No tenancies match your filters' : 'No tenancies yet'}
              </h3>
              <p className="text-gray-600 mb-4">
                {hasActiveFilters
                  ? 'Try adjusting your search or filter criteria'
                  : 'Create your first tenancy from completed applications'
                }
              </p>
              {hasActiveFilters ? (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-primary border border-primary rounded-lg hover:bg-primary/5"
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  onClick={() => setCurrentView('create')}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  Create Tenancy
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {tenancies.map((tenancy) => (
                <TenancyCard
                  key={tenancy.id}
                  tenancy={tenancy}
                  onDelete={handleDeleteTenancy}
                  onView={(id) => onNavigate?.('tenancies', { action: 'view', id: id.toString() })}
                />
              ))}
            </div>
          )}
        </>
      ) : currentView === 'create' ? (
        <CreateTenancyView
          onBack={() => setCurrentView('list')}
          onSuccess={handleCreateSuccess}
          onError={setError}
        />
      ) : (
        <CreateMigrationTenancyView
          onBack={() => setCurrentView('list')}
          onSuccess={handleCreateSuccess}
          onError={setError}
        />
      )}
    </div>
  );
}
