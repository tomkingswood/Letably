'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAgency } from '@/lib/agency-context';
import { useAuth, useRequireAuth } from '@/lib/auth-context';
import AgencyHeader from '@/components/agency/AgencyHeader';
import { sections, sectionGroups, getSectionsByGroup, SectionProps, NavigationParams } from './sections';

// Icons for all sections
const sectionIcons: Record<string, React.ReactNode> = {
  properties: (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
  ),
  landlords: (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
    </svg>
  ),
  applications: (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
    </svg>
  ),
  tenancies: (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
  ),
  'payment-calendar': (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
  ),
  statements: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  reports: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  maintenance: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  communications: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  reminders: (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
    </svg>
  ),
  'viewing-requests': (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
    </svg>
  ),
  settings: (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  ),
  'general-settings': (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  ),
  users: (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  ),
  'email-settings': (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  ),
  'email-queue': (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
      <path d="M8.707 7.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l2-2a1 1 0 00-1.414-1.414L11 7.586V3a1 1 0 10-2 0v4.586l-.293-.293z" />
      <path d="M3 5a2 2 0 012-2h1a1 1 0 010 2H5v7h2l1 2h4l1-2h2V5h-1a1 1 0 110-2h1a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
    </svg>
  ),
  'agreement-sections': (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
  ),
  'certificate-types': (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
};

// Inner component that uses useSearchParams
function AdminDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { agency, agencySlug } = useAgency();
  const { user } = useAuth();
  const { isAuthenticated, isLoading } = useRequireAuth('');

  const basePath = `/${agencySlug}`;
  const primaryColor = agency?.primary_color || '#1E3A5F';

  // Get current section and sub-view params from URL
  const currentSection = searchParams.get('section');
  const currentAction = searchParams.get('action') as 'new' | 'edit' | 'view' | null;
  const currentId = searchParams.get('id');

  // Navigate to a section with optional sub-view params
  const navigateToSection = useCallback((section: string | null, params?: Omit<NavigationParams, 'section'>) => {
    if (section) {
      const urlParams = new URLSearchParams();
      urlParams.set('section', section);
      if (params?.action) urlParams.set('action', params.action);
      if (params?.id) urlParams.set('id', params.id);
      router.push(`${basePath}/admin?${urlParams.toString()}`);
    } else {
      router.push(`${basePath}/admin`);
    }
  }, [router, basePath]);

  // Go back - contextual based on current state
  const handleBack = useCallback(() => {
    // Allow sections to prevent navigation (e.g. unsaved changes warning)
    const event = new CustomEvent('admin:before-navigate', { cancelable: true });
    window.dispatchEvent(event);
    if (event.defaultPrevented) return;

    if (currentAction || currentId) {
      // If in a sub-view (new/edit/view), go back to section list
      navigateToSection(currentSection);
    } else {
      // If in section list, go back to dashboard
      navigateToSection(null);
    }
  }, [currentAction, currentId, currentSection, navigateToSection]);

  // Get the back button text
  const getBackButtonText = () => {
    if (currentAction || currentId) {
      const sectionTitle = currentSection ? sections[currentSection]?.meta.title : 'Section';
      return `Back to ${sectionTitle}`;
    }
    return 'Back to Dashboard';
  };

  // Redirect if not admin
  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role !== 'admin') {
      router.push(basePath);
    }
  }, [isLoading, isAuthenticated, user, router, basePath]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Not authorized
  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  // Render section content if a section is selected
  if (currentSection && sections[currentSection]) {
    const SectionComponent = sections[currentSection].component;
    const sectionMeta = sections[currentSection].meta;

    // Determine header title based on action
    const singularize = (word: string) => {
      if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
      if (word.endsWith('s')) return word.slice(0, -1);
      return word;
    };
    const getHeaderTitle = () => {
      const plural = sectionMeta.title.replace('Manage ', '');
      if (currentAction === 'new') return `Add New ${singularize(plural)}`;
      if (currentAction === 'edit') return `Edit ${singularize(plural)}`;
      if (currentAction === 'view' && currentId) return plural;
      return sectionMeta.title;
    };

    return (
      <div className="min-h-screen bg-gray-50">
        <AgencyHeader />

        {/* Section Header */}
        <div style={{ backgroundColor: primaryColor }} className="text-white py-6">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                {getBackButtonText()}
              </button>
              <div className="border-l border-white/30 pl-4">
                <h1 className="text-2xl font-bold">{getHeaderTitle()}</h1>
                {!currentAction && !currentId && (
                  <p className="text-white/80 text-sm">{sectionMeta.description}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section Content */}
        <div className="container mx-auto px-4 py-8">
          <SectionComponent
            onNavigate={navigateToSection}
            action={currentAction}
            itemId={currentId}
            onBack={handleBack}
          />
        </div>
      </div>
    );
  }

  // Render dashboard view with grouped sections
  return (
    <div className="min-h-screen bg-gray-50">
      <AgencyHeader />

      {/* Dashboard Header */}
      <div style={{ backgroundColor: primaryColor }} className="text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
              <p className="text-xl text-white/90">
                Welcome back, {user?.first_name}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Grouped Sections */}
        {sectionGroups.map((group) => {
          const groupSections = getSectionsByGroup(group.id);
          if (groupSections.length === 0) return null;

          // Determine grid columns based on section count
          const gridCols = groupSections.length === 2
            ? 'md:grid-cols-2'
            : groupSections.length >= 3
              ? 'md:grid-cols-3'
              : 'md:grid-cols-2';

          return (
            <div key={group.id} className="mb-8">
              <h2 className="text-2xl font-bold mb-4 text-gray-900">{group.title}</h2>
              <div className={`grid grid-cols-1 ${gridCols} gap-6`}>
                {groupSections.map(({ key, meta }) => (
                  <button
                    key={key}
                    onClick={() => navigateToSection(key)}
                    className="group bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow border-2 border-transparent hover:border-primary cursor-pointer h-full text-left"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`${meta.bgColor} p-3 rounded-lg`}>
                        <div className={meta.iconColor}>
                          {sectionIcons[key] || (
                            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                      {meta.showBadge && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                          !
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors">
                      {meta.title}
                    </h3>
                    <p className="text-gray-600 text-sm">{meta.description}</p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Subscription Info */}
        {agency?.subscription_tier === 'standard' && (
          <div className="mt-8 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-md p-6 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold mb-2">Upgrade to Premium</h3>
                <p className="text-white/90">
                  Get custom domains, remove Letably branding, and access priority support.
                </p>
              </div>
              <button className="bg-white text-purple-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors whitespace-nowrap">
                Upgrade Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main component with Suspense boundary for useSearchParams
export default function AgencyAdminDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    }>
      <AdminDashboardContent />
    </Suspense>
  );
}
