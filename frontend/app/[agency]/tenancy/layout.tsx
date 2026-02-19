'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAgency } from '@/lib/agency-context';
import { useAuth } from '@/lib/auth-context';

/**
 * Tenant Portal Layout
 *
 * Wraps all tenant portal routes with authentication and role checks.
 */
export default function TenantPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { agencySlug, isLoading: agencyLoading } = useAgency();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (agencyLoading || authLoading) return;

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.push(`/${agencySlug}`);
      return;
    }

    // Redirect to home if not tenant
    if (user?.role !== 'tenant') {
      router.push(`/${agencySlug}`);
    }
  }, [agencyLoading, authLoading, isAuthenticated, user, agencySlug, router]);

  // Show loading while checking auth
  if (agencyLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Don't render if not authenticated or not tenant
  if (!isAuthenticated || user?.role !== 'tenant') {
    return null;
  }

  return <>{children}</>;
}
