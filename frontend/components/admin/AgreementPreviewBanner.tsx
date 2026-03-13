'use client';

import { ReactNode } from 'react';

interface AgreementPreviewBannerProps {
  description?: string;
  showTestDataConfig: boolean;
  onToggleConfig: () => void;
  onPreviewRoomOnly: () => void;
  onPreviewWholeHouse: () => void;
  children?: ReactNode;
}

export default function AgreementPreviewBanner({
  description = 'Test how your agreement sections will look with customizable sample data',
  showTestDataConfig,
  onToggleConfig,
  onPreviewRoomOnly,
  onPreviewWholeHouse,
  children,
}: AgreementPreviewBannerProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h4 className="font-semibold text-blue-900 mb-1">Preview Agreement with Test Data</h4>
          <p className="text-sm text-blue-700">{description}</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={onToggleConfig}
            className={`px-4 py-2 rounded transition-colors flex items-center gap-2 ${
              showTestDataConfig
                ? 'bg-blue-700 text-white'
                : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-100'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configure Test Data
          </button>
          <button
            onClick={onPreviewRoomOnly}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview Room Only
          </button>
          <button
            onClick={onPreviewWholeHouse}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview Whole House
          </button>
        </div>
      </div>

      {children}
    </div>
  );
}
