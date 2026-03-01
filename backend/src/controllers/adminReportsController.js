const statementService = require('../services/statementService');
const PDFDocument = require('pdfkit');
const { getAgencyBranding } = require('../services/brandingService');
const asyncHandler = require('../utils/asyncHandler');

// ============================================
// Statement Endpoints (Admin)
// ============================================

/**
 * Get available statement periods (Admin)
 */
exports.getStatementPeriods = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const periods = await statementService.getAvailablePeriodsAdmin(agencyId);
  const landlords = await statementService.getAllLandlords(agencyId);
  res.json({ periods, landlords });
}, 'fetch statement periods');

/**
 * Get monthly statement (Admin)
 */
exports.getMonthlyStatement = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { year, month } = req.params;
  const { landlord_id } = req.query;

  if (!year || !month) {
    return res.status(400).json({ error: 'Year and month are required' });
  }

  const statement = await statementService.generateMonthlyStatementAdmin(
    year,
    month,
    landlord_id ? parseInt(landlord_id) : null,
    agencyId
  );
  res.json({ statement });
}, 'generate monthly statement');

/**
 * Get annual summary (Admin)
 */
exports.getAnnualSummary = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { year } = req.params;
  const { landlord_id } = req.query;

  if (!year) {
    return res.status(400).json({ error: 'Year is required' });
  }

  const summary = await statementService.generateAnnualSummaryAdmin(
    year,
    landlord_id ? parseInt(landlord_id) : null,
    agencyId
  );
  res.json({ summary });
}, 'generate annual summary');

/**
 * Download annual PDF (Admin)
 */
exports.downloadAnnualStatementPDF = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { year } = req.params;
  const { landlord_id } = req.query;

  if (!year) {
    return res.status(400).json({ error: 'Year is required' });
  }

  const summary = statementService.generateAnnualSummaryAdmin(
    year,
    landlord_id ? parseInt(landlord_id) : null
  );

  // Get branding
  const branding = await getAgencyBranding(agencyId);
  const brandName = branding.companyName || 'Letably';
  const brandColor = branding.primaryColor || '#CF722F';

  // Create PDF document
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 }
  });

  // Set response headers
  const filename = `Annual-Statement-${year}-All-Landlords.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  doc.pipe(res);

  // Helper function for formatting currency
  const formatCurrency = (amount) => `${amount.toFixed(2)}`;

  // Header
  doc.fontSize(20).fillColor(brandColor).text(brandName, { align: 'center' });
  doc.fontSize(10).fillColor('#666666').text('Admin Annual Statement', { align: 'center' });
  doc.moveDown(0.5);

  // Year
  doc.fontSize(16).fillColor('#333333').text(`${year} Annual Summary`, { align: 'center' });
  doc.fontSize(10).fillColor('#666666').text('All Landlords', { align: 'center' });
  doc.moveDown(1);

  // Annual Summary Section
  doc.fontSize(12).fillColor(brandColor).text('Annual Totals', { underline: true });
  doc.moveDown(0.5);

  const summaryY = doc.y;
  doc.fontSize(10).fillColor('#333333');

  doc.text('Total Rent Due:', 60, summaryY);
  doc.text(formatCurrency(summary.annual.totalDue), 180, summaryY);

  doc.text('Total Collected:', 60, summaryY + 18);
  doc.fillColor('#16a34a').text(formatCurrency(summary.annual.totalPaid), 180, summaryY + 18);

  doc.fillColor('#333333').text('Outstanding:', 60, summaryY + 36);
  doc.fillColor('#ca8a04').text(formatCurrency(summary.annual.totalOutstanding), 180, summaryY + 36);

  doc.fillColor('#333333').text('Collection Rate:', 320, summaryY);
  doc.fillColor('#2563eb').text(`${summary.annual.collectionRate}%`, 440, summaryY);

  doc.y = summaryY + 70;
  doc.moveDown(1.5);

  // Monthly Breakdown Table
  doc.fillColor('#CF722F').fontSize(12).text('Monthly Breakdown', { underline: true });
  doc.moveDown(0.5);

  const tableTop = doc.y;
  const colMonth = 60;
  const colDue = 180;
  const colCollected = 280;
  const colOutstanding = 380;
  const colPayments = 480;

  doc.fontSize(9).fillColor('#666666');
  doc.text('Month', colMonth, tableTop);
  doc.text('Due', colDue, tableTop);
  doc.text('Collected', colCollected, tableTop);
  doc.text('Outstanding', colOutstanding, tableTop);
  doc.text('Payments', colPayments, tableTop);

  doc.moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).stroke('#dddddd');

  let rowY = tableTop + 20;
  doc.fontSize(9);

  summary.monthly.forEach(month => {
    const outstanding = month.totalDue - month.totalPaid;
    const hasData = month.paymentCount > 0;

    doc.fillColor(hasData ? '#333333' : '#999999');
    doc.text(month.monthName, colMonth, rowY);
    doc.text(formatCurrency(month.totalDue), colDue, rowY);

    if (hasData) doc.fillColor('#16a34a');
    doc.text(formatCurrency(month.totalPaid), colCollected, rowY);

    doc.fillColor(outstanding > 0 ? '#ca8a04' : '#333333');
    doc.text(formatCurrency(outstanding > 0 ? outstanding : 0), colOutstanding, rowY);

    doc.fillColor('#333333');
    doc.text(`${month.paidCount}/${month.paymentCount}`, colPayments, rowY);

    rowY += 16;
  });

  // Totals row
  doc.moveTo(50, rowY).lineTo(545, rowY).stroke('#dddddd');
  rowY += 6;

  doc.fontSize(10).fillColor('#333333').font('Helvetica-Bold');
  doc.text('Total', colMonth, rowY);
  doc.text(formatCurrency(summary.annual.totalDue), colDue, rowY);
  doc.fillColor('#16a34a').text(formatCurrency(summary.annual.totalPaid), colCollected, rowY);
  doc.fillColor('#ca8a04').text(formatCurrency(summary.annual.totalOutstanding), colOutstanding, rowY);
  doc.fillColor('#333333').text(`${summary.annual.paidCount}/${summary.annual.paymentCount}`, colPayments, rowY);
  doc.font('Helvetica');

  // Footer
  doc.fontSize(8).fillColor('#999999');
  const footerY = doc.page.height - 40;
  doc.text(
    `Generated by ${brandName} on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}`,
    50, footerY, { align: 'center', width: 495 }
  );

  doc.end();
}, 'generate annual PDF');

// Note: Report endpoints are now handled by unified /api/reports
// See backend/src/routes/reports.js
