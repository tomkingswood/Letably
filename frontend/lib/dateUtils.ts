/**
 * Centralized date formatting utilities
 * Used across the application for consistent date/time display
 */

export type DateFormat = 'short' | 'long' | 'datetime' | 'time';

/**
 * Format a date string according to the specified format
 * @param dateString - ISO date string or Date object (can be null/undefined)
 * @param format - Desired output format
 * @returns Formatted date string, or empty string if date is null/undefined
 */
export function formatDate(
  dateString: string | Date | null | undefined,
  format: DateFormat = 'short'
): string {
  // Handle null/undefined/empty
  if (dateString === null || dateString === undefined || dateString === '') {
    return '';
  }

  const date = new Date(dateString);

  // Check for invalid date
  if (isNaN(date.getTime())) {
    return '';
  }

  switch (format) {
    case 'short':
      // Format: DD/MM/YYYY
      return date.toLocaleDateString('en-GB');

    case 'long':
      // Format: 01 Jan 2024
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

    case 'datetime':
      // Format: 01/01/2024, 14:30
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

    case 'time':
      // Format: 14:30
      return date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      });

    default:
      return date.toLocaleDateString('en-GB');
  }
}

/**
 * Format a date/time string with full timestamp
 * @param dateString - ISO date string
 * @returns Formatted date and time string
 */
export function formatDateTime(dateString: string | Date): string {
  return formatDate(dateString, 'datetime');
}

/**
 * Format a date string in short format (DD/MM/YYYY)
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
export function formatDateOnly(dateString: string | Date): string {
  return formatDate(dateString, 'short');
}

/**
 * Format a date string in long format (01 Jan 2024)
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
export function formatDateLong(dateString: string | Date): string {
  return formatDate(dateString, 'long');
}

/**
 * Format date with month name and time (e.g., "1 Jan 2024, 14:30")
 */
export function formatDateWithTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format date with month name and time, without year (e.g., "1 Jan, 14:30")
 */
export function formatDateTimeShort(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format date with month name, no time (e.g., "1 Jan 2024")
 */
export function formatDateMonthShort(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format date in full format with long month (e.g., "01 January 2024")
 */
export function formatDateFull(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format date with day and short month, no year (e.g., "01 Jan")
 */
export function formatDateDayMonth(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}

/**
 * Get relative time description (e.g., "2 hours ago", "Yesterday")
 * @param dateString - ISO date string
 * @returns Relative time string
 */
export function getRelativeTime(dateString: string | Date): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return formatDateTimeShort(dateString);
}

/**
 * Check if a date is in the past
 * @param dateString - ISO date string
 * @returns True if date is in the past
 */
export function isPast(dateString: string | Date): boolean {
  const date = new Date(dateString);
  return date.getTime() < Date.now();
}

/**
 * Check if a date is in the future
 * @param dateString - ISO date string
 * @returns True if date is in the future
 */
export function isFuture(dateString: string | Date): boolean {
  const date = new Date(dateString);
  return date.getTime() > Date.now();
}

/**
 * Format a tenancy period, handling rolling monthly tenancies (no end date)
 * @param startDate - Start date string
 * @param endDate - End date string (can be null for rolling monthly)
 * @param format - Date format to use
 * @returns Formatted tenancy period string
 */
export function formatTenancyPeriod(
  startDate: string | Date | null | undefined,
  endDate: string | Date | null | undefined,
  format: DateFormat = 'short'
): string {
  const formattedStart = formatDate(startDate, format);

  if (!formattedStart) {
    return 'No dates set';
  }

  if (!endDate) {
    return `${formattedStart} (Rolling Monthly)`;
  }

  const formattedEnd = formatDate(endDate, format);
  return `${formattedStart} - ${formattedEnd}`;
}
