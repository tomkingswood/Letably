'use client';

import React from 'react';
import { PaymentSchedule, Payment } from '@/lib/types';
import Input from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { MessageAlert } from '@/components/ui/MessageAlert';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  recordingPayment: boolean;
  paymentFormData: {
    amount_paid: number;
    paid_date: string;
    payment_reference: string;
  };
  onPaymentFormDataChange: (data: { amount_paid: number; paid_date: string; payment_reference: string }) => void;
}

export function RecordPaymentModal({
  isOpen,
  onClose,
  onSubmit,
  recordingPayment,
  paymentFormData,
  onPaymentFormDataChange,
}: RecordPaymentModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Payment"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid</label>
          <Input
            type="number"
            step="0.01"
            value={paymentFormData.amount_paid}
            onChange={(e) => onPaymentFormDataChange({...paymentFormData, amount_paid: parseFloat(e.target.value)})}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
          <Input
            type="date"
            value={paymentFormData.paid_date}
            onChange={(e) => onPaymentFormDataChange({...paymentFormData, paid_date: e.target.value})}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Reference (Optional)</label>
          <Input
            type="text"
            value={paymentFormData.payment_reference}
            onChange={(e) => onPaymentFormDataChange({...paymentFormData, payment_reference: e.target.value})}
            placeholder="e.g., Bank transfer ref"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={recordingPayment}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {recordingPayment ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface CreateManualPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  creatingManualPayment: boolean;
  manualPaymentError: string;
  manualPaymentFormData: {
    due_date: string;
    amount_due: number;
    payment_type: string;
    description: string;
  };
  onManualPaymentFormDataChange: (data: { due_date: string; amount_due: number; payment_type: string; description: string }) => void;
}

export function CreateManualPaymentModal({
  isOpen,
  onClose,
  onSubmit,
  creatingManualPayment,
  manualPaymentError,
  manualPaymentFormData,
  onManualPaymentFormDataChange,
}: CreateManualPaymentModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Manual Payment"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <MessageAlert type="error" message={manualPaymentError} className="text-sm" />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type</label>
          <select
            value={manualPaymentFormData.payment_type}
            onChange={(e) => onManualPaymentFormDataChange({...manualPaymentFormData, payment_type: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="rent">Rent</option>
            <option value="deposit">Deposit</option>
            <option value="utilities">Utilities</option>
            <option value="fees">Fees</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <Input
            type="text"
            value={manualPaymentFormData.description}
            onChange={(e) => onManualPaymentFormDataChange({...manualPaymentFormData, description: e.target.value})}
            placeholder="e.g., Additional cleaning fee"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount Due</label>
          <Input
            type="number"
            step="0.01"
            value={manualPaymentFormData.amount_due}
            onChange={(e) => onManualPaymentFormDataChange({...manualPaymentFormData, amount_due: parseFloat(e.target.value)})}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
          <Input
            type="date"
            value={manualPaymentFormData.due_date}
            onChange={(e) => onManualPaymentFormDataChange({...manualPaymentFormData, due_date: e.target.value})}
            required
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={creatingManualPayment}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {creatingManualPayment ? 'Creating...' : 'Create Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface EditPaymentScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdatePayment: () => void;
  onDeleteSchedule: () => void;
  editingPaymentAmount: boolean;
  deletingPayment: boolean;
  editPaymentFormData: {
    amount_due: number;
    due_date: string;
    payment_type: string;
    description: string;
  };
  onEditPaymentFormDataChange: (data: { amount_due: number; due_date: string; payment_type: string; description: string }) => void;
}

export function EditPaymentScheduleModal({
  isOpen,
  onClose,
  onUpdatePayment,
  onDeleteSchedule,
  editingPaymentAmount,
  deletingPayment,
  editPaymentFormData,
  onEditPaymentFormDataChange,
}: EditPaymentScheduleModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Payment Schedule"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type</label>
          <select
            value={editPaymentFormData.payment_type}
            onChange={(e) => onEditPaymentFormDataChange({...editPaymentFormData, payment_type: e.target.value})}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="rent">Rent</option>
            <option value="deposit">Deposit</option>
            <option value="utilities">Utilities</option>
            <option value="fees">Fees</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <Input
            type="text"
            value={editPaymentFormData.description}
            onChange={(e) => onEditPaymentFormDataChange({...editPaymentFormData, description: e.target.value})}
            placeholder="e.g., Monthly Rent, Deposit Payment"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount Due</label>
          <Input
            type="number"
            step="0.01"
            value={editPaymentFormData.amount_due}
            onChange={(e) => onEditPaymentFormDataChange({...editPaymentFormData, amount_due: parseFloat(e.target.value)})}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
          <Input
            type="date"
            value={editPaymentFormData.due_date}
            onChange={(e) => onEditPaymentFormDataChange({...editPaymentFormData, due_date: e.target.value})}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={onDeleteSchedule}
            disabled={deletingPayment}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {deletingPayment ? 'Deleting...' : 'Delete Schedule'}
          </button>
          <button
            onClick={onUpdatePayment}
            disabled={editingPaymentAmount}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {editingPaymentAmount ? 'Updating...' : 'Update Payment'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface EditSinglePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onDelete: () => void;
  editingSinglePayment: boolean;
  singlePaymentFormData: {
    amount: number;
    payment_date: string;
    payment_reference: string;
  };
  onSinglePaymentFormDataChange: (data: { amount: number; payment_date: string; payment_reference: string }) => void;
}

export function EditSinglePaymentModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  editingSinglePayment,
  singlePaymentFormData,
  onSinglePaymentFormDataChange,
}: EditSinglePaymentModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Payment"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
          <Input
            type="number"
            step="0.01"
            value={singlePaymentFormData.amount}
            onChange={(e) => onSinglePaymentFormDataChange({...singlePaymentFormData, amount: parseFloat(e.target.value)})}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
          <Input
            type="date"
            value={singlePaymentFormData.payment_date}
            onChange={(e) => onSinglePaymentFormDataChange({...singlePaymentFormData, payment_date: e.target.value})}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Reference</label>
          <Input
            type="text"
            value={singlePaymentFormData.payment_reference}
            onChange={(e) => onSinglePaymentFormDataChange({...singlePaymentFormData, payment_reference: e.target.value})}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete
          </button>
          <button
            type="submit"
            disabled={editingSinglePayment}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {editingSinglePayment ? 'Updating...' : 'Update'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
