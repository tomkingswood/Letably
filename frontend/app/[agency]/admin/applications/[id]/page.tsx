'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useAgency } from '@/lib/agency-context';
import ApplicationDetailView from '../ApplicationDetailView';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function AdminViewApplicationPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { agencySlug } = useAgency();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Application</h1>
            </div>
            <button
              onClick={() => router.push(`/${agencySlug}/admin?section=applications`)}
              className="bg-white text-primary hover:bg-gray-100 px-6 py-2 rounded-lg font-semibold transition-colors"
            >
              Back to Applications
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <ApplicationDetailView
          id={id}
          onBack={() => router.push(`/${agencySlug}/admin?section=applications`)}
        />
      </div>
    </div>
  );
}
