'use client';

import { SectionProps } from './index';
import CertificateTypesSectionBase from './CertificateTypesSectionBase';

export default function PropertyCertificateTypesSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  return (
    <CertificateTypesSectionBase
      apiType="property"
      title="Property Certificate Types"
      subtitle="Manage certificate types for properties (e.g., Gas Safety, EPC, EICR)"
      infoText="Use this page to set up the types of certificates you can upload for properties. To upload an actual certificate, go to the property's edit page and attach one of these certificate types. Uploaded certificates will be visible to all active tenancies for that property. Certificates with expiry dates will trigger reminders when approaching expiry."
      emptyText="No property certificate types defined yet"
      placeholder="e.g., Gas Safety Certificate, EPC, EICR"
      iconColorClass="bg-green-100"
      iconTextClass="text-green-600"
      checkboxId="prop_has_expiry"
    />
  );
}
