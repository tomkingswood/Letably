'use client';

import { Modal } from '@/components/ui/Modal';

interface NewRequestForm {
  title: string;
  description: string;
  category: string;
  priority: string;
}

interface MaintenanceCardProps {
  maintenanceRequests: any[];
  isExpired: boolean;
  showNewRequestModal: boolean;
  setShowNewRequestModal: (show: boolean) => void;
  newRequestForm: NewRequestForm;
  setNewRequestForm: (form: NewRequestForm) => void;
  submittingRequest: boolean;
  onSubmitRequest: (e: React.FormEvent) => void;
}

export function MaintenanceCard({
  maintenanceRequests,
  isExpired,
  showNewRequestModal,
  setShowNewRequestModal,
  newRequestForm,
  setNewRequestForm,
  submittingRequest,
  onSubmitRequest,
}: MaintenanceCardProps) {
  if (isExpired) return null;

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900">Maintenance Requests</h2>
          </div>
          <button
            onClick={() => setShowNewRequestModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Report Issue
          </button>
        </div>

        {maintenanceRequests.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-3">🔧</div>
            <p className="text-gray-600 mb-2">No maintenance requests</p>
            <p className="text-sm text-gray-500">Click &quot;Report Issue&quot; to submit a maintenance request</p>
          </div>
        ) : (
          <div className="space-y-3">
            {maintenanceRequests.map((request) => (
              <a
                key={request.id}
                href={`/tenancy/maintenance/${request.id}`}
                className="block border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">
                        {request.category === 'plumbing' ? '🔧' :
                         request.category === 'electrical' ? '⚡' :
                         request.category === 'heating' ? '🔥' :
                         request.category === 'appliances' ? '🔌' :
                         request.category === 'structural' ? '🏗️' :
                         request.category === 'pest_control' ? '🐛' :
                         request.category === 'general' ? '🔨' : '📋'}
                      </span>
                      <h3 className="font-medium text-gray-900 truncate">{request.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{request.description}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(request.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                      {request.comment_count > 0 && (
                        <span className="ml-3">💬 {request.comment_count} {request.comment_count === 1 ? 'comment' : 'comments'}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
                      request.status === 'submitted' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                      request.status === 'in_progress' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                      'bg-green-100 text-green-800 border-green-200'
                    }`}>
                      {request.status === 'in_progress' ? 'In Progress' :
                       request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
                      request.priority === 'high' ? 'bg-red-100 text-red-800 border-red-200' :
                      request.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                      'bg-green-100 text-green-800 border-green-200'
                    }`}>
                      {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* New Maintenance Request Modal */}
      <Modal
        isOpen={showNewRequestModal}
        title="Report Maintenance Issue"
        onClose={() => setShowNewRequestModal(false)}
        size="lg"
      >
        <form onSubmit={onSubmitRequest} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Issue Title *</label>
            <input
              type="text"
              value={newRequestForm.title}
              onChange={(e) => setNewRequestForm({ ...newRequestForm, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
              placeholder="e.g., Leaking tap in bathroom"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              value={newRequestForm.description}
              onChange={(e) => setNewRequestForm({ ...newRequestForm, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary resize-none"
              placeholder="Please describe the issue in detail..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={newRequestForm.category}
                onChange={(e) => setNewRequestForm({ ...newRequestForm, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
              >
                <option value="plumbing">🔧 Plumbing</option>
                <option value="electrical">⚡ Electrical</option>
                <option value="heating">🔥 Heating</option>
                <option value="appliances">🔌 Appliances</option>
                <option value="structural">🏗️ Structural</option>
                <option value="pest_control">🐛 Pest Control</option>
                <option value="general">🔨 General</option>
                <option value="other">📋 Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={newRequestForm.priority}
                onChange={(e) => setNewRequestForm({ ...newRequestForm, priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
              >
                <option value="low">Low - Not urgent</option>
                <option value="medium">Medium - Needs attention soon</option>
                <option value="high">High - Urgent issue</option>
              </select>
            </div>
          </div>

          {/* High Priority Warning */}
          {newRequestForm.priority === 'high' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
              <p className="font-bold mb-1">Important - High Priority Issue</p>
              <p>For high priority issues, please also <strong>call us as soon as possible</strong> to ensure your issue is dealt with promptly. Do not rely solely on this ticket for emergencies.</p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">What happens next?</p>
            <p className="mb-2">Your request will be reviewed by our team and the landlord will be notified. We&apos;ll keep you updated on the progress via this portal.</p>
            <p className="text-blue-700"><strong>Important:</strong> If you haven&apos;t heard back from us within 2 working days, please ring us to confirm we&apos;ve received your report.</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowNewRequestModal(false)}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingRequest || !newRequestForm.title.trim() || !newRequestForm.description.trim()}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingRequest ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
