/**
 * Shared utility functions for report components
 */

import { formatDateLong } from '@/lib/dateUtils';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(amount);
}

export function formatDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  return formatDateLong(dateString);
}

export function formatTenancyPeriod(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): string {
  const formattedStart = formatDate(startDate);
  if (!formattedStart) return '-';
  const formattedEnd = formatDate(endDate);
  if (!formattedEnd) return `${formattedStart} (Rolling)`;
  return `${formattedStart} - ${formattedEnd}`;
}
