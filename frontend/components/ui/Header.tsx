'use client';

import Link from 'next/link';
import { getEffectiveAgencySlug } from '@/lib/api';
import { useAuthState } from '@/hooks/useAuth';
import { RoleBanner, RoleIcon } from '@/components/ui/RoleBanner';

export default function Header() {
  const { user } = useAuthState({ listenForChanges: true });

  const handleLogout = () => {
    // Clear agency-scoped storage
    const agencySlug = getEffectiveAgencySlug();
    const tokenKey = agencySlug ? `token_${agencySlug}` : 'token';
    const userKey = agencySlug ? `user_${agencySlug}` : 'user';
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    window.location.href = '/';
  };

  const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

  return (
    <>
      {/* Development Mode Banner */}
      {isDevMode && (
        <div className="bg-yellow-400 text-yellow-900 text-center py-2 font-bold text-sm sticky top-0 z-[60]">
          <div className="container mx-auto px-4 flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            DEVELOPMENT SITE - This is not the live website
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
          </div>
        </div>
      )}

      {/* Role-Based Action Banners */}
      {user && (
        <div className={`sticky ${isDevMode ? 'top-[36px]' : 'top-0'} z-50`}>
          <RoleBanner role={user.role}>
            <Link
              href={user.role === 'admin' ? '/admin' : user.role === 'landlord' ? '/landlord' : '/tenancy'}
              className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 py-3 text-white hover:opacity-90 transition-opacity text-center"
            >
              <div className="flex items-center gap-2">
                <RoleIcon role={user.role} />
                <span className="font-semibold">
                  <span className="hidden sm:inline">
                    {user.role === 'admin' && 'Admin Panel - Manage properties, tenancies, and users'}
                    {user.role === 'landlord' && 'Welcome to your Landlord Portal - View your properties and tenancies'}
                    {user.role === 'tenant' && 'View your tenancy portal - Payments, maintenance & more'}
                  </span>
                  <span className="sm:hidden">
                    {user.role === 'admin' && 'Admin Panel'}
                    {user.role === 'landlord' && 'Landlord Portal'}
                    {user.role === 'tenant' && 'Tenancy Portal'}
                  </span>
                </span>
              </div>
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap">
                {user.role === 'admin' ? 'Go to Admin →' : 'Go to Portal →'}
              </span>
            </Link>
          </RoleBanner>
        </div>
      )}

      <header className="bg-white shadow-md">
        {/* Top Bar */}
        <div className="bg-gray-100 border-b">
          <div className="container mx-auto px-2 sm:px-4 py-2">
            <div className="flex justify-between items-center text-xs sm:text-sm gap-2">
              <Link href="/" className="text-xl font-bold text-primary">
                Letably
              </Link>
              <div className="flex gap-2 sm:gap-4 items-center">
                {user ? (
                  <>
                    <span className="text-gray-600 whitespace-nowrap">
                      <span className="hidden sm:inline">Welcome, </span>
                      {user.first_name}
                    </span>
                    <Link
                      href="/account"
                      className="text-primary hover:text-primary-dark whitespace-nowrap"
                    >
                      <span className="hidden sm:inline">Manage Account</span>
                      <span className="sm:hidden">Account</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="text-primary hover:text-primary-dark whitespace-nowrap"
                    >
                      Log Out
                    </button>
                  </>
                ) : (
                  <Link href="/signup" className="text-primary hover:text-primary-dark whitespace-nowrap">
                    Sign Up
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
