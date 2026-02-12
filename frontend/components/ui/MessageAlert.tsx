interface MessageAlertProps {
  type: 'success' | 'error';
  message: string | null | undefined;
  className?: string;
  onDismiss?: () => void;
}

export function MessageAlert({ type, message, className = '', onDismiss }: MessageAlertProps) {
  if (!message) return null;

  const styles = type === 'success'
    ? 'bg-green-50 text-green-800 border border-green-200'
    : 'bg-red-50 text-red-800 border border-red-200';

  return (
    <div className={`px-4 py-3 rounded-lg ${styles} ${className} ${onDismiss ? 'flex items-start justify-between' : ''}`}>
      <span className={type === 'error' ? 'whitespace-pre-wrap' : ''}>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={`ml-4 flex-shrink-0 ${type === 'success' ? 'text-green-700 hover:text-green-900' : 'text-red-700 hover:text-red-900'}`}
        >
          &times;
        </button>
      )}
    </div>
  );
}
