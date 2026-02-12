'use client';

import { useState, useMemo } from 'react';
import { renderTemplate } from './templateRenderer';
import { getSampleData } from './sampleData';
import { sanitizeHtml } from '@/lib/sanitize';

interface AgreementPreviewPanelProps {
  content: string;
  agreementType?: 'tenancy_agreement';
}

export function AgreementPreviewPanel({ content, agreementType = 'tenancy_agreement' }: AgreementPreviewPanelProps) {
  const [previewType, setPreviewType] = useState<'room_only' | 'whole_house'>('room_only');

  const renderedContent = useMemo(() => {
    const sampleData = getSampleData(previewType);
    const rendered = renderTemplate(content, sampleData);
    return sanitizeHtml(rendered);
  }, [content, previewType]);

  return (
    <div className="flex flex-col h-full">
      {/* Preview Type Toggle */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <span className="text-sm font-medium text-gray-700">Preview as:</span>
        <div className="flex bg-white rounded-md border border-gray-300 overflow-hidden">
          <button
            type="button"
            onClick={() => setPreviewType('room_only')}
            className={`px-3 py-1 text-sm font-medium transition-colors ${
              previewType === 'room_only'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Room Only
          </button>
          <button
            type="button"
            onClick={() => setPreviewType('whole_house')}
            className={`px-3 py-1 text-sm font-medium transition-colors border-l border-gray-300 ${
              previewType === 'whole_house'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Whole House
          </button>
        </div>
      </div>

      {/* Preview Info */}
      <div className="px-3 py-2 bg-yellow-50 border-b border-yellow-200">
        <p className="text-xs text-yellow-800">
          <strong>Preview Mode:</strong> Showing how content will appear with sample data.
          {previewType === 'room_only' ? (
            <span className="ml-1">Single tenant (John Smith, Room 1)</span>
          ) : (
            <span className="ml-1">Multiple tenants (Alice Johnson + Bob Williams)</span>
          )}
        </p>
      </div>

      {/* Rendered Preview */}
      <div className="flex-1 overflow-y-auto p-4 bg-white">
        {content ? (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: renderedContent }}
          />
        ) : (
          <div className="text-center text-gray-400 py-8">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">Start typing in the editor to see a preview</p>
          </div>
        )}
      </div>

      {/* Sample Data Reference */}
      <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
        <details className="text-xs">
          <summary className="cursor-pointer text-gray-600 hover:text-gray-800 font-medium">
            View sample data values
          </summary>
          <div className="mt-2 max-h-40 overflow-y-auto">
            <SampleDataTable previewType={previewType} />
          </div>
        </details>
      </div>
    </div>
  );
}

function SampleDataTable({ previewType }: { previewType: 'room_only' | 'whole_house' }) {
  const data = getSampleData(previewType);

  const keyValuePairs = Object.entries(data)
    .filter(([_, value]) => typeof value !== 'object')
    .map(([key, value]) => ({
      key,
      value: String(value),
    }));

  return (
    <table className="w-full text-xs">
      <tbody>
        {keyValuePairs.map(({ key, value }) => (
          <tr key={key} className="border-b border-gray-100">
            <td className="py-1 pr-2 font-mono text-gray-500">{`{{${key}}}`}</td>
            <td className="py-1 text-gray-700 truncate max-w-[200px]" title={value}>
              {value || <span className="text-gray-400 italic">empty</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default AgreementPreviewPanel;
