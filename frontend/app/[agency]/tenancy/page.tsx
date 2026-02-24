'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { tenancies as tenanciesApi, payments as paymentsApi, settings as settingsApi, tenantDocuments as tenantDocumentsApi, maintenance as maintenanceApi, tenancyCommunication } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAgency } from '@/lib/agency-context';
import { CommunicationMessage, mapApiMessage } from '@/lib/communication-utils';
import { PaymentSchedule, getErrorMessage } from '@/lib/types';
import { MessageAlert } from '@/components/ui/MessageAlert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PaymentScheduleGrid from '@/components/shared/PaymentScheduleGrid';

import { TenancySummary } from '@/components/tenancy/types';
import { TenancyDetailsCard } from '@/components/tenancy/TenancyDetailsCard';
import { AgreementCard } from '@/components/tenancy/AgreementCard';
import { MaintenanceCard } from '@/components/tenancy/MaintenanceCard';
import { CommunicationCard } from '@/components/tenancy/CommunicationCard';
import { DocumentsCard } from '@/components/tenancy/DocumentsCard';
import { OtherTenantsCard } from '@/components/tenancy/OtherTenantsCard';
import { AgreementModal } from '@/components/tenancy/AgreementModal';
import { PendingTenanciesView } from '@/components/tenancy/PendingTenanciesView';
import type { Tenancy, TenancyMember } from '@/components/tenancy/types';

export default function TenancyPortalPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { agencySlug } = useAgency();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tenancy, setTenancy] = useState<Tenancy | null>(null);
  const [myMember, setMyMember] = useState<TenancyMember | null>(null);
  const [members, setMembers] = useState<TenancyMember[]>([]);
  const [allTenancies, setAllTenancies] = useState<TenancySummary[]>([]);
  const [selectedTenancyId, setSelectedTenancyId] = useState<number | null>(null);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [payments, setPayments] = useState<PaymentSchedule[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [propertyCertificates, setPropertyCertificates] = useState<any[]>([]);
  const [myDocuments, setMyDocuments] = useState<any[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<any[]>([]);
  const [pendingTenancies, setPendingTenancies] = useState<any[]>([]);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [newRequestForm, setNewRequestForm] = useState({
    title: '',
    description: '',
    category: 'general',
    priority: 'medium',
  });
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Communication state
  const [communicationMessages, setCommunicationMessages] = useState<CommunicationMessage[]>([]);
  const [loadingCommunication, setLoadingCommunication] = useState(false);
  const [communicationHasMore, setCommunicationHasMore] = useState(false);
  const [communicationPage, setCommunicationPage] = useState(1);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      checkStatusAndLoad();
    }
  }, [authLoading, isAuthenticated]);

  const checkStatusAndLoad = async () => {
    try {
      // First check status to see if we need to redirect
      const statusResponse = await tenanciesApi.getMyStatus();
      const status = statusResponse.data;

      // If there's a higher priority action, redirect
      if (status.redirectTo) {
        router.push(status.redirectTo);
        return;
      }

      // No redirect needed, load tenancy data
      if (status.hasTenancies) {
        await fetchTenancy();
      } else {
        // Check for pending tenancies before showing "no tenancies"
        try {
          const pendingResponse = await tenanciesApi.getMyPendingTenancies();
          if (pendingResponse.data.pendingTenancies?.length > 0) {
            setPendingTenancies(pendingResponse.data.pendingTenancies);
          } else {
            setError('You do not have any tenancies at this time.');
          }
        } catch {
          setError('You do not have any tenancies at this time.');
        }
        setLoading(false);
      }
    } catch (err: unknown) {
      console.error('Error checking status:', err);
      // Fall back to loading tenancy data directly
      try {
        await fetchTenancy();
      } catch {
        // fetchTenancy handles its own errors, but if both fail show a meaningful message
      }
    }
  };

  const fetchTenancy = async (tenancyId?: number) => {
    try {
      const response = await tenanciesApi.getMyActiveTenancy(tenancyId);
      setAllTenancies(response.data.allTenancies || []);
      setSelectedTenancyId(response.data.selectedTenancyId);
      setTenancy(response.data.tenancy);
      setMyMember(response.data.myMember);
      setMembers(response.data.members);
      setPropertyCertificates(response.data.propertyCertificates || []);

      // Fetch payment schedules
      fetchPayments();

      // Fetch personal documents
      fetchMyDocuments();

      // Fetch maintenance requests
      fetchMaintenanceRequests();

      // Fetch communication messages
      fetchCommunication();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
      if (axiosErr.response?.status === 404) {
        setError('You do not have any tenancies at this time.');
      } else {
        setError(getErrorMessage(err, 'Failed to load tenancy information'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTenancyChange = (newTenancyId: number) => {
    if (newTenancyId !== selectedTenancyId) {
      setLoading(true);
      fetchTenancy(newTenancyId);
    }
  };

  const fetchPayments = async () => {
    setLoadingPayments(true);
    try {
      const response = await paymentsApi.getMySchedule();
      setPayments(response.data.payments || []);
    } catch (err: unknown) {
      console.error('Error fetching payment schedule:', err);
      // Don't show error to user as this is supplementary data
    } finally {
      setLoadingPayments(false);
    }
  };

  const fetchMyDocuments = async () => {
    try {
      const response = await tenantDocumentsApi.getMyDocuments();
      setMyDocuments(response.data.documents || []);
    } catch (err: unknown) {
      console.error('Error fetching personal documents:', err);
      // Don't show error to user as this is supplementary data
    }
  };

  const fetchMaintenanceRequests = async () => {
    try {
      const response = await maintenanceApi.getMyRequests();
      setMaintenanceRequests(response.data.requests || []);
    } catch (err: unknown) {
      console.error('Error fetching maintenance requests:', err);
    }
  };

  const fetchCommunication = async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (!append) setLoadingCommunication(true);
      const response = await tenancyCommunication.getMyThread({ page: pageNum, limit: 50 });
      const data = response.data;
      const mappedMessages = (data.messages || []).map(mapApiMessage);

      if (append) {
        setCommunicationMessages(prev => [...mappedMessages, ...prev]);
      } else {
        setCommunicationMessages(mappedMessages);
      }

      setCommunicationHasMore(data.pagination?.hasMore || false);
      setCommunicationPage(pageNum);
    } catch (err: unknown) {
      console.error('Error fetching communication:', err);
    } finally {
      setLoadingCommunication(false);
    }
  };

  const handleSendCommunicationMessage = async (content: string, files?: File[]): Promise<number | null> => {
    try {
      const response = await tenancyCommunication.sendMessage(content, files);
      await fetchCommunication();
      return response.data.messageId || null;
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to send message'));
      return null;
    }
  };


  const handleLoadMoreCommunication = async () => {
    await fetchCommunication(communicationPage + 1, true);
  };

  const handleSubmitMaintenanceRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenancy || !newRequestForm.title.trim() || !newRequestForm.description.trim()) return;

    try {
      setSubmittingRequest(true);
      await maintenanceApi.createRequest({
        tenancy_id: tenancy.id,
        title: newRequestForm.title.trim(),
        description: newRequestForm.description.trim(),
        category: newRequestForm.category,
        priority: newRequestForm.priority,
      });
      setShowNewRequestModal(false);
      setNewRequestForm({ title: '', description: '', category: 'general', priority: 'medium' });
      fetchMaintenanceRequests();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to submit maintenance request'));
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleDownloadDocument = async (documentId: number) => {
    try {
      const response = await tenantDocumentsApi.download(documentId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `document-${documentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to download document');
    }
  };



  const handlePrintAgreement = () => {
    if (!myMember?.signed_agreement_html) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(myMember.signed_agreement_html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (!loading && pendingTenancies.length > 0 && !tenancy) {
    return <PendingTenanciesView tenancies={pendingTenancies} currentUserId={user?.id} />;
  }

  if (error && !tenancy) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-6xl mb-4">🏠</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">No Tenancies Found</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.push(`/${agencySlug}`)}
              className="px-6 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isExpired = tenancy?.status === 'expired';

  const otherTenants = members.filter(m => m.id !== myMember?.id);

  const paymentOptionLabels: Record<string, string> = {
    'monthly': 'Monthly – due on 1st of each month',
    'monthly_to_quarterly': 'Monthly to quarterly – monthly payments (Jul/Aug/Sep) to quarterly (Oct/Jan/Apr)',
    'quarterly': 'Quarterly – July, October, January & April',
    'upfront': 'Upfront'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className={`${isExpired ? 'bg-gray-600' : 'bg-primary'} text-white py-8`}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">My Tenancy</h1>
              <p className="text-xl">{tenancy?.property_address}</p>
            </div>
            {/* Tenancy Selector - only show if multiple tenancies */}
            {allTenancies.length > 1 && (
              <div className="flex-shrink-0">
                <label className="block text-sm mb-1 opacity-80">Switch Tenancy:</label>
                <select
                  value={selectedTenancyId || ''}
                  onChange={(e) => handleTenancyChange(parseInt(e.target.value))}
                  className="px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50 min-w-[250px]"
                >
                  {allTenancies.map((t) => (
                    <option key={t.id} value={t.id} className="text-gray-900">
                      {t.property_address} ({t.status === 'active' ? 'Active' : 'Ended'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expired Tenancy Banner */}
      {isExpired && (
        <div className="bg-amber-100 border-b border-amber-200">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="font-semibold text-amber-800">This tenancy has ended</h3>
                <p className="text-sm text-amber-700 mt-1">
                  This tenancy ended on {tenancy?.end_date && new Date(tenancy.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
                  You can still view your payment history and documents below.
                  {allTenancies.some(t => t.status === 'active') && ' Use the dropdown above to switch to your active tenancy.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Error messages */}
        <MessageAlert type="error" message={error} className="mb-6" />

        <div className="space-y-6">
            <TenancyDetailsCard
              tenancy={tenancy}
              myMember={myMember}
              paymentOptionLabels={paymentOptionLabels}
            />

            <AgreementCard
              myMember={myMember}
              onViewAgreement={() => setShowAgreementModal(true)}
              onPrint={handlePrintAgreement}
            />

            {/* Payment Schedule Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3 mb-6">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-2xl font-bold text-gray-900">Payment Schedule</h2>
              </div>

              {loadingPayments ? (
                <p className="text-gray-500">Loading payment schedule...</p>
              ) : payments.length > 0 ? (
                <PaymentScheduleGrid
                  payments={payments}
                  isAdmin={false}
                  selectedMember={myMember}
                  tenancyStartDate={tenancy?.start_date}
                  tenancyEndDate={tenancy?.end_date}
                />
              ) : (
                <p className="text-gray-500">No payment schedule available.</p>
              )}
            </div>

            <MaintenanceCard
              maintenanceRequests={maintenanceRequests}
              isExpired={!!isExpired}
              showNewRequestModal={showNewRequestModal}
              setShowNewRequestModal={setShowNewRequestModal}
              newRequestForm={newRequestForm}
              setNewRequestForm={setNewRequestForm}
              submittingRequest={submittingRequest}
              onSubmitRequest={handleSubmitMaintenanceRequest}
              agencySlug={agencySlug || ''}
            />

            <CommunicationCard
              communicationMessages={communicationMessages}
              loadingCommunication={loadingCommunication}
              communicationHasMore={communicationHasMore}
              onSendMessage={handleSendCommunicationMessage}
              onLoadMore={handleLoadMoreCommunication}
            />

            <DocumentsCard
              propertyCertificates={propertyCertificates}
              myDocuments={myDocuments}
              onDownloadDocument={handleDownloadDocument}
            />

            <OtherTenantsCard otherTenants={otherTenants} />
        </div>
      </div>

      <AgreementModal
        isOpen={showAgreementModal && Boolean(myMember?.signed_agreement_html)}
        onClose={() => setShowAgreementModal(false)}
        agreementHtml={myMember?.signed_agreement_html || ''}
        onPrint={handlePrintAgreement}
      />
    </div>
  );
}
