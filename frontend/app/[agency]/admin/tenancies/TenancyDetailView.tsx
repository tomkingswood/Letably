'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAgency } from '@/lib/agency-context';
import Link from 'next/link';
import { tenancies as tenanciesApi, bedrooms as bedroomsApi, payments as paymentsApi, settings as settingsApi, tenantDocuments as tenantDocumentsApi } from '@/lib/api';
import { Tenancy, Bedroom, PaymentSchedule, Payment, TenancyMember, GuarantorAgreement, Agreement, getErrorMessage } from '@/lib/types';
import { TenantInfo } from '@/components/admin/tenancy-detail/TenantInfo';
import { KeyTracking } from '@/components/admin/tenancy-detail/KeyTracking';
import PaymentScheduleGrid from '@/components/shared/PaymentScheduleGrid';
import { PersonalDocuments } from '@/components/admin/tenancy-detail/PersonalDocuments';
import { TenancyOverview } from '@/components/admin/tenancy-detail/TenancyOverview';
import { SigningProgress } from '@/components/admin/tenancy-detail/SigningProgress';
import { RecordPaymentModal, CreateManualPaymentModal, EditPaymentScheduleModal, EditSinglePaymentModal } from '@/components/admin/tenancy-detail/PaymentModals';
import { SignedAgreementModal } from '@/components/admin/tenancy-detail/SignedAgreementModal';
import { PreviewAgreementModal } from '@/components/admin/tenancy-detail/PreviewAgreementModal';
import { ExpireConfirmationModal } from '@/components/admin/tenancy-detail/ExpireConfirmationModal';
import { CreateRollingTenancyModal } from '@/components/admin/tenancy-detail/CreateRollingTenancyModal';
import { MessageAlert } from '@/components/ui/MessageAlert';

interface TenancyDetailViewProps {
  id: string;
  onBack: () => void;
}

export default function TenancyDetailView({ id, onBack }: TenancyDetailViewProps) {
  const router = useRouter();
  const { agencySlug } = useAgency();
  const searchParams = useSearchParams();

  // Core state
  const [loading, setLoading] = useState(true);
  const [tenancy, setTenancy] = useState<Tenancy | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Tenant tab state
  const [selectedMemberIndex, setSelectedMemberIndex] = useState(0);

  // Tenancy editing state
  const [editingTenancy, setEditingTenancy] = useState(false);
  const [tenancyFormData, setTenancyFormData] = useState({
    start_date: '',
    end_date: '' as string | null,
    status: 'pending' as 'pending' | 'awaiting_signatures' | 'approval' | 'active' | 'expired',
    auto_generate_payments: true,
  });

  // Member editing state
  const [editingMember, setEditingMember] = useState(false);
  const [memberFormData, setMemberFormData] = useState({
    bedroom_id: null as number | null,
    rent_pppw: 0,
    deposit_amount: 0,
  });
  const [rooms, setRooms] = useState<Bedroom[]>([]);

  // Key tracking state
  const [editingKeyTracking, setEditingKeyTracking] = useState(false);
  const [updatingKeyTracking, setUpdatingKeyTracking] = useState(false);
  const [keyTrackingFormData, setKeyTrackingFormData] = useState({
    key_status: 'not_collected' as 'not_collected' | 'collected' | 'returned',
    key_collection_date: '',
    key_return_date: '',
  });

  // Payment schedules state
  const [payments, setPayments] = useState<PaymentSchedule[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Guarantor agreements state
  const [guarantorAgreements, setGuarantorAgreements] = useState<GuarantorAgreement[]>([]);
  const [loadingGuarantors, setLoadingGuarantors] = useState(false);

  // Payment recording modal state
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentSchedule | null>(null);
  const [paymentFormData, setPaymentFormData] = useState({
    amount_paid: 0,
    paid_date: new Date().toISOString().split('T')[0],
    payment_reference: '',
  });

  // Manual payment modal state
  const [showCreateManualPaymentModal, setShowCreateManualPaymentModal] = useState(false);
  const [creatingManualPayment, setCreatingManualPayment] = useState(false);
  const [manualPaymentError, setManualPaymentError] = useState('');
  const [manualPaymentFormData, setManualPaymentFormData] = useState({
    due_date: new Date().toISOString().split('T')[0],
    amount_due: 0,
    payment_type: 'rent',
    description: '',
  });

  // Payment editing modal state
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [editingPaymentAmount, setEditingPaymentAmount] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [editPaymentFormData, setEditPaymentFormData] = useState({
    amount_due: 0,
    due_date: '',
    payment_type: 'rent',
    description: '',
  });

  // Single payment editing modal state
  const [showEditSinglePaymentModal, setShowEditSinglePaymentModal] = useState(false);
  const [editingSinglePayment, setEditingSinglePayment] = useState(false);
  const [selectedSinglePayment, setSelectedSinglePayment] = useState<Payment | null>(null);
  const [singlePaymentFormData, setSinglePaymentFormData] = useState({
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_reference: '',
  });

  // Tenant documents state
  const [memberDocuments, setMemberDocuments] = useState<{[key: number]: any[]}>({});
  const [uploadingDocument, setUploadingDocument] = useState<number | null>(null);
  const [documentFormData, setDocumentFormData] = useState<{[key: number]: {type: string, file: File | null}}>({});
  const [expandedDocuments, setExpandedDocuments] = useState<Set<number>>(new Set());

  // Signed agreement modal state
  const [showSignedAgreementModal, setShowSignedAgreementModal] = useState(false);
  const [selectedAgreementHTML, setSelectedAgreementHTML] = useState<string>('');
  const [selectedMemberName, setSelectedMemberName] = useState<string>('');

  // Preview agreement modal state
  const [showPreviewAgreementModal, setShowPreviewAgreementModal] = useState(false);
  const [previewAgreement, setPreviewAgreement] = useState<Agreement | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Delete tenancy state
  const [deleting, setDeleting] = useState(false);

  // Create rolling tenancy modal state
  const [showCreateRollingModal, setShowCreateRollingModal] = useState(false);
  const [creatingRolling, setCreatingRolling] = useState(false);
  const [rollingError, setRollingError] = useState('');
  const [rollingFormData, setRollingFormData] = useState<{
    start_date: string;
    end_date: string;
    selectedMembers: { [key: number]: boolean };
    memberDetails: { [key: number]: { rent_pppw: number; deposit_amount: number; bedroom_id: number | null } };
  }>({
    start_date: '',
    end_date: '',
    selectedMembers: {},
    memberDetails: {},
  });

  // Mark as Expired modal state
  const [showExpireModal, setShowExpireModal] = useState(false);
  const [markingExpired, setMarkingExpired] = useState(false);

  // Get selected member
  const selectedMember = useMemo(() => {
    if (!tenancy?.members || tenancy.members.length === 0) return null;
    return tenancy.members[selectedMemberIndex] || null;
  }, [tenancy, selectedMemberIndex]);

  // Get payments for selected member
  const memberPayments = useMemo(() => {
    if (!selectedMember) return [];
    return payments.filter(p => p.tenancy_member_id === selectedMember.id);
  }, [payments, selectedMember]);

  // Check if tenancy can be marked as expired (on or after end date, and currently active)
  const canMarkAsExpired = useMemo(() => {
    if (!tenancy || tenancy.status !== 'active' || !tenancy.end_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(tenancy.end_date);
    endDate.setHours(0, 0, 0, 0);
    return today >= endDate;
  }, [tenancy]);

  // Get warnings for marking as expired
  const expireWarnings = useMemo(() => {
    if (!tenancy?.members) return { uncollectedKeys: [], unpaidPayments: [] };

    // Check for keys not returned
    const uncollectedKeys = tenancy.members.filter(m =>
      m.key_status !== 'returned'
    ).map(m => ({
      name: `${m.first_name} ${m.last_name}`,
      status: m.key_status || 'not_collected'
    }));

    // Check for unpaid payments
    const unpaidPayments = payments.filter(p => p.status !== 'paid').map(p => {
      const member = tenancy.members?.find(m => m.id === p.tenancy_member_id);
      return {
        memberName: member ? `${member.first_name} ${member.last_name}` : 'Unknown',
        dueDate: p.due_date,
        amount: p.amount_due - (p.amount_paid || 0)
      };
    });

    return { uncollectedKeys, unpaidPayments };
  }, [tenancy, payments]);

  // Fetch tenancy data
  const fetchTenancy = async () => {
    try {
      const response = await tenanciesApi.getById(id);
      setTenancy(response.data.tenancy);
      const autoGen = response.data.tenancy.auto_generate_payments;
      setTenancyFormData({
        start_date: response.data.tenancy.start_date,
        end_date: response.data.tenancy.end_date || '',
        status: response.data.tenancy.status,
        auto_generate_payments: autoGen !== 0 && autoGen !== false && autoGen !== null,
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to fetch tenancy'));
    } finally {
      setLoading(false);
    }
  };

  // Fetch payments
  const fetchPayments = async () => {
    setLoadingPayments(true);
    try {
      const response = await paymentsApi.getTenancyPayments(id);
      setPayments(response.data.payments || []);
    } catch (err: unknown) {
      console.error('Error fetching payments:', err);
    } finally {
      setLoadingPayments(false);
    }
  };

  // Fetch guarantor agreements
  const fetchGuarantorAgreements = async () => {
    setLoadingGuarantors(true);
    try {
      const response = await tenanciesApi.getGuarantorAgreements(id);
      setGuarantorAgreements(response.data.agreements || []);
    } catch (err: unknown) {
      console.error('Error fetching guarantor agreements:', err);
    } finally {
      setLoadingGuarantors(false);
    }
  };

  // Fetch tenant documents for a specific member
  const fetchMemberDocuments = async (memberId: number) => {
    try {
      const response = await tenantDocumentsApi.getMemberDocuments(memberId);
      setMemberDocuments(prev => ({
        ...prev,
        [memberId]: response.data.documents || []
      }));
    } catch (err: unknown) {
      console.error('Error fetching member documents:', err);
    }
  };

  useEffect(() => {
    fetchTenancy();
    fetchPayments();
  }, [id]);

  // Fetch documents when member changes
  useEffect(() => {
    if (selectedMember && !memberDocuments[selectedMember.id]) {
      fetchMemberDocuments(selectedMember.id);
    }
  }, [selectedMember]);

  // Fetch guarantor agreements when tenancy is awaiting signatures or later
  useEffect(() => {
    if (tenancy && ['awaiting_signatures', 'approval', 'active', 'expired'].includes(tenancy.status)) {
      fetchGuarantorAgreements();
    }
  }, [tenancy?.status]);

  // Handle URL params for member selection and scrolling
  useEffect(() => {
    if (!tenancy || !tenancy.members) return;

    const memberId = searchParams.get('memberId');
    const scrollTo = searchParams.get('scrollTo');

    // Set selected member if memberId is provided
    if (memberId) {
      const memberIndex = tenancy.members.findIndex(m => m.id === parseInt(memberId));
      if (memberIndex !== -1 && memberIndex !== selectedMemberIndex) {
        setSelectedMemberIndex(memberIndex);
      }
    }

    // Scroll to section after a short delay to ensure content is rendered
    if (scrollTo) {
      setTimeout(() => {
        const element = document.getElementById(scrollTo);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    }
  }, [tenancy, searchParams]);

  // Tenancy actions
  const handleEditTenancy = () => {
    if (!tenancy) return;
    setTenancyFormData({
      start_date: tenancy.start_date,
      end_date: tenancy.end_date || '',
      status: tenancy.status,
      auto_generate_payments: !!tenancy.auto_generate_payments,
    });
    setEditingTenancy(true);
  };

  const handleUpdateTenancy = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await tenanciesApi.update(id, {
        ...tenancyFormData,
        end_date: tenancyFormData.end_date || '',
      });
      setSuccess('Tenancy updated successfully');
      setEditingTenancy(false);
      fetchTenancy();
      if (tenancyFormData.status === 'active') {
        fetchPayments(); // Refresh payments if status changed to active
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update tenancy'));
    }
  };

  const handleMarkAsAwaitingSignatures = async () => {
    // Confirmation prompt
    const confirmed = confirm(
      'Please confirm:\n\n' +
      '✓ You have reviewed the generated agreements for ALL tenants in this tenancy\n' +
      '✓ All agreement details are correct\n\n' +
      '⚠️ WARNING: After marking as awaiting signatures, tenancy details CANNOT be modified.\n' +
      'The only way to make changes after this point is to delete the tenancy and start again.\n\n' +
      'Do you want to continue?'
    );

    if (!confirmed) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      await tenanciesApi.update(id, {
        start_date: tenancy!.start_date,
        end_date: tenancy!.end_date || '',
        status: 'awaiting_signatures',
      });
      setSuccess('Tenancy marked as awaiting signatures. All tenants have been emailed with a direct link to log in and sign their agreement.');
      fetchTenancy();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to mark as awaiting signatures'));
    }
  };

  const handleMarkAsActive = async () => {
    setError('');
    setSuccess('');

    // Check if all guarantor agreements are signed
    const unsignedGuarantors = guarantorAgreements.filter(g => !g.is_signed);
    if (unsignedGuarantors.length > 0) {
      setError(`Cannot mark as active: ${unsignedGuarantors.length} guarantor agreement(s) still pending signature.`);
      return;
    }

    try {
      await tenanciesApi.update(id, {
        start_date: tenancy!.start_date,
        end_date: tenancy!.end_date || '',
        status: 'active',
      });
      setSuccess('Tenancy marked as active.');
      fetchTenancy();
      fetchPayments();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to mark as active'));
    }
  };

  const handleMarkAsExpired = async () => {
    setError('');
    setSuccess('');
    setMarkingExpired(true);

    try {
      await tenanciesApi.update(id, {
        start_date: tenancy!.start_date,
        end_date: tenancy!.end_date || '',
        status: 'expired',
      });
      setSuccess('Tenancy marked as expired.');
      setShowExpireModal(false);
      fetchTenancy();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to mark as expired'));
    } finally {
      setMarkingExpired(false);
    }
  };

  const handleUpdateTenancyStatus = async (newStatus: 'approval' | 'active' | 'awaiting_signatures') => {
    setError('');
    setSuccess('');

    try {
      await tenanciesApi.update(id, {
        start_date: tenancy!.start_date,
        end_date: tenancy!.end_date || '',
        status: newStatus,
      });

      if (newStatus === 'approval') {
        setSuccess('Tenancy moved to approval. Payment schedules generated and guarantor invites sent (if applicable).');
      } else {
        setSuccess(`Tenancy status updated to ${newStatus}.`);
      }

      fetchTenancy();
      if (newStatus === 'approval') {
        fetchPayments();
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, `Failed to update status to ${newStatus}`));
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this tenancy? This will revert all applications back to approved status.')) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      await tenanciesApi.delete(id);
      onBack();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete tenancy'));
      setDeleting(false);
    }
  };

  // Member actions
  const handleEditMember = async () => {
    if (!selectedMember) return;

    setMemberFormData({
      bedroom_id: selectedMember.bedroom_id || null,
      rent_pppw: selectedMember.rent_pppw,
      deposit_amount: selectedMember.deposit_amount,
    });

    // Fetch bedrooms for the property
    try {
      const response = await bedroomsApi.getByProperty(tenancy!.property_id);
      setRooms(response.data.bedrooms || []);
    } catch (err) {
      console.error('Error fetching bedrooms:', err);
    }

    setEditingMember(true);
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    setError('');
    setSuccess('');

    try {
      await tenanciesApi.updateMember(id, selectedMember.id, memberFormData);
      setSuccess('Tenant information updated successfully');
      setEditingMember(false);
      fetchTenancy();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update tenant information'));
    }
  };

  // Key tracking actions
  const handleEditKeyTracking = (newStatus: 'not_collected' | 'collected' | 'returned') => {
    if (!selectedMember) return;

    // Clear all dates only when marking as not_collected
    const shouldClearDates = newStatus === 'not_collected';

    // When going from returned to collected, keep collection date but clear return date
    const shouldClearReturnDate = newStatus === 'collected' && selectedMember.key_status === 'returned';

    // Default return date to today when marking as returned
    const today = new Date().toISOString().split('T')[0];

    setKeyTrackingFormData({
      key_status: newStatus,
      key_collection_date: shouldClearDates ? '' : (selectedMember.key_collection_date || ''),
      key_return_date: shouldClearDates || shouldClearReturnDate ? '' : (newStatus === 'returned' && !selectedMember.key_return_date ? today : (selectedMember.key_return_date || '')),
    });
    setEditingKeyTracking(true);
  };

  const handleUpdateKeyTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    setUpdatingKeyTracking(true);
    setError('');
    setSuccess('');

    try {
      const response = await tenanciesApi.updateMemberKeyTracking(id, selectedMember.id, {
        key_status: keyTrackingFormData.key_status,
        key_collection_date: keyTrackingFormData.key_collection_date || null,
        key_return_date: keyTrackingFormData.key_return_date || null,
      });

      setSuccess('Key tracking information updated successfully');
      setEditingKeyTracking(false);
      await fetchTenancy();

      // If all members have returned keys and can create deposit returns, prompt admin
      if (response.data.allMembersReturnedKeys && response.data.canCreateDepositReturns) {
        const latestDate = new Date(response.data.latestKeyReturnDate).toLocaleDateString('en-GB');
        const shouldCreate = window.confirm(
          '✓ All tenants have now returned their keys!\n\n' +
          `Latest return date: ${latestDate}\n\n` +
          'Would you like to automatically create deposit return schedules for ALL tenants?\n\n' +
          'This will create a deposit return schedule for each tenant, due 14 days after the latest key return date.\n\n' +
          'If you click "Cancel", you will need to manually create deposit return schedules for each tenant.'
        );

        if (shouldCreate) {
          try {
            const depositResponse = await tenanciesApi.createDepositReturnSchedules(id);
            setSuccess(`Created ${depositResponse.data.schedulesCreated} deposit return schedule(s) successfully`);
            fetchPayments(); // Refresh payments to show new schedules
          } catch (depositErr: unknown) {
            setError(getErrorMessage(depositErr, 'Failed to create deposit return schedules'));
          }
        } else {
          setSuccess('Key tracking updated. Remember to manually create deposit return schedules for all tenants.');
        }
      } else if (response.data.allMembersReturnedKeys && !response.data.canCreateDepositReturns) {
        setSuccess('Key tracking updated. Deposit return schedules already exist for this tenancy.');
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update key tracking information'));
    } finally {
      setUpdatingKeyTracking(false);
    }
  };

  // Payment actions
  const openRecordPaymentModal = (payment: PaymentSchedule) => {
    setSelectedPayment(payment);
    setPaymentFormData({
      amount_paid: payment.amount_due - payment.amount_paid,
      paid_date: new Date().toISOString().split('T')[0],
      payment_reference: '',
    });
    setShowRecordPaymentModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;

    setRecordingPayment(true);
    setError('');

    try {
      await paymentsApi.recordPayment(selectedPayment.id, paymentFormData);
      setSuccess('Payment recorded successfully');
      setShowRecordPaymentModal(false);
      fetchPayments();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to record payment'));
    } finally {
      setRecordingPayment(false);
    }
  };

  const openCreateManualPaymentModal = () => {
    if (!selectedMember) return;

    setManualPaymentFormData({
      due_date: new Date().toISOString().split('T')[0],
      amount_due: 0,
      payment_type: 'rent',
      description: '',
    });
    setManualPaymentError('');
    setShowCreateManualPaymentModal(true);
  };

  const handleCreateManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    setCreatingManualPayment(true);
    setManualPaymentError('');

    try {
      await paymentsApi.createManualPayment({
        tenancy_id: parseInt(id),
        member_id: selectedMember.id,
        ...manualPaymentFormData,
      });
      setSuccess('Manual payment schedule created successfully');
      setShowCreateManualPaymentModal(false);
      fetchPayments();
    } catch (err: unknown) {
      setManualPaymentError(getErrorMessage(err, 'Failed to create payment schedule'));
    } finally {
      setCreatingManualPayment(false);
    }
  };

  const openEditPaymentModal = (payment: PaymentSchedule) => {
    setSelectedPayment(payment);
    setEditPaymentFormData({
      amount_due: payment.amount_due,
      due_date: payment.due_date,
      payment_type: payment.payment_type,
      description: payment.description || '',
    });
    setShowEditPaymentModal(true);
  };

  const handleUpdatePaymentAmount = async () => {
    if (!selectedPayment) return;

    setEditingPaymentAmount(true);
    setError('');

    try {
      await paymentsApi.updatePaymentAmount(selectedPayment.id, editPaymentFormData);
      setSuccess('Payment schedule updated successfully');
      setShowEditPaymentModal(false);
      fetchPayments();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update payment schedule'));
    } finally {
      setEditingPaymentAmount(false);
    }
  };

  const handleDeletePaymentSchedule = async () => {
    if (!selectedPayment) return;
    if (!confirm('Are you sure you want to delete this payment schedule? This action cannot be undone.')) {
      return;
    }

    setDeletingPayment(true);
    setError('');

    try {
      await paymentsApi.deletePaymentSchedule(selectedPayment.id);
      setSuccess('Payment schedule deleted successfully');
      setShowEditPaymentModal(false);
      fetchPayments();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete payment schedule'));
    } finally {
      setDeletingPayment(false);
    }
  };

  const openEditSinglePaymentModal = (payment: Payment, scheduleId: number) => {
    setSelectedSinglePayment(payment);
    setSelectedPayment(memberPayments.find(p => p.id === scheduleId) || null);
    setSinglePaymentFormData({
      amount: payment.amount,
      payment_date: payment.payment_date,
      payment_reference: payment.payment_reference || '',
    });
    setShowEditSinglePaymentModal(true);
  };

  const handleDeleteSinglePaymentDirect = async (payment: Payment, scheduleId: number) => {
    if (!confirm('Are you sure you want to delete this payment? This action cannot be undone.')) {
      return;
    }

    setError('');

    try {
      await paymentsApi.deleteSinglePayment(scheduleId, payment.id);
      setSuccess('Payment deleted successfully');
      fetchPayments();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete payment'));
    }
  };

  const handleUpdateSinglePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSinglePayment || !selectedPayment) return;

    setEditingSinglePayment(true);
    setError('');

    try {
      await paymentsApi.updateSinglePayment(
        selectedPayment.id,
        selectedSinglePayment.id,
        singlePaymentFormData
      );
      setSuccess('Payment updated successfully');
      setShowEditSinglePaymentModal(false);
      fetchPayments();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update payment'));
    } finally {
      setEditingSinglePayment(false);
    }
  };

  const handleDeleteSinglePayment = async () => {
    if (!selectedSinglePayment || !selectedPayment) return;
    if (!confirm('Are you sure you want to delete this payment? This action cannot be undone.')) {
      return;
    }

    setError('');

    try {
      await paymentsApi.deleteSinglePayment(selectedPayment.id, selectedSinglePayment.id);
      setSuccess('Payment deleted successfully');
      setShowEditSinglePaymentModal(false);
      fetchPayments();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete payment'));
    }
  };

  // Document actions
  const toggleDocumentsExpanded = (memberId: number) => {
    setExpandedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

  const handleDocumentFileChange = (memberId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setDocumentFormData(prev => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        file,
      }
    }));
  };

  const handleDocumentTypeChange = (memberId: number, type: string) => {
    setDocumentFormData(prev => ({
      ...prev,
      [memberId]: {
        type,
        file: prev[memberId]?.file || null,
      }
    }));
  };

  const handleUploadDocument = async (memberId: number) => {
    const data = documentFormData[memberId];
    if (!data?.file || !data?.type) {
      setError('Please select a document type and file');
      return;
    }

    setUploadingDocument(memberId);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('document', data.file);
    formData.append('document_type', data.type);
    formData.append('tenancy_member_id', memberId.toString());

    try {
      await tenantDocumentsApi.upload(formData);
      setSuccess('Document uploaded successfully');
      setDocumentFormData(prev => ({
        ...prev,
        [memberId]: { type: '', file: null }
      }));
      fetchMemberDocuments(memberId);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to upload document'));
    } finally {
      setUploadingDocument(null);
    }
  };

  const handleDeleteDocument = async (memberId: number, documentId: number) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    setError('');
    setSuccess('');

    try {
      await tenantDocumentsApi.delete(documentId);
      setSuccess('Document deleted successfully');
      fetchMemberDocuments(memberId);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete document'));
    }
  };

  const handleViewDocument = async (documentId: number) => {
    try {
      const response = await tenantDocumentsApi.download(documentId);
      const blobUrl = URL.createObjectURL(response.data);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to view document'));
    }
  };

  const openSignedAgreement = (member: TenancyMember) => {
    if (!member.signed_agreement_html) return;
    setSelectedAgreementHTML(member.signed_agreement_html);
    setSelectedMemberName(`${member.first_name} ${member.last_name} - Tenant`);
    setShowSignedAgreementModal(true);
  };

  const openSignedGuarantorAgreement = (agreement: GuarantorAgreement) => {
    if (!agreement.signed_agreement_html) return;
    setSelectedAgreementHTML(agreement.signed_agreement_html);
    setSelectedMemberName(`${agreement.guarantor_name} - Guarantor`);
    setShowSignedAgreementModal(true);
  };

  const openPreviewAgreement = async (member: TenancyMember) => {
    setLoadingPreview(true);
    setShowPreviewAgreementModal(true);
    setSelectedMemberName(`${member.first_name} ${member.last_name}`);

    try {
      const response = await tenanciesApi.generateAgreement(id, member.id);
      setPreviewAgreement(response.data.agreement);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load agreement preview'));
      setShowPreviewAgreementModal(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleRevertMemberSignature = async (member: TenancyMember) => {
    const memberName = `${member.first_name} ${member.last_name}`;
    if (!confirm(`Are you sure you want to revert the signature for ${memberName}?\n\nThis will:\n• Clear their signature\n• Clear their payment option\n• Require them to sign again\n\nThis action cannot be undone.`)) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      await tenanciesApi.revertMemberSignature(id, member.id);
      setSuccess(`Signature for ${memberName} has been reverted. They must sign the agreement again.`);
      fetchTenancy();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to revert signature'));
    }
  };

  const handleRegenerateGuarantorToken = async (agreementId: number, guarantorName: string) => {
    if (!confirm(`Are you sure you want to regenerate the guarantor agreement link for ${guarantorName}?\n\nThis will:\n• Generate a new link\n• Send a new email to the guarantor\n• Invalidate any previous links\n\nDo you want to continue?`)) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      await tenanciesApi.regenerateGuarantorAgreementToken(id, agreementId);
      setSuccess(`New guarantor agreement link generated and sent to ${guarantorName}.`);
      fetchGuarantorAgreements();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to regenerate guarantor agreement link'));
    }
  };

  const handleCopyGuarantorLink = (token: string, guarantorName: string) => {
    const link = `${window.location.origin}/guarantor/sign/${token}`;
    navigator.clipboard.writeText(link);
    setSuccess(`Guarantor agreement link for ${guarantorName} copied to clipboard!`);
    setTimeout(() => setSuccess(''), 3000);
  };

  // Open create rolling tenancy modal
  const openCreateRollingModal = async () => {
    if (!tenancy?.members) return;

    // Initialize form with current tenancy data
    const selectedMembers: { [key: number]: boolean } = {};
    const memberDetails: { [key: number]: { rent_pppw: number; deposit_amount: number; bedroom_id: number | null } } = {};

    tenancy.members.forEach(member => {
      selectedMembers[member.id] = true; // All selected by default
      memberDetails[member.id] = {
        rent_pppw: member.rent_pppw,
        deposit_amount: member.deposit_amount,
        bedroom_id: member.bedroom_id || null,
      };
    });

    // Fetch bedrooms for the property
    try {
      const response = await bedroomsApi.getByProperty(tenancy.property_id);
      setRooms(response.data.bedrooms || []);
    } catch (err) {
      console.error('Error fetching bedrooms:', err);
    }

    // Calculate default start date (day after current tenancy ends)
    let defaultStartDate = '';
    if (tenancy.end_date) {
      const endDate = new Date(tenancy.end_date);
      endDate.setDate(endDate.getDate() + 1);
      defaultStartDate = endDate.toISOString().split('T')[0];
    }

    setRollingFormData({
      start_date: defaultStartDate,
      end_date: '',
      selectedMembers,
      memberDetails,
    });
    setRollingError(''); // Clear any previous error
    setShowCreateRollingModal(true);
  };

  // Handle create rolling tenancy submission
  const handleCreateRollingTenancy = async (e: React.FormEvent) => {
    e.preventDefault();
    setRollingError('');
    setCreatingRolling(true);

    try {
      // Build members array from selected members
      const members = Object.entries(rollingFormData.selectedMembers)
        .filter(([_, isSelected]) => isSelected)
        .map(([memberId]) => ({
          member_id: parseInt(memberId),
          ...rollingFormData.memberDetails[parseInt(memberId)],
        }));

      if (members.length === 0) {
        setRollingError('Please select at least one tenant');
        setCreatingRolling(false);
        return;
      }

      const response = await tenanciesApi.createRollingFromExisting(id, {
        start_date: rollingFormData.start_date,
        end_date: rollingFormData.end_date || null,
        members,
      });

      setShowCreateRollingModal(false);
      setSuccess('Rolling tenancy created successfully');

      // Navigate to the new tenancy
      router.push(`/${agencySlug}/admin?section=tenancies&action=view&id=${response.data.tenancy.id}`);
    } catch (err: unknown) {
      setRollingError(getErrorMessage(err, 'Failed to create rolling tenancy'));
    } finally {
      setCreatingRolling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading tenancy details...</div>
      </div>
    );
  }

  if (!tenancy) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-red-600 mb-4">Tenancy not found</p>
          <button onClick={onBack} className="text-primary hover:underline">
            Back to Tenancies
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Action buttons */}
      <div className="flex gap-3 mb-6">
        <Link
          href={`/${agencySlug}/admin?section=maintenance&property_id=${tenancy?.property_id}`}
          className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Maintenance
        </Link>
        <Link
          href={`/${agencySlug}/admin/tenancies/${id}/communication`}
          className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Communication
        </Link>
        {tenancy && (
          <span className="text-gray-500 text-sm flex items-center ml-auto">
            {tenancy.property_address}
          </span>
        )}
      </div>

      {/* Error/Success Messages */}
      <MessageAlert type="error" message={error} className="mb-6 whitespace-pre-wrap" />
      <MessageAlert type="success" message={success} className="mb-6" />

      {/* Pending Status Action Banner */}
      {tenancy?.status === 'pending' && (
        <div className="mb-6 bg-amber-50 border border-amber-300 rounded-lg p-4">
          <div className="flex gap-3">
            <svg className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <h3 className="font-semibold text-amber-900">Action Required: Review before sending to tenants</h3>
              <p className="text-sm text-amber-800 mt-1">
                Please review the room assignments, rent amounts, and generated agreements for each tenant below.
                Once everything looks correct, click <strong>Mark as Awaiting Signatures</strong> to email all tenants a direct link to log in and sign their agreement.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tenancy Overview */}
      <TenancyOverview
        tenancy={tenancy}
        editingTenancy={editingTenancy}
        tenancyFormData={tenancyFormData}
        canMarkAsExpired={canMarkAsExpired}
        deleting={deleting}
        guarantorAgreements={guarantorAgreements}
        tenancyEditHandlers={{
          onEdit: handleEditTenancy,
          onUpdate: handleUpdateTenancy,
          onCancel: () => setEditingTenancy(false),
          onFormDataChange: setTenancyFormData,
        }}
        statusHandlers={{
          onMarkAsAwaitingSignatures: handleMarkAsAwaitingSignatures,
          onMarkAsActive: handleMarkAsActive,
          onShowExpireModal: () => setShowExpireModal(true),
          onUpdateStatus: handleUpdateTenancyStatus,
        }}
        lifecycleHandlers={{
          onDelete: handleDelete,
          onOpenCreateRollingModal: openCreateRollingModal,
        }}
      />

      {/* Signing Progress - visible during awaiting_signatures */}
      {tenancy.status === 'awaiting_signatures' && tenancy.members && tenancy.members.length > 0 && (
        <SigningProgress
          tenancy={tenancy}
          guarantorAgreements={guarantorAgreements}
          onCopyGuarantorLink={handleCopyGuarantorLink}
          onRegenerateGuarantorToken={handleRegenerateGuarantorToken}
        />
      )}

      {/* Tenant Tabs */}
      {tenancy.members && tenancy.members.length > 0 && (
        <>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Tenants</h2>
          <div className="bg-white rounded-lg shadow-md">
            {/* Tab buttons */}
            <div className="border-b border-gray-200">
              <div className="flex overflow-x-auto">
                {tenancy.members.map((member, index) => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMemberIndex(index)}
                    className={`px-6 py-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                      selectedMemberIndex === index
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    {member.first_name} {member.last_name}
                    {member.bedroom_name && ` - ${member.bedroom_name}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Tenant Content */}
            {selectedMember && (
              <div className="p-6">
                {/* Tenant Information */}
                <TenantInfo
                tenancy={tenancy}
                selectedMember={selectedMember}
                editingMember={editingMember}
                memberFormData={memberFormData}
                rooms={rooms}
                guarantorAgreement={guarantorAgreements.find(g => g.tenancy_member_id === selectedMember.id)}
                memberEditHandlers={{
                  onEdit: handleEditMember,
                  onUpdate: handleUpdateMember,
                  onCancel: () => setEditingMember(false),
                  onFormDataChange: setMemberFormData,
                }}
                agreementHandlers={{
                  onOpenSigned: openSignedAgreement,
                  onOpenPreview: openPreviewAgreement,
                  onRevertSignature: handleRevertMemberSignature,
                }}
                guarantorHandlers={{
                  onOpenSigned: openSignedGuarantorAgreement,
                  onCopyLink: handleCopyGuarantorLink,
                  onRegenerateToken: handleRegenerateGuarantorToken,
                }}
              />

              {/* Payment Schedules - Visible when tenancy is in approval or any post-active status */}
              {['approval', 'active', 'expired'].includes(tenancy.status) && (
                <div id="payments" className="pt-6 border-t border-gray-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Payment Schedules</h3>
                  {/* Auto-generate payments notice for rolling tenancies */}
                  {!!tenancy.is_rolling_monthly && !!tenancy.auto_generate_payments && (
                    <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <h4 className="font-medium text-blue-800">Automatic Payment Generation Enabled</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            This is a rolling monthly tenancy with automatic payment generation enabled.
                            New monthly rent payments will be generated automatically at <strong>1:30 AM</strong> each day
                            for the current month if one doesn&apos;t already exist.
                          </p>
                          {!tenancy.end_date && (
                            <p className="text-sm text-blue-600 mt-2">
                              To stop automatic payments, use &quot;Edit Rolling Settings&quot; above to either disable auto-generation or set a tenancy end date.
                            </p>
                          )}
                          {tenancy.end_date && (
                            <p className="text-sm text-blue-600 mt-2">
                              Payments will continue to be generated until the end date: <strong>{new Date(tenancy.end_date).toLocaleDateString('en-GB')}</strong>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <PaymentScheduleGrid
                    payments={memberPayments}
                    isAdmin={true}
                    selectedMember={selectedMember}
                    tenancyStartDate={tenancy.start_date}
                    tenancyEndDate={tenancy.end_date}
                    tenancyStatus={tenancy.status}
                    onRecordPayment={openRecordPaymentModal}
                    onEditPayment={openEditPaymentModal}
                    onEditSinglePayment={openEditSinglePaymentModal}
                    onDeleteSinglePayment={handleDeleteSinglePaymentDirect}
                    onOpenCreateManualPayment={openCreateManualPaymentModal}
                  />
                </div>
              )}

              {/* Key Tracking - Visible when tenancy is active or any post-active status */}
              {['active', 'expired'].includes(tenancy.status) && (
                <KeyTracking
                  selectedMember={selectedMember}
                  editingKeyTracking={editingKeyTracking}
                  updatingKeyTracking={updatingKeyTracking}
                  keyTrackingFormData={keyTrackingFormData}
                  onEditKeyTracking={handleEditKeyTracking}
                  onUpdateKeyTracking={handleUpdateKeyTracking}
                  onCancelEdit={() => setEditingKeyTracking(false)}
                  onFormDataChange={setKeyTrackingFormData}
                />
              )}

              {/* Personal Documents - Visible when tenancy is active or any post-active status */}
              {['active', 'expired'].includes(tenancy.status) && (
                <PersonalDocuments
                  selectedMember={selectedMember}
                  memberDocuments={memberDocuments}
                  documentFormData={documentFormData}
                  uploadingDocument={uploadingDocument}
                  onDocumentTypeChange={handleDocumentTypeChange}
                  onDocumentFileChange={handleDocumentFileChange}
                  onUploadDocument={handleUploadDocument}
                  onDeleteDocument={handleDeleteDocument}
                  onViewDocument={handleViewDocument}
                />
              )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      <RecordPaymentModal
        isOpen={showRecordPaymentModal}
        onClose={() => setShowRecordPaymentModal(false)}
        onSubmit={handleRecordPayment}
        recordingPayment={recordingPayment}
        paymentFormData={paymentFormData}
        onPaymentFormDataChange={setPaymentFormData}
      />

      <CreateManualPaymentModal
        isOpen={showCreateManualPaymentModal}
        onClose={() => setShowCreateManualPaymentModal(false)}
        onSubmit={handleCreateManualPayment}
        creatingManualPayment={creatingManualPayment}
        manualPaymentError={manualPaymentError}
        manualPaymentFormData={manualPaymentFormData}
        onManualPaymentFormDataChange={setManualPaymentFormData}
      />

      <EditPaymentScheduleModal
        isOpen={showEditPaymentModal}
        onClose={() => setShowEditPaymentModal(false)}
        onUpdatePayment={handleUpdatePaymentAmount}
        onDeleteSchedule={handleDeletePaymentSchedule}
        editingPaymentAmount={editingPaymentAmount}
        deletingPayment={deletingPayment}
        editPaymentFormData={editPaymentFormData}
        onEditPaymentFormDataChange={setEditPaymentFormData}
      />

      <EditSinglePaymentModal
        isOpen={showEditSinglePaymentModal}
        onClose={() => setShowEditSinglePaymentModal(false)}
        onSubmit={handleUpdateSinglePayment}
        onDelete={handleDeleteSinglePayment}
        editingSinglePayment={editingSinglePayment}
        singlePaymentFormData={singlePaymentFormData}
        onSinglePaymentFormDataChange={setSinglePaymentFormData}
      />

      <SignedAgreementModal
        isOpen={showSignedAgreementModal}
        onClose={() => setShowSignedAgreementModal(false)}
        selectedAgreementHTML={selectedAgreementHTML}
        selectedMemberName={selectedMemberName}
      />

      <PreviewAgreementModal
        isOpen={showPreviewAgreementModal}
        onClose={() => setShowPreviewAgreementModal(false)}
        selectedMemberName={selectedMemberName}
        loadingPreview={loadingPreview}
        previewAgreement={previewAgreement}
      />

      <ExpireConfirmationModal
        isOpen={showExpireModal}
        onClose={() => setShowExpireModal(false)}
        onConfirm={handleMarkAsExpired}
        markingExpired={markingExpired}
        expireWarnings={expireWarnings}
      />

      <CreateRollingTenancyModal
        isOpen={showCreateRollingModal}
        onClose={() => setShowCreateRollingModal(false)}
        tenancy={tenancy}
        rooms={rooms}
        rollingFormData={rollingFormData}
        setRollingFormData={setRollingFormData}
        rollingError={rollingError}
        creatingRolling={creatingRolling}
        onSubmit={handleCreateRollingTenancy}
      />
    </div>
  );
}
