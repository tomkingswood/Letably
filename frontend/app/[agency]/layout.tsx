'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AgencyProvider, useAgency } from '@/lib/agency-context';
import { AuthProvider } from '@/lib/auth-context';

/**
 * Agency Layout Content
 *
 * Displays the actual content with agency branding applied.
 */
function AgencyLayoutContent({ children }: { children: React.ReactNode }) {
  const { agency, isLoading, error } = useAgency();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Show error state
  if (error || !agency) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Agency Not Found</h1>
          <p className="text-gray-600">
            The agency you&apos;re looking for doesn&apos;t exist or is no longer active.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ '--agency-primary': agency.primary_color } as React.CSSProperties}>
      {children}
    </div>
  );
}

/**
 * Agency Layout
 *
 * Wraps all agency-scoped routes with the AgencyProvider and AuthProvider.
 * Extracts the agency slug from the URL and sets up the agency context.
 */
export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const agencySlug = params.agency as string;

  return (
    <AgencyProvider initialSlug={agencySlug}>
      <AuthProvider>
        <AgencyLayoutContent>{children}</AgencyLayoutContent>
      </AuthProvider>
    </AgencyProvider>
  );
}
