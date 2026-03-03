import { useRef, useCallback } from 'react';

interface AddressHistoryEntry {
  id: string;
  residential_status: string;
  residential_status_other?: string;
  period_years: number;
  period_months: number;
  address: string;
}

interface AddressHistorySectionProps {
  addressHistory: AddressHistoryEntry[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: string, value: string | number) => void;
  disabled: boolean;
}

export default function AddressHistorySection({
  addressHistory,
  onAdd,
  onRemove,
  onUpdate,
  disabled,
}: AddressHistorySectionProps) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        {!disabled && (
          <button
            type="button"
            onClick={onAdd}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            Add Address
          </button>
        )}
      </div>

      {addressHistory.length === 0 ? (
        <p className="text-gray-500 text-sm">
          If you have lived at other addresses in the past 3 years, click &quot;Add Address&quot; to add them.
        </p>
      ) : (
        <div className="space-y-6">
          {addressHistory.map((entry, index) => (
            <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-gray-900">Previous Address {index + 1}</h3>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor={`residential_status-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                      Residential Status *
                    </label>
                    <select
                      id={`residential_status-${index}`}
                      value={entry.residential_status}
                      onChange={(e) => onUpdate(index, 'residential_status', e.target.value)}
                      required
                      disabled={disabled}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                    >
                      <option value="">Select</option>
                      <option value="Private Tenant">Private Tenant</option>
                      <option value="Living with Parents">Living with Parents</option>
                      <option value="Student Accommodation">Student Accommodation</option>
                      <option value="Owner Occupier">Owner Occupier</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {entry.residential_status === 'Other' && (
                    <div>
                      <label htmlFor={`residential_status_other-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                        Please Specify *
                      </label>
                      <input
                        id={`residential_status_other-${index}`}
                        type="text"
                        value={entry.residential_status_other || ''}
                        onChange={(e) => onUpdate(index, 'residential_status_other', e.target.value)}
                        required
                        disabled={disabled}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-2">
                    Period at Address *
                  </span>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor={`period_years-${index}`} className="block text-xs font-medium text-gray-600 mb-1">Years</label>
                      <input
                        id={`period_years-${index}`}
                        type="number"
                        value={entry.period_years}
                        onChange={(e) => onUpdate(index, 'period_years', parseInt(e.target.value) || 0)}
                        min="0"
                        required
                        disabled={disabled}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label htmlFor={`period_months-${index}`} className="block text-xs font-medium text-gray-600 mb-1">Months</label>
                      <input
                        id={`period_months-${index}`}
                        type="number"
                        value={entry.period_months}
                        onChange={(e) => onUpdate(index, 'period_months', parseInt(e.target.value) || 0)}
                        min="0"
                        max="11"
                        required
                        disabled={disabled}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor={`address-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                    Full Address *
                  </label>
                  <textarea
                    id={`address-${index}`}
                    value={entry.address}
                    onChange={(e) => onUpdate(index, 'address', e.target.value)}
                    required
                    disabled={disabled}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
