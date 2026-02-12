const {
  calculateScheduleStatus,
  enrichScheduleWithPayments,
  getSchedulesWithMemberDetails,
  getSchedulesForMember
} = require('../helpers/paymentHelpers');
const paymentRepo = require('../repositories/paymentRepository');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Get all payment schedules for a specific tenancy (Admin only)
 */
exports.getTenancyPayments = asyncHandler(async (req, res) => {
  const { tenancyId } = req.params;
  const agencyId = req.agencyId;

  // Verify tenancy exists
  const tenancy = await paymentRepo.getTenancyById(tenancyId, agencyId);
  if (!tenancy) {
    return res.status(404).json({ error: 'Tenancy not found' });
  }

  // Get all payment schedules with member details
  const schedules = await getSchedulesWithMemberDetails(tenancyId, agencyId);

  // Enrich each schedule with payment calculations
  const enrichedSchedules = await Promise.all(schedules.map(s => enrichScheduleWithPayments(s, agencyId)));

  res.json({ payments: enrichedSchedules });
}, 'fetch payment schedules');

/**
 * Get payment schedule for current user (Tenant)
 */
exports.getMyPaymentSchedule = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const agencyId = req.agencyId;

  // Find the user's active tenancy and member ID
  const myMember = await paymentRepo.getUserActiveMembership(userId, agencyId);
  if (!myMember) {
    return res.status(404).json({ error: 'No active tenancy found' });
  }

  // Get payment schedules for this member
  const schedules = await getSchedulesForMember(myMember.tenancy_id, myMember.member_id, agencyId);

  // Enrich each schedule with payment calculations
  const enrichedSchedules = await Promise.all(schedules.map(s => enrichScheduleWithPayments(s, agencyId)));

  res.json({ payments: enrichedSchedules });
}, 'fetch payment schedule');

/**
 * Record a payment (Admin only)
 */
exports.recordPayment = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const { amount_paid, paid_date, payment_reference } = req.body;
  const agencyId = req.agencyId;

  // Validate inputs
  if (amount_paid === undefined || isNaN(amount_paid) || amount_paid === 0) {
    return res.status(400).json({ error: 'Payment amount cannot be zero' });
  }

  if (!paid_date) {
    return res.status(400).json({ error: 'Payment date is required' });
  }

  // Get schedule with tenancy status
  const schedule = await paymentRepo.getPaymentScheduleWithTenancy(paymentId, agencyId);
  if (!schedule) {
    return res.status(404).json({ error: 'Payment schedule not found' });
  }

  // Only allow recording payments for active tenancies
  if (schedule.tenancy_status !== 'active') {
    return res.status(400).json({ error: 'Payments can only be recorded for active tenancies' });
  }

  // Check that payment doesn't exceed remaining balance
  const { totalPaid } = await calculateScheduleStatus(paymentId, agencyId);
  const remainingBalance = schedule.amount_due - totalPaid;

  // For positive amounts (money owed TO landlord): payment can't exceed balance
  // For negative amounts (money owed TO tenant): payment can't be less than balance
  if (schedule.amount_due > 0 && amount_paid > remainingBalance) {
    return res.status(400).json({ error: `Payment amount (£${amount_paid.toFixed(2)}) exceeds remaining balance (£${remainingBalance.toFixed(2)})` });
  } else if (schedule.amount_due < 0 && amount_paid < remainingBalance) {
    return res.status(400).json({ error: `Refund amount (£${amount_paid.toFixed(2)}) exceeds remaining credit (£${Math.abs(remainingBalance).toFixed(2)})` });
  }

  // Insert payment record
  const createdPayment = await paymentRepo.createPayment({
    agencyId,
    paymentScheduleId: paymentId,
    amount: amount_paid,
    paymentDate: paid_date,
    paymentReference: payment_reference
  });

  // Get updated schedule with enriched data
  const enrichedSchedule = await enrichScheduleWithPayments(schedule, agencyId);

  res.json({
    payment: createdPayment,
    schedule: enrichedSchedule,
    message: 'Payment recorded successfully'
  });
}, 'record payment');

/**
 * Get payment statistics for a tenancy (Admin only)
 */
exports.getTenancyPaymentStats = asyncHandler(async (req, res) => {
  const { tenancyId } = req.params;
  const agencyId = req.agencyId;

  // Verify tenancy exists
  const tenancy = await paymentRepo.getTenancyById(tenancyId, agencyId);
  if (!tenancy) {
    return res.status(404).json({ error: 'Tenancy not found' });
  }

  // Get payment statistics
  const stats = await paymentRepo.getPaymentStats(tenancyId, agencyId);

  // Calculate total paid from all schedules
  const schedules = await paymentRepo.getPaymentScheduleIds(tenancyId, agencyId);

  let totalPaidSum = 0;
  for (const schedule of schedules) {
    const { totalPaid } = await calculateScheduleStatus(schedule.id, agencyId);
    totalPaidSum += totalPaid;
  }

  res.json({
    stats: {
      ...stats,
      total_paid: totalPaidSum,
      total_outstanding: stats.total_due - totalPaidSum
    }
  });
}, 'fetch payment statistics');

/**
 * Revert/Remove all payments for a schedule (Admin only)
 */
exports.revertPayment = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const agencyId = req.agencyId;

  // Verify schedule exists
  const schedule = await paymentRepo.getPaymentScheduleById(paymentId, agencyId);
  if (!schedule) {
    return res.status(404).json({ error: 'Payment schedule not found' });
  }

  // Delete all payment records for this schedule
  const deletedCount = await paymentRepo.deletePaymentsForSchedule(paymentId, agencyId);

  // Reset schedule status to pending
  const updatedSchedule = await paymentRepo.resetPaymentScheduleStatus(paymentId, agencyId);

  res.json({
    payment: updatedSchedule,
    paymentsDeleted: deletedCount,
    message: `Payment schedule reverted successfully. ${deletedCount} payment(s) removed.`
  });
}, 'revert payment');

/**
 * Update payment amount (Admin only)
 * Changes schedule_type to 'manual' if it was 'automated'
 */
exports.updatePaymentAmount = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const { amount_due, due_date, payment_type, description } = req.body;
  const agencyId = req.agencyId;

  if (!amount_due || amount_due <= 0) {
    return res.status(400).json({ error: 'Valid amount_due is required' });
  }

  if (!due_date) {
    return res.status(400).json({ error: 'Due date is required' });
  }

  if (!payment_type) {
    return res.status(400).json({ error: 'Payment type is required' });
  }

  // Validate payment_type
  const validPaymentTypes = ['rent', 'deposit', 'utilities', 'fees', 'other'];
  if (!validPaymentTypes.includes(payment_type)) {
    return res.status(400).json({ error: 'Invalid payment_type. Must be one of: rent, deposit, utilities, fees, other' });
  }

  if (!description || description.trim() === '') {
    return res.status(400).json({ error: 'Description is required' });
  }

  // Get existing payment schedule
  const payment = await paymentRepo.getPaymentScheduleById(paymentId, agencyId);
  if (!payment) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  // Determine new schedule_type
  const newScheduleType = payment.schedule_type === 'automated' ? 'manual' : payment.schedule_type;

  // Update payment schedule
  const updatedPayment = await paymentRepo.updatePaymentSchedule({
    scheduleId: paymentId,
    amountDue: amount_due,
    dueDate: due_date,
    paymentType: payment_type,
    description,
    scheduleType: newScheduleType,
    agencyId
  });

  res.json({
    payment: updatedPayment,
    message: 'Payment amount updated successfully'
  });
}, 'update payment amount');

/**
 * Delete payment schedule (Admin only)
 */
exports.deletePaymentSchedule = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const agencyId = req.agencyId;

  // Verify schedule exists
  const payment = await paymentRepo.getPaymentScheduleById(paymentId, agencyId);
  if (!payment) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  // Check if any payments have been made
  const { totalPaid } = await calculateScheduleStatus(paymentId, agencyId);
  if (totalPaid > 0) {
    return res.status(400).json({ error: 'Cannot delete a payment that has been paid. Please revert the payment first.' });
  }

  // Delete the payment schedule
  await paymentRepo.deletePaymentSchedule(paymentId, agencyId);

  res.json({ message: 'Payment schedule deleted successfully' });
}, 'delete payment schedule');

/**
 * Create manual payment schedule (Admin only)
 */
exports.createManualPayment = asyncHandler(async (req, res) => {
  const { tenancy_id, member_id, due_date, amount_due, payment_type, description } = req.body;
  const agencyId = req.agencyId;

  // Validate required fields
  if (!tenancy_id || !member_id || !due_date || amount_due === undefined || amount_due === null || !payment_type) {
    return res.status(400).json({ error: 'tenancy_id, member_id, due_date, amount_due, and payment_type are required' });
  }

  if (amount_due === 0) {
    return res.status(400).json({ error: 'amount_due cannot be zero' });
  }

  // Validate payment_type
  const validPaymentTypes = ['rent', 'deposit', 'utilities', 'fees', 'other'];
  if (!validPaymentTypes.includes(payment_type)) {
    return res.status(400).json({ error: 'Invalid payment_type. Must be one of: rent, deposit, utilities, fees, other' });
  }

  // Verify tenancy exists and is active
  const tenancy = await paymentRepo.getTenancyWithStatus(tenancy_id, agencyId);
  if (!tenancy) {
    return res.status(404).json({ error: 'Tenancy not found' });
  }

  // Only allow creating payment schedules for active tenancies
  if (tenancy.status !== 'active') {
    return res.status(400).json({ error: 'Payment schedules can only be created for active tenancies' });
  }

  // Verify member exists and belongs to tenancy
  const member = await paymentRepo.getMemberByTenancy(member_id, tenancy_id, agencyId);
  if (!member) {
    return res.status(404).json({ error: 'Tenancy member not found' });
  }

  // Create manual payment schedule
  const newPayment = await paymentRepo.createPaymentSchedule({
    agencyId,
    tenancyId: tenancy_id,
    memberId: member_id,
    paymentType: payment_type,
    description,
    dueDate: due_date,
    amountDue: amount_due
  });

  res.json({
    payment: newPayment,
    message: 'Manual payment schedule created successfully'
  });
}, 'create manual payment');

/**
 * Delete a single payment record (Admin only)
 */
exports.deleteSinglePayment = asyncHandler(async (req, res) => {
  const { paymentId, singlePaymentId } = req.params;
  const agencyId = req.agencyId;

  // Verify payment record exists
  const paymentRecord = await paymentRepo.getPaymentRecord(singlePaymentId, paymentId, agencyId);
  if (!paymentRecord) {
    return res.status(404).json({ error: 'Payment record not found' });
  }

  // Delete the payment
  await paymentRepo.deletePaymentRecord(singlePaymentId, agencyId);

  // Get schedule for enrichment
  const schedule = await paymentRepo.getPaymentScheduleById(paymentId, agencyId);

  // Enrich with updated payment data
  const enrichedSchedule = await enrichScheduleWithPayments(schedule, agencyId);

  res.json({
    schedule: enrichedSchedule,
    message: 'Payment deleted successfully'
  });
}, 'delete payment');

/**
 * Update a single payment record (Admin only)
 */
exports.updateSinglePayment = asyncHandler(async (req, res) => {
  const { paymentId, singlePaymentId } = req.params;
  const { amount, payment_date, payment_reference } = req.body;
  const agencyId = req.agencyId;

  // Validate inputs
  if (amount === undefined || isNaN(amount) || amount === 0) {
    return res.status(400).json({ error: 'Payment amount cannot be zero' });
  }

  if (!payment_date) {
    return res.status(400).json({ error: 'Payment date is required' });
  }

  // Verify payment record exists
  const paymentRecord = await paymentRepo.getPaymentRecord(singlePaymentId, paymentId, agencyId);
  if (!paymentRecord) {
    return res.status(404).json({ error: 'Payment record not found' });
  }

  // Get schedule
  const schedule = await paymentRepo.getPaymentScheduleById(paymentId, agencyId);
  if (!schedule) {
    return res.status(404).json({ error: 'Payment schedule not found' });
  }

  // Get total of other payments
  const otherPaymentsTotal = await paymentRepo.getOtherPaymentsTotal(paymentId, singlePaymentId, agencyId);
  const newTotalWithThisPayment = otherPaymentsTotal + amount;

  // Check that total doesn't exceed amount_due
  if (newTotalWithThisPayment > schedule.amount_due) {
    return res.status(400).json({ error: `Total payments (£${newTotalWithThisPayment.toFixed(2)}) would exceed amount due (£${schedule.amount_due.toFixed(2)})` });
  }

  // Update payment record
  const updatedPayment = await paymentRepo.updatePaymentRecord({
    paymentId: singlePaymentId,
    amount,
    paymentDate: payment_date,
    paymentReference: payment_reference,
    agencyId
  });

  // Enrich schedule with updated payment data
  const enrichedSchedule = await enrichScheduleWithPayments(schedule, agencyId);

  res.json({
    payment: updatedPayment,
    schedule: enrichedSchedule,
    message: 'Payment updated successfully'
  });
}, 'update payment');

/**
 * Get all payment schedules across all tenancies for payment calendar (Admin only)
 */
exports.getAllPaymentSchedules = asyncHandler(async (req, res) => {
  const { year, month, property_id, landlord_id, page = 1, limit = 100 } = req.query;
  const agencyId = req.agencyId;

  // Pagination setup (cap limit at 500 for performance)
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 100));
  const offset = (pageNum - 1) * limitNum;

  // Get filtered payment schedules with pagination
  const { schedules, total } = await paymentRepo.getPaymentSchedulesWithFilters({
    year: year ? parseInt(year) : null,
    month: month ? parseInt(month) : null,
    propertyId: property_id,
    landlordId: landlord_id,
    limit: limitNum,
    offset
  }, agencyId);

  // Enrich each schedule with payment calculations
  const enrichedSchedules = await Promise.all(schedules.map(s => enrichScheduleWithPayments(s, agencyId)));

  // Get all overdue payments
  const now = new Date();
  const allOverdueSchedules = await paymentRepo.getOverduePaymentSchedules(agencyId);
  const enrichedOverdueSchedules = await Promise.all(allOverdueSchedules.map(s => enrichScheduleWithPayments(s, agencyId)));

  // Filter to only unpaid/partial payments
  const overduePayments = enrichedOverdueSchedules.filter(s => s.status !== 'paid');

  // Count how many are from previous months (before start of current month)
  const overduePreviousMonths = overduePayments.filter(s => {
    const dueDate = new Date(s.due_date);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return dueDate < startOfMonth;
  });

  res.json({
    schedules: enrichedSchedules,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    },
    summary: {
      total: enrichedSchedules.length,
      overdue: overduePayments.length,
      overduePreviousMonths: overduePreviousMonths.length,
      overdueAmount: overduePayments.reduce((sum, s) => sum + (s.amount_due - (s.amount_paid || 0)), 0)
    }
  });
}, 'fetch payment schedules');
