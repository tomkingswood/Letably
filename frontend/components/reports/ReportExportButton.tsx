'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { getAuthToken } from '@/lib/api';

interface ReportExportButtonProps {
  reportType: string;
  size?: 'sm' | 'md' | 'lg';
  onError?: (message: string) => void;
}

export default function ReportExportButton({
  reportType,
  size = 'sm',
  onError,
}: ReportExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    try {
      setExporting(true);
      const token = getAuthToken();
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${baseUrl}/reports/${reportType}/export`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `${reportType}-export.csv`;

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export error:', err);
      onError?.('Failed to export report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size={size}
      onClick={handleExport}
      disabled={exporting}
    >
      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      {exporting ? 'Exporting...' : 'Export CSV'}
    </Button>
  );
}
