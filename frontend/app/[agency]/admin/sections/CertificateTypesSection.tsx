'use client';

import { SectionProps } from './index';
import CertificateTypesSectionBase from './CertificateTypesSectionBase';

export default function CertificateTypesSection(_props: SectionProps) {
  return (
    <CertificateTypesSectionBase
      apiType="tenancy"
      title="Tenancy Document Types"
      subtitle="Manage document types displayed on tenant tenancy pages"
      infoText="Use this page to set up the types of documents you can upload for tenancies. To upload an actual document, go to the tenancy's detail page and attach one of these document types. Each tenancy stores its own set of documents, shared between all tenants on that tenancy. Documents with expiry dates will trigger reminders when approaching expiry."
      emptyText="No tenancy document types defined yet"
      placeholder="e.g., Tenancy Agreement, Deposit Certificate, Inventory"
      iconColorClass="bg-teal-100"
      iconTextClass="text-teal-600"
      checkboxId="ten_has_expiry"
    />
  );
}
