'use client';

import { useState, useEffect, useCallback } from 'react';
import { tenancies as tenanciesApi } from '@/lib/api';
import type { Tenancy } from '@/lib/types';
import type { StatusGroupFilter } from '../components/TenancyStatsCards';
import type { TypeFilter } from '../components/TenancyFilters';

export interface TenancyStats {
  total: number;
  workflow: number;
  active: number;
  expired: number;
}

interface UseTenancyFiltersReturn {
  // Data
  tenancies: Tenancy[];
  stats: TenancyStats;
  loading: boolean;

  // Filter state
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  statusGroupFilter: StatusGroupFilter;
  setStatusGroupFilter: (value: StatusGroupFilter) => void;
  typeFilter: TypeFilter;
  setTypeFilter: (value: TypeFilter) => void;

  // Helpers
  hasActiveFilters: boolean;
  clearFilters: () => void;
  refreshData: () => Promise<void>;
}

export function useTenancyFilters(): UseTenancyFiltersReturn {
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [stats, setStats] = useState<TenancyStats>({ total: 0, workflow: 0, active: 0, expired: 0 });
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusGroupFilter, setStatusGroupFilter] = useState<StatusGroupFilter>('workflow');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch tenancies with current filters
  const fetchTenancies = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (debouncedSearch) params.search = debouncedSearch;
      params.statusGroup = statusGroupFilter;
      if (typeFilter !== 'all') params.type = typeFilter;

      const res = await tenanciesApi.getAll(params);
      setTenancies(res.data.tenancies);
      setStats(res.data.stats || { total: 0, workflow: 0, active: 0, expired: 0 });
    } catch (err) {
      console.error('Error fetching tenancies:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusGroupFilter, typeFilter]);

  // Initial load and filter changes
  useEffect(() => {
    fetchTenancies();
  }, [fetchTenancies]);

  const hasActiveFilters = searchQuery !== '' || statusGroupFilter !== 'workflow' || typeFilter !== 'all';

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusGroupFilter('workflow');
    setTypeFilter('all');
  }, []);

  const refreshData = useCallback(async () => {
    setLoading(true);
    await fetchTenancies();
  }, [fetchTenancies]);

  return {
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
  };
}
