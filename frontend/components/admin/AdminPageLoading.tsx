'use client';

import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface AdminPageLoadingProps {
  text?: string;
}

/**
 * Standardized loading component for admin pages
 * Use this for consistent loading states across all admin pages
 *
 * @example
 * if (loading) {
 *   return <AdminPageLoading text="Loading tenancies..." />;
 * }
 */
export default function AdminPageLoading({ text = 'Loading...' }: AdminPageLoadingProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}
