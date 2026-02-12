'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAgency } from '@/lib/agency-context';
import { reminders } from '@/lib/api';
import Link from 'next/link';
import { MessageAlert } from '@/components/ui/MessageAlert';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable threshold row component
function SortableThresholdRow({
  threshold,
  index,
  onThresholdChange,
}: {
  threshold: any;
  index: number;
  onThresholdChange: (index: number, field: string, value: any) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: threshold.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b ${isDragging ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
            {...attributes}
            {...listeners}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="font-medium text-gray-900">{threshold.display_name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min="0"
          value={threshold.low_days}
          onChange={(e) =>
            onThresholdChange(index, 'low_days', parseInt(e.target.value))
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-center"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min="0"
          value={threshold.medium_days}
          onChange={(e) =>
            onThresholdChange(index, 'medium_days', parseInt(e.target.value))
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent text-center"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min="0"
          value={threshold.critical_days}
          onChange={(e) =>
            onThresholdChange(index, 'critical_days', parseInt(e.target.value))
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-center"
        />
      </td>
      <td className="px-4 py-3 text-center">
        <input
          type="checkbox"
          checked={threshold.enabled}
          onChange={(e) =>
            onThresholdChange(index, 'enabled', e.target.checked)
          }
          className="w-5 h-5 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
        />
      </td>
    </tr>
  );
}

export default function ReminderSettingsPage() {
  const router = useRouter();
  const { agencySlug } = useAgency();
  const [thresholds, setThresholds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchThresholds();
  }, []);

  const fetchThresholds = async () => {
    try {
      const response = await reminders.getThresholds();
      setThresholds(response.data);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to load reminder thresholds',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleThresholdChange = (index: number, field: string, value: any) => {
    const newThresholds = [...thresholds];
    newThresholds[index] = { ...newThresholds[index], [field]: value };
    setThresholds(newThresholds);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = thresholds.findIndex((t) => t.id === active.id);
      const newIndex = thresholds.findIndex((t) => t.id === over.id);

      const newThresholds = arrayMove(thresholds, oldIndex, newIndex);
      setThresholds(newThresholds);

      // Save new order to backend
      try {
        const thresholdIds = newThresholds.map((t) => t.id);
        await reminders.reorderThresholds(thresholdIds);
        setMessage({
          type: 'success',
          text: 'Threshold order updated successfully!',
        });
        setTimeout(() => setMessage(null), 3000);
      } catch (error: any) {
        setMessage({
          type: 'error',
          text: error.response?.data?.error || 'Failed to update threshold order',
        });
        // Revert on error
        fetchThresholds();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await reminders.updateThresholds({ thresholds });
      setMessage({
        type: 'success',
        text: 'Reminder settings updated successfully!',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to update reminder settings',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading reminder settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-primary text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">Reminder Threshold Settings</h1>
              <p className="text-xl text-white/90">Configure reminder severity thresholds for property certificates and viewing requests</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => router.push(`/${agencySlug}/admin`)}
                className="bg-white text-primary hover:bg-gray-100 px-6 py-2 rounded-lg font-semibold transition-colors w-full sm:w-auto"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href={`/${agencySlug}/admin?section=reminders`} className="text-primary hover:text-primary-dark font-semibold">
            ← Back to Reminders
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-600 mb-6">
            Configure the number of days to trigger reminders at different severity levels.
            Reminders will be generated automatically based on certificate expiry dates and viewing request status.
          </p>

          {message && (
            <MessageAlert type={message.type} message={message.text} className="mb-6" />
          )}

          <form onSubmit={handleSubmit}>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b">
                        Reminder Type
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700 border-b">
                        <span className="inline-flex items-center">
                          <span className="w-3 h-3 bg-yellow-400 rounded-full mr-2"></span>
                          Low (days)
                        </span>
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700 border-b">
                        <span className="inline-flex items-center">
                          <span className="w-3 h-3 bg-orange-400 rounded-full mr-2"></span>
                          Medium (days)
                        </span>
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700 border-b">
                        <span className="inline-flex items-center">
                          <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                          Critical (days)
                        </span>
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700 border-b">
                        Enabled
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <SortableContext
                      items={thresholds.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {thresholds.map((threshold, index) => (
                        <SortableThresholdRow
                          key={threshold.id}
                          threshold={threshold}
                          index={index}
                          onThresholdChange={handleThresholdChange}
                        />
                      ))}
                    </SortableContext>
                  </tbody>
                </table>
              </DndContext>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {thresholds.map((threshold, index) => (
                <div key={threshold.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-gray-900">{threshold.display_name}</h3>
                      <div className="flex items-center gap-2">
                        <label htmlFor={`enabled-${threshold.id}`} className="text-sm text-gray-600">Enabled</label>
                        <input
                          type="checkbox"
                          id={`enabled-${threshold.id}`}
                          checked={threshold.enabled}
                          onChange={(e) => handleThresholdChange(index, 'enabled', e.target.checked)}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                        <span className="w-3 h-3 bg-yellow-400 rounded-full mr-2"></span>
                        Low (days)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={threshold.low_days}
                        onChange={(e) => handleThresholdChange(index, 'low_days', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                        <span className="w-3 h-3 bg-orange-400 rounded-full mr-2"></span>
                        Medium (days)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={threshold.medium_days}
                        onChange={(e) => handleThresholdChange(index, 'medium_days', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                        <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                        Critical (days)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={threshold.critical_days}
                        onChange={(e) => handleThresholdChange(index, 'critical_days', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>

          <div className="mt-8 bg-blue-50 border-l-4 border-blue-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">How it works:</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      <strong>Certificates:</strong> Reminders trigger when expiry date is within the specified days
                    </li>
                    <li>
                      <strong>Pending Viewing Requests:</strong> Days since request was created
                    </li>
                    <li>
                      <strong>Upcoming Viewings:</strong> Days until the confirmed viewing date
                    </li>
                    <li>
                      <strong>Severity Levels:</strong> Low → Medium → Critical (highest priority)
                    </li>
                    <li>
                      <strong>Enabled:</strong> Uncheck to disable reminders for a specific type
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
