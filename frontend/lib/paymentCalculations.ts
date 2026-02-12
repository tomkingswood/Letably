import { PaymentSchedule, TenancyMember } from './types';

interface PaymentBreakdown {
  pppw: number;
  rentPerDay: number;
  dailyRate: number;
  monthlyRate: number;
  days: number;
  daysInMonth: number | null;
  isMultiMonth: boolean;
  monthlyBreakdown: Array<{
    month: string;
    days: number;
    fullMonthDays: number;
    isFullMonth: boolean;
    amount: number;
  }> | null;
  periodStart: Date;
  periodEnd: Date;
  calculatedAmount: number;
  calculationMethod: string;
  isFullMonth: boolean;
}

/**
 * Calculate payment breakdown for a payment schedule
 * Shows how rent was calculated from PPPW to the final amount
 */
export function calculatePaymentBreakdown(
  payment: PaymentSchedule,
  member: TenancyMember,
  tenancyStartDate: string,
  tenancyEndDate: string | null
): PaymentBreakdown | null {
  if (!member?.rent_pppw || !payment.amount_due) return null;

  // Always use Calendar Month (PCM) - UK industry standard
  const method = 'calendar_month';

  const monthlyRate = (member.rent_pppw * 52) / 12;
  const dailyRate = member.rent_pppw / 7;

  // Check if this is a full single month payment (for calendar_month)
  const isFullMonth = method === 'calendar_month' && Math.abs(payment.amount_due - monthlyRate) < 0.50;

  // Check if this is a multi-month period (quarterly/upfront)
  const estimatedMonths = payment.amount_due / monthlyRate;
  const isMultiMonth = estimatedMonths >= 1.5; // 1.5+ months = multi-month period

  let rentPerDay: number;
  let days: number;
  let daysInMonth: number | null = null;
  let monthlyBreakdown: Array<{ month: string; days: number; fullMonthDays: number; isFullMonth: boolean; amount: number }> | null = null;
  let calculatedPeriodStart: Date | null = null;
  let calculatedPeriodEnd: Date | null = null;

  if (isFullMonth) {
    // Full month calendar_month
    rentPerDay = monthlyRate / 30.4375;
    days = Math.round(payment.amount_due / dailyRate);
  } else if (method === 'calendar_month' && isMultiMonth) {
    // Multi-month period (quarterly/upfront/rolling first payment) - calculate month-by-month
    const dueDate = new Date(payment.due_date);
    const tenancyStart = new Date(tenancyStartDate);
    // For rolling monthly tenancies with no end date, use a far future date
    const tenancyEnd = tenancyEndDate ? new Date(tenancyEndDate) : new Date(dueDate.getFullYear() + 10, 11, 31);

    // Check if this is a rolling monthly first payment with mid-month start
    // These have description like "Rent - June 2025 (partial) & July 2025"
    // The period starts from tenancy start, even though due date is 1st of next month
    const isRollingFirstPaymentWithPartial = payment.description?.includes('(partial) &');

    // Determine period start:
    // - For rolling first payment with partial: use tenancy start (period starts before due date)
    // - For other payments: use later of due date or tenancy start
    let actualStart: Date;
    if (isRollingFirstPaymentWithPartial) {
      actualStart = tenancyStart;
    } else {
      actualStart = dueDate > tenancyStart ? dueDate : tenancyStart;
    }

    // Calculate month-by-month breakdown
    monthlyBreakdown = [];
    let currentDate = new Date(actualStart);
    let remainingAmount = payment.amount_due;
    let maxIterations = 12; // Safety limit

    // Loop while we have remaining amount and haven't exceeded safety limit
    while (remainingAmount > 0.01 && maxIterations > 0 && currentDate <= tenancyEnd) {
      maxIterations--;
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const periodStart = currentDate > monthStart ? currentDate : monthStart;
      const periodEndInMonth = tenancyEnd < monthEnd ? tenancyEnd : monthEnd;

      if (periodStart <= periodEndInMonth) {
        // Normalize dates to midnight to avoid time component issues
        const normalizedStart = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate());
        const normalizedEnd = new Date(periodEndInMonth.getFullYear(), periodEndInMonth.getMonth(), periodEndInMonth.getDate());
        const daysInThisMonth = Math.round((normalizedEnd.getTime() - normalizedStart.getTime()) / 86400000) + 1;
        const fullMonthDays = monthEnd.getDate();

        let monthAmount;
        const isFullMonth = daysInThisMonth === fullMonthDays;

        if (isFullMonth) {
          // Full month
          monthAmount = monthlyRate;
        } else {
          // Partial month
          monthAmount = (daysInThisMonth / fullMonthDays) * monthlyRate;
        }

        monthAmount = parseFloat(monthAmount.toFixed(2));
        remainingAmount -= monthAmount;

        monthlyBreakdown.push({
          month: periodStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
          days: daysInThisMonth,
          fullMonthDays: fullMonthDays,
          isFullMonth: isFullMonth,
          amount: monthAmount
        });
      }

      // Move to next month
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }

    rentPerDay = dailyRate;
    // Calculate total days from monthly breakdown
    days = monthlyBreakdown.reduce((total, month) => total + month.days, 0);
    calculatedPeriodStart = actualStart;

    // Calculate actual period end from the last month in breakdown
    if (monthlyBreakdown.length > 0) {
      const lastMonth = monthlyBreakdown[monthlyBreakdown.length - 1];
      // Parse the month name to get the date
      const lastMonthDate = new Date(lastMonth.month);
      const lastMonthEnd = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0);

      // If it's a full month, use the last day of that month
      // Otherwise use the partial days
      if (lastMonth.isFullMonth) {
        calculatedPeriodEnd = lastMonthEnd;
      } else {
        // For partial month, calculate the actual end date from the start + days
        const lastMonthStart = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1);
        calculatedPeriodEnd = new Date(lastMonthStart.getTime() + (lastMonth.days - 1) * 86400000);
      }
    }
  } else {
    // Single partial month in calendar_month
    const dueDate = new Date(payment.due_date);
    const monthEnd = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0);
    daysInMonth = monthEnd.getDate();

    // Back-calculate days from proportional formula
    const proportionalDays = Math.round((payment.amount_due / monthlyRate) * daysInMonth);
    days = proportionalDays;
    rentPerDay = dailyRate; // For display consistency
  }

  // Estimate the period based on due date and calculated days
  const dueDate = new Date(payment.due_date);
  // For rolling monthly tenancies with no end date, use a far future date
  const tenancyEnd = tenancyEndDate ? new Date(tenancyEndDate) : new Date(dueDate.getFullYear() + 10, 11, 31);

  let periodStart: Date;
  let periodEnd: Date;

  // Use pre-calculated period for multi-month, or estimate for other types
  if (calculatedPeriodStart && calculatedPeriodEnd) {
    periodStart = calculatedPeriodStart;
    periodEnd = calculatedPeriodEnd;
  } else {
    periodStart = dueDate;
    const estimatedEndTime = dueDate.getTime() + (days - 1) * (1000 * 60 * 60 * 24);
    periodEnd = new Date(estimatedEndTime);

    // Cap at tenancy end if necessary (only if there's a real end date)
    if (tenancyEndDate && periodEnd > tenancyEnd) {
      periodEnd = tenancyEnd;
    }
  }

  // Calculate the actual amount from monthly breakdown if available
  // This ensures the breakdown total matches what was actually calculated
  let actualCalculatedAmount = payment.amount_due;
  if (monthlyBreakdown && monthlyBreakdown.length > 0) {
    actualCalculatedAmount = monthlyBreakdown.reduce((sum, month) => sum + month.amount, 0);
    actualCalculatedAmount = parseFloat(actualCalculatedAmount.toFixed(2));
  }

  return {
    pppw: member.rent_pppw,
    rentPerDay: rentPerDay,
    dailyRate: dailyRate,
    monthlyRate: monthlyRate,
    days: days,
    daysInMonth: daysInMonth,
    isMultiMonth: isMultiMonth,
    monthlyBreakdown: monthlyBreakdown,
    periodStart: periodStart,
    periodEnd: periodEnd,
    calculatedAmount: actualCalculatedAmount,
    calculationMethod: method,
    isFullMonth: isFullMonth
  };
}
