'use client';

import { SectionProps } from './index';
import CertificateTypesSectionBase from './CertificateTypesSectionBase';

export default function CertificateTypesSection(_props: SectionProps) {
  return (
    <CertificateTypesSectionBase
      apiType="tenancy"
      title="Tenancy Document Types"
      subtitle="Manage document types displayed on tenant tenancy pages"
      infoText="Once configured here, these document types will be available to upload when creating or managing a tenancy. Each tenancy stores its own set of documents, shared between all tenants on that tenancy."
      emptyText="No tenancy document types defined yet"
      placeholder="e.g., Tenancy Agreement, Deposit Certificate, Inventory"
      iconColorClass="bg-teal-100"
      iconTextClass="text-teal-600"
      checkboxId="ten_has_expiry"
    />
  );
}
