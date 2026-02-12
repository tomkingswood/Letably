import { useState } from 'react';
import { IdDocumentStatus } from '@/lib/types';
import { getErrorMessage } from '@/lib/types';

interface IdDocumentApi {
  checkStatus: () => Promise<{ data: IdDocumentStatus }>;
  upload: (file: File) => Promise<unknown>;
  getViewUrl: () => string;
  delete: () => Promise<unknown>;
  /** If viewing requires an auth header (e.g. applicant vs guarantor public link) */
  viewHeaders?: () => Record<string, string>;
}

interface MessageSetter {
  (msg: { type: 'success' | 'error'; text: string } | null): void;
}

export function useIdDocument(api: IdDocumentApi, setMessage: MessageSetter) {
  const [idDocumentUploaded, setIdDocumentUploaded] = useState(false);
  const [idDocumentInfo, setIdDocumentInfo] = useState<IdDocumentStatus | null>(null);
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [uploadingId, setUploadingId] = useState(false);

  const checkStatus = async () => {
    try {
      const response = await api.checkStatus();
      if (response.data.uploaded) {
        setIdDocumentUploaded(true);
        setIdDocumentInfo(response.data);
      }
    } catch {
      setIdDocumentUploaded(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

    if (!validTypes.includes(file.type) && !isImage && !isPdf) {
      setMessage({ type: 'error', text: 'Invalid file type. Please upload an image (JPEG, PNG) or PDF file.' });
      e.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File size exceeds 10MB limit.' });
      e.target.value = '';
      return;
    }

    setUploadingId(true);
    setMessage(null);

    try {
      await api.upload(file);
      setMessage({ type: 'success', text: 'ID document uploaded successfully!' });
      setIdDocumentUploaded(true);
      setIdDocument(null);
      await checkStatus();
    } catch (error: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(error, 'Failed to upload ID document') });
    } finally {
      setUploadingId(false);
      e.target.value = '';
    }
  };

  const handleView = async () => {
    try {
      const url = api.getViewUrl();
      const headers = api.viewHeaders?.() || {};
      const response = await fetch(url, { headers });

      if (!response.ok) throw new Error('Failed to load document');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      setMessage({ type: 'error', text: 'Failed to view ID document' });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete your ID document? You can upload a different one after deletion.')) {
      return;
    }

    setUploadingId(true);
    setMessage(null);

    try {
      await api.delete();
      setMessage({ type: 'success', text: 'ID document deleted successfully. You can now upload a new document.' });
      setIdDocumentUploaded(false);
      setIdDocumentInfo(null);
      setIdDocument(null);
    } catch (error: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(error, 'Failed to delete ID document') });
    } finally {
      setUploadingId(false);
    }
  };

  return {
    idDocumentUploaded,
    idDocumentInfo,
    idDocument,
    uploadingId,
    setIdDocument,
    checkStatus,
    handleFileChange,
    handleView,
    handleDelete,
  };
}
