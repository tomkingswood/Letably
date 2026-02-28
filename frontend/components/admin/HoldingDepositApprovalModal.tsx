'use client';

import { useState, useEffect } from 'react';
import { holdingDeposits, properties, bedrooms as bedroomsApi, agencies } from '@/lib/api';
import { getErrorMessage } from '@/lib/types';
import type { HoldingDepositFormData } from '@/lib/types';

interface ExistingDeposit {
  id: number;
  amount: number;
  status: string;
  bedroom_name?: string;
  property_address?: string;
  reservation_days?: number;
}

interface HoldingDepositApprovalModalProps {
  applicationId: number;
  existingDeposit?: ExistingDeposit | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface PropertyOption {
  id: number;
  address_line1: string;
  city?: string;
}

interface BedroomOption {
  id: number;
  bedroom_name: string;
  price_pppw?: number;
}

export default function HoldingDepositApprovalModal({
  applicationId,
  existingDeposit,
  onClose,
  onSuccess,
}: HoldingDepositApprovalModalProps) {
  const hasExisting = existingDeposit && existingDeposit.status === 'awaiting_payment';
  const [amount, setAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split('T')[0]);
  const [propertyId, setPropertyId] = useState<number | ''>('');
  const [bedroomId, setBedroomId] = useState<number | ''>('');
  const [reservationDays, setReservationDays] = useState('');
  const [showReservation, setShowReservation] = useState(false);

  const [propertyOptions, setPropertyOptions] = useState<PropertyOption[]>([]);
  const [bedroomOptions, setBedroomOptions] = useState<BedroomOption[]>([]);
  const [depositType, setDepositType] = useState<string>('1_week_pppw');
  const [fixedAmount, setFixedAmount] = useState<number>(100);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Load agency settings and properties on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [settingsRes, propertiesRes] = await Promise.all([
          agencies.getSettings(),
          properties.getAll(),
        ]);

        const settings = settingsRes.data.settings || settingsRes.data;
        const type = settings.holding_deposit_type || '1_week_pppw';
        const parsedAmt = parseFloat(settings.holding_deposit_amount);
        const amt = Number.isNaN(parsedAmt) ? 100 : parsedAmt;
        setDepositType(type);
        setFixedAmount(amt);

        if (type === 'fixed_amount') {
          setAmount(amt.toString());
        }

        setPropertyOptions(propertiesRes.data.properties || []);
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Failed to load settings'));
      }
    };
    loadData();
  }, []);

  // Load bedrooms when property changes
  useEffect(() => {
    if (!propertyId) {
      setBedroomOptions([]);
      setBedroomId('');
      return;
    }

    const loadBedrooms = async () => {
      try {
        const res = await bedroomsApi.getByProperty(propertyId);
        const rooms = res.data.bedrooms || [];
        setBedroomOptions(rooms);
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Failed to load bedrooms'));
      }
    };
    loadBedrooms();
  }, [propertyId]);

  // Auto-fill amount when bedroom changes and type is 1_week_pppw
  useEffect(() => {
    if (depositType === '1_week_pppw' && bedroomId) {
      const selectedBedroom = bedroomOptions.find(b => b.id === bedroomId);
      if (selectedBedroom?.price_pppw) {
        setAmount(parseFloat(String(selectedBedroom.price_pppw)).toString());
      }
    }
  }, [bedroomId, depositType, bedroomOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!dateReceived) {
      setError('Please enter the date received');
      return;
    }

    // For new deposits, validate amount
    if (!hasExisting && (!amount || parseFloat(amount) <= 0)) {
      setError('Please enter a valid amount');
      return;
    }

    setSubmitting(true);

    try {
      if (hasExisting) {
        // Record payment for existing awaiting_payment deposit
        await holdingDeposits.recordPayment(existingDeposit!.id, {
          payment_reference: paymentReference || undefined,
          date_received: dateReceived,
        });
      } else {
        // Create new deposit (original flow)
        const data: HoldingDepositFormData = {
          application_id: applicationId,
          amount: parseFloat(amount),
          date_received: dateReceived,
        };

        if (paymentReference) data.payment_reference = paymentReference;
        if (bedroomId) data.bedroom_id = bedroomId as number;
        if (propertyId) data.property_id = propertyId as number;
        if (showReservation && reservationDays && parseInt(reservationDays) > 0) {
          data.reservation_days = parseInt(reservationDays);
        }

        await holdingDeposits.create(data);
      }
      onSuccess();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to record holding deposit'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {hasExisting ? 'Record Deposit Payment' : 'Record Holding Deposit'}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            {hasExisting
              ? 'Record the payment received for this holding deposit. You can then approve the application separately.'
              : 'Record the holding deposit payment to approve this application. The application will be approved automatically.'}
          </p>

          {/* Existing deposit info */}
          {hasExisting && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="text-sm space-y-1">
                <p><strong>Amount:</strong> &pound;{Number(existingDeposit!.amount).toFixed(2)}</p>
                {existingDeposit!.property_address && (
                  <p><strong>Property:</strong> {existingDeposit!.property_address}</p>
                )}
                {existingDeposit!.bedroom_name && (
                  <p><strong>Room:</strong> {existingDeposit!.bedroom_name}</p>
                )}
                {existingDeposit!.reservation_days && (
                  <p><strong>Reservation:</strong> {existingDeposit!.reservation_days} days</p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount - hidden when existing deposit */}
            {!hasExisting && (
              <div>
                <label htmlFor="hd-amount" className="block text-sm font-medium text-gray-700 mb-1">
                  Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative w-48">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">&pound;</span>
                  <input
                    type="number"
                    id="hd-amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0.01"
                    step="0.01"
                    required
                    className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                {depositType === '1_week_pppw' && (
                  <p className="mt-1 text-xs text-gray-500">
                    Auto-calculated from bedroom PPPW (1 week). You can adjust if needed.
                  </p>
                )}
              </div>
            )}

            {/* Payment Reference */}
            <div>
              <label htmlFor="hd-reference" className="block text-sm font-medium text-gray-700 mb-1">
                Payment Reference
              </label>
              <input
                type="text"
                id="hd-reference"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. bank transfer ref"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Date Received */}
            <div>
              <label htmlFor="hd-date" className="block text-sm font-medium text-gray-700 mb-1">
                Date Received <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="hd-date"
                value={dateReceived}
                onChange={(e) => setDateReceived(e.target.value)}
                required
                className="w-48 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Room Reservation toggle - hidden when existing deposit */}
            {!hasExisting && <div className="border-t pt-4">
              <button
                type="button"
                onClick={() => setShowReservation(!showReservation)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showReservation ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Room Reservation (optional)
              </button>

              {showReservation && (
                <div className="mt-3 space-y-3 ml-6">
                  {/* Property */}
                  <div>
                    <label htmlFor="hd-property" className="block text-sm font-medium text-gray-700 mb-1">
                      Property
                    </label>
                    <select
                      id="hd-property"
                      value={propertyId}
                      onChange={(e) => {
                        setPropertyId(e.target.value ? parseInt(e.target.value) : '');
                        setBedroomId('');
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Select property...</option>
                      {propertyOptions.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.address_line1}{p.city ? `, ${p.city}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bedroom */}
                  {propertyId && (
                    <div>
                      <label htmlFor="hd-bedroom" className="block text-sm font-medium text-gray-700 mb-1">
                        Bedroom
                      </label>
                      <select
                        id="hd-bedroom"
                        value={bedroomId}
                        onChange={(e) => setBedroomId(e.target.value ? parseInt(e.target.value) : '')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="">Select bedroom...</option>
                        {bedroomOptions.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.bedroom_name}{b.price_pppw ? ` - £${b.price_pppw}/pw` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Reservation Duration */}
                  <div>
                    <label htmlFor="hd-days" className="block text-sm font-medium text-gray-700 mb-1">
                      Reservation Duration (days)
                    </label>
                    <input
                      type="number"
                      id="hd-days"
                      value={reservationDays}
                      onChange={(e) => setReservationDays(e.target.value)}
                      min="1"
                      placeholder="e.g. 14"
                      className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      How many days to reserve the room from the date received
                    </p>
                  </div>
                </div>
              )}
            </div>}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Recording...' : hasExisting ? 'Record Payment' : 'Record Deposit & Approve'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
