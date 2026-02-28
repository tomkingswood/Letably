'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

/**
 * Agency type representing the current agency context
 */
export interface Agency {
  id: number;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  logo_url?: string;
  primary_color: string;
  secondary_color?: string;
  show_powered_by: boolean;
  subscription_tier: 'standard' | 'premium';
  is_active: boolean;
  property_images_enabled: boolean;
}

/**
 * Agency context state and methods
 */
interface AgencyContextType {
  agency: Agency | null;
  agencySlug: string | null;
  isLoading: boolean;
  error: string | null;
  setAgency: (agency: Agency | null) => void;
  setAgencySlug: (slug: string) => void;
  refreshAgency: () => Promise<void>;
}

const AgencyContext = createContext<AgencyContextType | undefined>(undefined);

/**
 * Props for the AgencyProvider component
 */
interface AgencyProviderProps {
  children: ReactNode;
  initialAgency?: Agency | null;
  initialSlug?: string;
}

/**
 * AgencyProvider component
 *
 * Provides agency context to the entire application.
 * Handles loading agency data based on the URL slug.
 */
export function AgencyProvider({
  children,
  initialAgency = null,
  initialSlug = ''
}: AgencyProviderProps) {
  const [agency, setAgency] = useState<Agency | null>(initialAgency);
  const [agencySlug, setAgencySlug] = useState<string | null>(initialSlug);
  const [isLoading, setIsLoading] = useState(!initialAgency && !!initialSlug);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch agency data from the API
   */
  const fetchAgency = async (slug: string, isRefresh = false) => {
    if (!slug) return;

    if (!isRefresh) setIsLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/agencies/${slug}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Agency not found');
          setAgency(null);
        } else {
          throw new Error('Failed to load agency');
        }
        return;
      }

      const data = await response.json();
      setAgency(data.agency);

      // Apply agency branding as CSS variables
      if (data.agency) {
        applyAgencyBranding(data.agency);
      }
    } catch (err) {
      console.error('Error fetching agency:', err);
      setError('Failed to load agency');
      setAgency(null);
    } finally {
      if (!isRefresh) setIsLoading(false);
    }
  };

  /**
   * Refresh agency data without showing loading spinner
   */
  const refreshAgency = async () => {
    if (agencySlug) {
      await fetchAgency(agencySlug, true);
    }
  };

  // Fetch agency when slug changes
  useEffect(() => {
    if (agencySlug && !agency) {
      fetchAgency(agencySlug);
    }
  }, [agencySlug]);

  // Apply branding when agency changes
  useEffect(() => {
    if (agency) {
      applyAgencyBranding(agency);
    }
  }, [agency]);

  const value: AgencyContextType = {
    agency,
    agencySlug,
    isLoading,
    error,
    setAgency,
    setAgencySlug,
    refreshAgency
  };

  return (
    <AgencyContext.Provider value={value}>
      {children}
    </AgencyContext.Provider>
  );
}

/**
 * Hook to access agency context
 */
export function useAgency() {
  const context = useContext(AgencyContext);
  if (context === undefined) {
    throw new Error('useAgency must be used within an AgencyProvider');
  }
  return context;
}

/**
 * Apply agency branding as CSS variables
 */
function applyAgencyBranding(agency: Agency) {
  const root = document.documentElement;

  // Set primary color
  if (agency.primary_color) {
    root.style.setProperty('--agency-primary', agency.primary_color);

    // Generate lighter/darker variants
    root.style.setProperty('--agency-primary-light', lightenColor(agency.primary_color, 20));
    root.style.setProperty('--agency-primary-dark', darkenColor(agency.primary_color, 20));
  }

  // Set secondary color
  if (agency.secondary_color) {
    root.style.setProperty('--agency-secondary', agency.secondary_color);
  }
}

/**
 * Lighten a hex color
 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

/**
 * Darken a hex color
 */
function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
  const B = Math.max(0, (num & 0x0000FF) - amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

export default AgencyContext;
