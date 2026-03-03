'use client';

import { useState, useEffect } from 'react';
import { settings } from '@/lib/api';
import { getErrorMessage, ConfigurableQuestion, ApplicationFormConfig, ApplicationFormConfigEntry } from '@/lib/types';
import { MessageAlert } from '@/components/ui/MessageAlert';

type TabType = 'all' | 'student' | 'professional';

interface CatalogueData {
  student: ConfigurableQuestion[];
  professional: ConfigurableQuestion[];
  all: ConfigurableQuestion[];
}

export default function ApplicationFormConfigSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [catalogue, setCatalogue] = useState<CatalogueData>({ student: [], professional: [], all: [] });
  const [config, setConfig] = useState<ApplicationFormConfig>({ all: [], student: [], professional: [] });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await settings.getApplicationFormConfig();
        setCatalogue(response.data.catalogue);

        if (response.data.config) {
          // Ensure all three keys exist (backwards compat with old configs that lack 'all')
          setConfig({
            all: response.data.config.all || [],
            student: response.data.config.student || [],
            professional: response.data.config.professional || [],
          });
        }
        // If no config saved, leave defaults empty — getConfigEntry falls back to catalogue defaults
      } catch (err: unknown) {
        setMessage({ type: 'error', text: getErrorMessage(err, 'Failed to load form configuration') });
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const getQuestionsForTab = (): ConfigurableQuestion[] => {
    return catalogue[activeTab] || [];
  };

  const getConfigEntry = (key: string): ApplicationFormConfigEntry | undefined => {
    return config[activeTab].find((c) => c.key === key);
  };

  const updateConfigEntry = (key: string, field: 'enabled' | 'required', value: boolean) => {
    setConfig((prev) => {
      const tabConfig = [...prev[activeTab]];
      const idx = tabConfig.findIndex((c) => c.key === key);
      if (idx >= 0) {
        tabConfig[idx] = { ...tabConfig[idx], [field]: value };
      } else {
        const q = getQuestionsForTab().find((q) => q.key === key);
        tabConfig.push({
          key,
          enabled: field === 'enabled' ? value : true,
          required: field === 'required' ? value : q?.required ?? true,
        });
      }
      return { ...prev, [activeTab]: tabConfig };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await settings.updateApplicationFormConfig(config);
      setMessage({ type: 'success', text: 'Application form configuration saved successfully' });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Failed to save configuration') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const questions = getQuestionsForTab();

  // Group questions by section for display
  const sectionGroups: { sectionLabel: string; questions: ConfigurableQuestion[] }[] = [];
  let currentGroup: (typeof sectionGroups)[0] | null = null;
  for (const q of questions) {
    if (!currentGroup || currentGroup.sectionLabel !== q.sectionLabel) {
      currentGroup = { sectionLabel: q.sectionLabel, questions: [] };
      sectionGroups.push(currentGroup);
    }
    currentGroup.questions.push(q);
  }

  const tabs: { key: TabType; label: string; description: string }[] = [
    { key: 'all', label: 'General', description: 'Applies to both student and professional forms' },
    { key: 'student', label: 'Student', description: 'Student application only' },
    { key: 'professional', label: 'Professional', description: 'Professional application only' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Application Form Configuration</h2>
        <p className="text-sm text-gray-600 mt-1">
          Choose which questions appear on your application forms.
          Core fields (personal details, address, identity, declaration) are always shown.
        </p>
      </div>

      {message && <MessageAlert type={message.type} message={message.text} className="mb-6" />}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab description */}
      <p className="text-sm text-gray-500 mb-4">
        {tabs.find((t) => t.key === activeTab)?.description}
      </p>

      {/* Question groups */}
      {sectionGroups.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No configurable questions for this tab.</p>
      ) : (
        <div className="space-y-6">
          {sectionGroups.map((group) => (
            <div key={group.sectionLabel} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">{group.sectionLabel}</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {group.questions.map((q) => {
                  const entry = getConfigEntry(q.key);
                  const isEnabled = entry ? entry.enabled : true;
                  const isRequired = entry ? entry.required : q.required;

                  return (
                    <div key={q.key} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) => updateConfigEntry(q.key, 'enabled', e.target.checked)}
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                          />
                          <span className={`text-sm ${isEnabled ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                            {q.label}
                          </span>
                        </label>
                      </div>
                      <div className="flex-shrink-0 ml-4">
                        <select
                          value={isRequired ? 'required' : 'optional'}
                          onChange={(e) => updateConfigEntry(q.key, 'required', e.target.value === 'required')}
                          disabled={!isEnabled}
                          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          <option value="required">Required</option>
                          <option value="optional">Optional</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
