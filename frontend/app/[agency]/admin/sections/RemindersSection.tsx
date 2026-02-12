'use client';

import { useState, useEffect } from 'react';
import { reminders as remindersApi } from '@/lib/api';
import { useAgency } from '@/lib/agency-context';
import { SectionProps } from './index';

interface Reminder {
  id: number;
  type: string;
  title: string;
  message: string;
  due_date: string;
  property_address?: string;
  is_dismissed: boolean;
  created_at: string;
}

export default function RemindersSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const { agencySlug } = useAgency();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDismissed, setShowDismissed] = useState(false);

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    try {
      const response = await remindersApi.getAll();
      setReminders(response.data.reminders || []);
    } catch (error) {
      console.error('Error fetching reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (id: number) => {
    try {
      await remindersApi.dismiss(id);
      setReminders(reminders.map(r =>
        r.id === id ? { ...r, is_dismissed: true } : r
      ));
    } catch (error) {
      console.error('Error dismissing reminder:', error);
    }
  };

  const filteredReminders = reminders.filter(r => showDismissed || !r.is_dismissed);
  const activeReminders = reminders.filter(r => !r.is_dismissed);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'certificate_expiry':
        return (
          <div className="bg-red-100 p-2 rounded-lg">
            <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'tenancy_ending':
        return (
          <div className="bg-amber-100 p-2 rounded-lg">
            <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="bg-purple-100 p-2 rounded-lg">
            <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
          </div>
        );
    }
  };

  const getDaysUntil = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reminders & Alerts</h2>
          <p className="text-gray-600">Certificate expiry reminders and custom alerts</p>
        </div>
        {activeReminders.length > 0 && (
          <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
            {activeReminders.length} active
          </span>
        )}
      </div>

      {/* Toggle */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showDismissed}
            onChange={(e) => setShowDismissed(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-gray-700">Show dismissed reminders</span>
        </label>
      </div>

      {/* Reminders List */}
      <div className="space-y-4">
        {filteredReminders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <p className="text-gray-600">No active reminders - you're all caught up!</p>
          </div>
        ) : (
          filteredReminders.map(reminder => {
            const daysUntil = getDaysUntil(reminder.due_date);
            const isUrgent = daysUntil <= 7;
            const isOverdue = daysUntil < 0;

            return (
              <div
                key={reminder.id}
                className={`bg-white rounded-lg shadow-md p-4 ${
                  reminder.is_dismissed ? 'opacity-60' : ''
                } ${isOverdue ? 'border-l-4 border-red-500' : isUrgent ? 'border-l-4 border-amber-500' : ''}`}
              >
                <div className="flex items-start gap-4">
                  {getTypeIcon(reminder.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900">{reminder.title}</h4>
                      {isOverdue && (
                        <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full">
                          Overdue
                        </span>
                      )}
                      {!isOverdue && isUrgent && (
                        <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full">
                          Due soon
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{reminder.message}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {reminder.property_address && <span>{reminder.property_address}</span>}
                      <span>Due: {new Date(reminder.due_date).toLocaleDateString('en-GB')}</span>
                    </div>
                  </div>
                  {!reminder.is_dismissed && (
                    <button
                      onClick={() => handleDismiss(reminder.id)}
                      className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-sm font-medium"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
