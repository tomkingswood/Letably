/**
 * Rent Calculation Methods
 *
 * Calculates monthly/periodic rent from weekly (PPPW) rates using
 * Calendar Month (PCM) method - UK industry standard
 */

/**
 * Calendar Month Method (PCM)
 * Industry-standard UK rent calculation
 * Formula: (Weekly Rent × 52 weeks) ÷ 12 months
 *
 * @param {number} weeklyRent - Rent per person per week (PPPW)
 * @returns {number} Monthly rent amount (PCM)
 */
function calculateCalendarMonth(weeklyRent) {
  return (weeklyRent * 52) / 12;
}

/**
 * Calculate rent using Calendar Month (PCM) method
 * Wrapper function for backwards compatibility
 *
 * @param {number} weeklyRent - Rent per person per week (PPPW)
 * @returns {number} Monthly rent amount (PCM)
 */
function calculateRent(weeklyRent) {
  return calculateCalendarMonth(weeklyRent);
}

/**
 * Get the number of days between two dates (inclusive)
 *
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {number} Number of days (inclusive)
 */
function getDaysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Set to start of day to avoid time zone issues
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Add 1 to make it inclusive (start day counts)
  return diffDays + 1;
}

/**
 * Calculate daily rate from weekly rent (for display purposes)
 *
 * @param {number} weeklyRent - Rent per person per week (PPPW)
 * @returns {number} Daily rent rate
 */
function getDailyRate(weeklyRent) {
  return weeklyRent / 7;
}

/**
 * Back-calculate approximate number of days from amount due and weekly rent
 * Used for displaying calculation breakdowns
 * Note: This is an approximation based on average month length
 *
 * @param {number} amountDue - The amount charged
 * @param {number} weeklyRent - Rent per person per week (PPPW)
 * @returns {number} Estimated number of days
 */
function estimateDaysFromAmount(amountDue, weeklyRent) {
  const monthlyRate = calculateCalendarMonth(weeklyRent);
  const months = amountDue / monthlyRate;
  // Approximate days (assumes 30.42 days per month on average)
  return Math.round(months * 30.42);
}

module.exports = {
  calculateCalendarMonth,
  calculateRent,
  getDaysBetween,
  getDailyRate,
  estimateDaysFromAmount
};
