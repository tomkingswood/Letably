interface GuarantorSectionProps {
  formData: {
    guarantor_name: string;
    guarantor_dob: string;
    guarantor_email: string;
    guarantor_phone: string;
    guarantor_address: string;
    guarantor_relationship: string;
  };
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  disabled: boolean;
}

export default function GuarantorSection({
  formData,
  onChange,
  disabled,
}: GuarantorSectionProps) {
  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        A guarantor is required for this tenancy. This should be a UK homeowner who can provide financial backing.
      </p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Guarantor Full Name *
          </label>
          <input
            type="text"
            name="guarantor_name"
            value={formData.guarantor_name}
            onChange={onChange}
            required
            disabled={disabled}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Guarantor Date of Birth *
            </label>
            <input
              type="date"
              name="guarantor_dob"
              value={formData.guarantor_dob}
              onChange={onChange}
              required
              disabled={disabled}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Relationship to You *
            </label>
            <input
              type="text"
              name="guarantor_relationship"
              value={formData.guarantor_relationship}
              onChange={onChange}
              required
              disabled={disabled}
              placeholder="e.g., Parent, Guardian, Sibling"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Guarantor Email *
            </label>
            <input
              type="email"
              name="guarantor_email"
              value={formData.guarantor_email}
              onChange={onChange}
              required
              disabled={disabled}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500">
              This email will be used to send the guarantor application form, where they can validate details, upload ID, and provide a digital signature.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Guarantor Phone *
            </label>
            <input
              type="tel"
              name="guarantor_phone"
              value={formData.guarantor_phone}
              onChange={onChange}
              required
              disabled={disabled}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Guarantor Address *
          </label>
          <textarea
            name="guarantor_address"
            value={formData.guarantor_address}
            onChange={onChange}
            required
            disabled={disabled}
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
          />
        </div>
      </div>
    </div>
  );
}
