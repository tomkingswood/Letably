'use client';

interface PendingMember {
  id: number;
  first_name: string;
  last_name: string;
  is_signed: boolean;
  signed_at: string | null;
  guarantor_required: boolean;
  is_current_user: boolean;
}

interface GuarantorAgreement {
  tenancy_member_id: number;
  guarantor_name: string;
  is_signed: boolean;
  signed_at: string | null;
}

interface PendingTenancy {
  id: number;
  status: string;
  property_address: string;
  location: string;
  start_date: string;
  end_date: string;
  created_at: string;
  members: PendingMember[];
  guarantorAgreements: GuarantorAgreement[];
}

interface PendingTenanciesViewProps {
  tenancies: PendingTenancy[];
  currentUserId?: number;
}

export function PendingTenanciesView({ tenancies }: PendingTenanciesViewProps) {
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-primary text-white py-8">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-2">Your Upcoming Tenancies</h1>
          <p className="text-lg opacity-90">
            Your tenancy is being set up. Here&apos;s the current progress.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {tenancies.map((tenancy) => {
          const membersWithGuarantor = tenancy.members.filter((m) => m.guarantor_required);
          const totalSignatures = tenancy.members.length + membersWithGuarantor.length;
          const membersSigned = tenancy.members.filter((m) => m.is_signed).length;
          const guarantorsSigned = tenancy.guarantorAgreements.filter((g) => g.is_signed).length;
          const signedCount = membersSigned + guarantorsSigned;
          const progressPercent = totalSignatures > 0 ? (signedCount / totalSignatures) * 100 : 0;
          const isPending = tenancy.status === 'pending';
          const isApproval = tenancy.status === 'approval';

          return (
            <div key={tenancy.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Card Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {tenancy.property_address}
                    </h2>
                    {tenancy.location && (
                      <p className="text-gray-600 mt-1">{tenancy.location}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-2">
                      {formatDate(tenancy.start_date)} &mdash; {formatDate(tenancy.end_date)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      isPending
                        ? 'bg-amber-100 text-amber-800'
                        : isApproval
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {isPending ? 'Pending' : isApproval ? 'Finalising' : 'Awaiting Signatures'}
                  </span>
                </div>

                {/* Status Explanation */}
                {isPending && (
                  <div className="mt-4 p-3 rounded-lg text-sm bg-amber-50 text-amber-800 border border-amber-200">
                    <p>
                      Your letting agent is reviewing the agreements and room assignments.
                      You&apos;ll be notified when it&apos;s ready to sign.
                    </p>
                  </div>
                )}
                {isApproval && (
                  <div className="mt-4 p-3 rounded-lg text-sm bg-green-50 text-green-800 border border-green-200">
                    <p>
                      All signatures have been collected. Your letting agent is finalising
                      the tenancy. You&apos;ll be notified once everything is confirmed.
                    </p>
                  </div>
                )}
              </div>

              {/* Signing Progress */}
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Signing Progress
                </h3>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>
                      {signedCount} of {totalSignatures} signature{totalSignatures !== 1 ? 's' : ''} complete
                    </span>
                    <span>{Math.round(progressPercent)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-green-500 h-2.5 rounded-full transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Per-member rows */}
                <div className="space-y-3">
                  {tenancy.members.map((member) => {
                    const guarantorAgreement = tenancy.guarantorAgreements.find(
                      (g) => g.tenancy_member_id === member.id
                    );

                    return (
                      <div
                        key={member.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 bg-gray-50 rounded-lg"
                      >
                        {/* Member name */}
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-gray-900">
                            {member.first_name} {member.last_name}
                          </span>
                          {member.is_current_user && (
                            <span className="ml-2 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              You
                            </span>
                          )}
                        </div>

                        {/* Tenant signing status */}
                        <div className="flex items-center gap-1.5 text-sm">
                          {member.is_signed ? (
                            <>
                              <svg
                                className="w-4 h-4 text-green-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              <span className="text-green-700">
                                Signed{' '}
                                {member.signed_at &&
                                  new Date(member.signed_at).toLocaleDateString('en-GB')}
                              </span>
                            </>
                          ) : (
                            <>
                              <svg
                                className="w-4 h-4 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <span className="text-gray-500">Awaiting signature</span>
                            </>
                          )}
                        </div>

                        {/* Guarantor status */}
                        {member.guarantor_required && (
                          <div className="flex items-center gap-1.5 text-sm border-l border-gray-200 pl-4">
                            <span className="text-gray-400 text-xs">Guarantor:</span>
                            {!member.is_signed ? (
                              <span className="text-gray-400 text-xs italic">
                                Waiting for tenant to sign first
                              </span>
                            ) : guarantorAgreement?.is_signed ? (
                              <>
                                <svg
                                  className="w-4 h-4 text-green-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                                <span className="text-green-700 text-xs">Signed</span>
                              </>
                            ) : (
                              <>
                                <svg
                                  className="w-4 h-4 text-gray-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                <span className="text-gray-500 text-xs">
                                  Awaiting signature
                                </span>
                              </>
                            )}
                          </div>
                        )}

                        {!member.guarantor_required && (
                          <div className="flex items-center gap-1.5 text-sm border-l border-gray-200 pl-4">
                            <span className="text-gray-400 text-xs">
                              No guarantor required
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
