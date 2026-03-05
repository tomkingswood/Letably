'use client';

import { SectionProps } from './index';
import CertificateTypesSectionBase from './CertificateTypesSectionBase';

export default function AgencyCertificateTypesSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  return (
    <CertificateTypesSectionBase
      apiType="agency"
      title="Agency Certificate Types"
      subtitle="Manage certificate types for the agency as a whole (e.g., Client Money Protection, Membership)"
      infoText="These certificate types apply to the agency itself, not to individual properties or tenancies. Use them for agency-level compliance documents like professional memberships, insurance, and regulatory certificates. Certificates with expiry dates will trigger reminders when approaching expiry."
      emptyText="No agency certificate types defined yet"
      placeholder="e.g., Client Money Protection, Professional Indemnity Insurance"
      iconColorClass="bg-blue-100"
      iconTextClass="text-blue-600"
      checkboxId="agency_has_expiry"
    />
  );
}
