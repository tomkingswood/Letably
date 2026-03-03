interface DeclarationSectionProps {
  declarationName: string;
  declarationAgreed: boolean;
  signatureError: string;
  onDeclarationNameChange: (value: string) => void;
  onDeclarationAgreedChange: (checked: boolean) => void;
  disabled: boolean;
}

export default function DeclarationSection({
  declarationName,
  declarationAgreed,
  signatureError,
  onDeclarationNameChange,
  onDeclarationAgreedChange,
  disabled,
}: DeclarationSectionProps) {
  return (
    <div>
      <div className="bg-gray-50 p-4 rounded-lg mb-4">
        <p className="text-sm text-gray-700 mb-4">
          I confirm that I am over 18 years of age and the information given above is true and accurate.
          I confirm that no one will be living in the property except anyone who is named above provided
          in the application information. I agree to allow the letting agent to make whatever enquiries
          required, including a credit check, as deemed necessary regarding this application for tenancy.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="declaration_name" className="block text-sm font-medium text-gray-700 mb-2">
            Print Name *
          </label>
          <input
            id="declaration_name"
            type="text"
            name="declaration_name"
            value={declarationName}
            onChange={(e) => onDeclarationNameChange(e.target.value)}
            required
            disabled={disabled}
            placeholder="Type your full name"
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 ${
              signatureError ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {signatureError && (
            <p className="mt-1 text-sm text-red-600">{signatureError}</p>
          )}
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="declaration_agreed"
            name="declaration_agreed"
            checked={declarationAgreed}
            onChange={(e) => onDeclarationAgreedChange(e.target.checked)}
            disabled={disabled}
            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
          />
          <label htmlFor="declaration_agreed" className="ml-2 block text-sm text-gray-900">
            I agree and confirm this is my electronic signature *
          </label>
        </div>
      </div>
    </div>
  );
}
