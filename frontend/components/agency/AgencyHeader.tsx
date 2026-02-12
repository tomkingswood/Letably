'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAgency } from '@/lib/agency-context';
import { useAuth } from '@/lib/auth-context';
import { RoleBanner, RoleIcon } from '@/components/ui/RoleBanner';

/**
 * Minimal Agency Header
 *
 * Shows role-based action banners for authenticated users.
 * No navigation links since each role has its own dashboard.
 */
export default function AgencyHeader() {
  const { agency, agencySlug } = useAgency();
  const { user, isAuthenticated, logout } = useAuth();

  const basePath = `/${agencySlug}`;

  const handleLogout = () => {
    logout();
    window.location.href = basePath;
  };

  // Primary color with fallback
  const primaryColor = agency?.primary_color || '#1E3A5F';

  return (
    <>
      {/* Sticky Action Banners for authenticated users */}
      {isAuthenticated && user && (
        <div className="sticky top-0 z-50">
          <RoleBanner
            role={user.role}
            bgStyle={user.role === 'admin' ? { backgroundColor: primaryColor } : undefined}
          >
            <div className="flex items-center justify-between py-3 text-white">
              <Link
                href={`${basePath}/${user.role === 'admin' ? 'admin' : user.role === 'landlord' ? 'landlord' : 'tenancy'}`}
                className="flex items-center gap-2 hover:opacity-90 transition-opacity"
              >
                <RoleIcon role={user.role} />
                <span className="font-semibold">
                  {agency?.name} - {user.role === 'admin' ? 'Admin Panel' : user.role === 'landlord' ? 'Landlord Portal' : 'Tenant Portal'}
                </span>
              </Link>
              <div className="flex items-center gap-4 text-sm">
                <span className="hidden sm:inline">
                  {user.first_name} {user.last_name}
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm font-medium transition-colors"
                >
                  Log Out
                </button>
              </div>
            </div>
          </RoleBanner>
        </div>
      )}
    </>
  );
}
