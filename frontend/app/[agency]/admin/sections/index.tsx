/**
 * Admin Section Registry
 *
 * Maps section names to their lazy-loaded components.
 * Each section can be loaded dynamically based on URL query params.
 */

import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

// Loading component for sections
const SectionLoading = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
  </div>
);

// Navigation params for sub-views
export interface NavigationParams {
  section?: string | null;
  action?: 'new' | 'edit' | 'view' | null;
  id?: string | null;
}

// Section component props
export interface SectionProps {
  onNavigate?: (section: string | null, params?: Omit<NavigationParams, 'section'>) => void;
  action?: 'new' | 'edit' | 'view' | null;
  itemId?: string | null;
  onBack?: () => void;
}

// Section metadata
export interface SectionMeta {
  title: string;
  description: string;
  group: string;
  iconColor: string;
  bgColor: string;
  statLabel?: string;
  showBadge?: boolean;
  hideFromDashboard?: boolean;
}

// Section groups for organization
export const sectionGroups = [
  { id: 'properties', title: 'Properties Management' },
  { id: 'lettings', title: 'Lettings Management' },
  { id: 'financial', title: 'Financial & Reports' },
  { id: 'communications', title: 'Communications & Alerts' },
  { id: 'documents', title: 'Documents & Document Types' },
  { id: 'settings', title: 'Settings' },
];

// Lazy load section components
export const sections: Record<string, {
  component: ComponentType<SectionProps>;
  meta: SectionMeta;
}> = {
  // Properties Management
  properties: {
    component: dynamic(() => import('./PropertiesSection'), { loading: SectionLoading }),
    meta: {
      title: 'Manage Properties',
      description: 'View, edit, and manage all property listings with advanced filtering',
      group: 'properties',
      iconColor: 'text-primary',
      bgColor: 'bg-primary/10',
      statLabel: 'Properties',
    },
  },
  landlords: {
    component: dynamic(() => import('./LandlordsSection'), { loading: SectionLoading }),
    meta: {
      title: 'Manage Landlords',
      description: 'Manage landlord contacts and link properties to landlords',
      group: 'properties',
      iconColor: 'text-teal-600',
      bgColor: 'bg-teal-100',
    },
  },

  // Lettings Management
  applications: {
    component: dynamic(() => import('./ApplicationsSection'), { loading: SectionLoading }),
    meta: {
      title: 'Applications',
      description: 'Manage tenant applications for properties - create and review applications',
      group: 'lettings',
      iconColor: 'text-green-600',
      bgColor: 'bg-green-100',
      statLabel: 'Applications',
    },
  },
  tenancies: {
    component: dynamic(() => import('./TenanciesSection'), { loading: SectionLoading }),
    meta: {
      title: 'Tenancies',
      description: 'Create and manage tenancies from completed applications',
      group: 'lettings',
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-100',
      statLabel: 'Active Tenancies',
    },
  },
  'payment-calendar': {
    component: dynamic(() => import('./PaymentsSection'), { loading: SectionLoading }),
    meta: {
      title: 'Payment Calendar',
      description: 'View and manage all payment schedules in a calendar view',
      group: 'lettings',
      iconColor: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
    },
  },

  // Financial & Reports
  statements: {
    component: dynamic(() => import('./StatementsSection'), { loading: SectionLoading }),
    meta: {
      title: 'Financial Statements',
      description: 'View monthly and annual payment statements for all landlords',
      group: 'financial',
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
    },
  },
  reports: {
    component: dynamic(() => import('./ReportsSection'), { loading: SectionLoading }),
    meta: {
      title: 'Reports Dashboard',
      description: 'Portfolio overview, arrears tracking, and upcoming tenancy endings',
      group: 'financial',
      iconColor: 'text-cyan-600',
      bgColor: 'bg-cyan-100',
    },
  },
  'data-export': {
    component: dynamic(() => import('./DataExportSection'), { loading: SectionLoading }),
    meta: {
      title: 'Data Export',
      description: 'Export properties, tenancies, and other data in CSV or XML format',
      group: 'financial',
      iconColor: 'text-violet-600',
      bgColor: 'bg-violet-100',
    },
  },

  // Communications & Alerts
  maintenance: {
    component: dynamic(() => import('./MaintenanceSection'), { loading: SectionLoading }),
    meta: {
      title: 'Maintenance Requests',
      description: 'View and manage tenant maintenance requests and issues',
      group: 'communications',
      iconColor: 'text-orange-600',
      bgColor: 'bg-orange-100',
      statLabel: 'Maintenance',
    },
  },
  communications: {
    component: dynamic(() => import('./CommunicationsSection'), { loading: SectionLoading }),
    meta: {
      title: 'Tenancy Communications',
      description: 'View and respond to tenant and landlord messages',
      group: 'communications',
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
  },
  reminders: {
    component: dynamic(() => import('./RemindersSection'), { loading: SectionLoading }),
    meta: {
      title: 'Reminders & Alerts',
      description: 'Certificate expiry reminders and custom alerts for property management',
      group: 'communications',
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-100',
      showBadge: true,
    },
  },
  'viewing-requests': {
    component: dynamic(() => import('./ViewingRequestsSection'), { loading: SectionLoading }),
    meta: {
      title: 'Viewing Requests',
      description: 'Review and respond to property viewing requests from potential tenants',
      group: 'communications',
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-100',
      showBadge: true,
    },
  },

  // Settings
  settings: {
    component: dynamic(() => import('./GeneralSettingsSection'), { loading: SectionLoading }),
    meta: {
      title: 'Settings',
      description: 'Company information, branding, and agency configuration',
      group: 'settings',
      iconColor: 'text-gray-600',
      bgColor: 'bg-gray-100',
    },
  },
  users: {
    component: dynamic(() => import('./UsersSection'), { loading: SectionLoading }),
    meta: {
      title: 'User Management',
      description: 'Manage user accounts and administrator permissions',
      group: 'settings',
      iconColor: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
    },
  },
  'email-settings': {
    component: dynamic(() => import('./EmailSettingsSection'), { loading: SectionLoading }),
    meta: {
      title: 'Email Settings',
      description: 'Configure SMTP settings and email system preferences',
      group: 'settings',
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  },
  'email-queue': {
    component: dynamic(() => import('./EmailQueueSection'), { loading: SectionLoading }),
    meta: {
      title: 'Email Queue',
      description: 'Monitor and manage the email sending queue and delivery status',
      group: 'settings',
      iconColor: 'text-green-600',
      bgColor: 'bg-green-100',
    },
  },
  'agreement-sections': {
    component: dynamic(() => import('./AgreementSectionsSection'), { loading: SectionLoading }),
    meta: {
      title: 'Default Agreement Sections',
      description: 'Default clauses included in all agreements unless a landlord has a custom override',
      group: 'settings',
      iconColor: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
    },
  },
  'property-certificate-types': {
    component: dynamic(() => import('./PropertyCertificateTypesSection'), { loading: SectionLoading }),
    meta: {
      title: 'Property Certificate Types',
      description: 'Manage certificate types for properties (Gas Safety, EPC, EICR)',
      group: 'documents',
      iconColor: 'text-green-600',
      bgColor: 'bg-green-100',
    },
  },
  'certificate-types': {
    component: dynamic(() => import('./CertificateTypesSection'), { loading: SectionLoading }),
    meta: {
      title: 'Tenancy Document Types',
      description: 'Manage document types displayed on tenant tenancy pages',
      group: 'documents',
      iconColor: 'text-teal-600',
      bgColor: 'bg-teal-100',
    },
  },
};

// Get sections by group (excludes hidden sections from dashboard)
export const getSectionsByGroup = (groupId: string) => {
  return Object.entries(sections)
    .filter(([_, { meta }]) => meta.group === groupId && !meta.hideFromDashboard)
    .map(([key, value]) => ({ key, ...value }));
};

// Get section keys for stats (first 4)
export const statSections = ['properties', 'tenancies', 'applications', 'maintenance'];

// Get all section keys for quick actions
export const quickActionSections = Object.keys(sections);
