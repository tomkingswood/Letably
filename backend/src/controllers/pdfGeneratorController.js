/**
 * PDF Generator Controller
 *
 * Generates comprehensive PDF documents for completed applications
 * Includes all application data, timestamps, and embedded ID documents
 */

const db = require('../db');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const { decryptFile } = require('../utils/encryption');
const { formatDate: formatDateUtil, formatDateTime: formatDateTimeUtil } = require('../utils/dateFormatter');
const handleError = require('../utils/handleError');
const { parseJsonField } = require('../utils/parseJsonField');
const { hydrateApplication } = require('../helpers/formData');

const SECURE_DOCS_DIR = path.join(__dirname, '../../../secure-documents');
const APPLICANT_DOCS_DIR = path.join(SECURE_DOCS_DIR, 'applicants');
const GUARANTOR_DOCS_DIR = path.join(SECURE_DOCS_DIR, 'guarantors');
const LOGO_PATH = path.join(__dirname, '../../../frontend/public/logo.gif');

/**
 * Generate PDF for application
 * GET /api/applications/:id/generate-pdf
 * Requires admin authentication
 */
exports.generateApplicationPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const agencyId = req.agencyId;

    // Get complete application data
    // Defense-in-depth: explicit agency_id filtering
    const applicationResult = await db.query(`
      SELECT
        a.*,
        u.first_name || ' ' || u.last_name as applicant_name,
        u.email as applicant_email
      FROM applications a
      JOIN users u ON a.user_id = u.id
      WHERE a.id = $1 AND a.agency_id = $2
    `, [id, agencyId], agencyId);

    const application = hydrateApplication(applicationResult.rows[0]);

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Get ID documents
    // Defense-in-depth: explicit agency_id filtering via application
    const idDocumentsResult = await db.query(
      `SELECT * FROM id_documents
       WHERE application_id = $1
       AND application_id IN (SELECT id FROM applications WHERE agency_id = $2)`,
      [id, agencyId],
      agencyId
    );
    const idDocuments = idDocumentsResult.rows;

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Application_${id}_${application.applicant_name.replace(/\s+/g, '_')}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add Application ID header to first page
    addPageHeader(doc, id);

    // Add logo if exists
    try {
      await fs.access(LOGO_PATH);
      doc.image(LOGO_PATH, 50, 30, { width: 150 });
      doc.moveDown(3);
    } catch {
      // Logo doesn't exist, skip
      doc.moveDown(1);
    }

    // Title
    doc.fontSize(24).font('Helvetica-Bold').text('Tenancy Application', { align: 'center' });
    doc.moveDown(2);

    // Application Details Section
    addSection(doc, 'Application Details', measureSectionHeight(doc, 2), id);
    addField(doc, 'Application Type', application.application_type === 'student' ? 'Student' : 'Professional');
    addField(doc, 'Guarantor Required', application.guarantor_required ? 'Yes' : 'No');
    doc.moveDown();

    // Applicant Information Section
    const applicantFieldCount = 8 + (application.middle_name ? 1 : 0);
    addSection(doc, 'Applicant Information', measureSectionHeight(doc, applicantFieldCount), id);
    addField(doc, 'Full Name', application.applicant_name);
    addField(doc, 'Email', application.applicant_email);
    addField(doc, 'Title', application.title === 'Other' ? application.title_other : application.title);
    addField(doc, 'Date of Birth', formatDate(application.date_of_birth));
    addField(doc, 'First Name', application.first_name);
    if (application.middle_name) {
      addField(doc, 'Middle Name', application.middle_name);
    }
    addField(doc, 'Surname', application.surname);
    addField(doc, 'Phone', application.phone);
    addField(doc, 'ID Type', formatIdType(application.id_type));
    doc.moveDown();

    // Current Address Section
    const currentAddressLines = application.current_address ? application.current_address.split('\n').length : 2;
    addSection(doc, 'Current Address', measureSectionHeight(doc, 2, currentAddressLines), id);
    addField(doc, 'Residential Status', application.residential_status === 'Other' ? application.residential_status_other : application.residential_status);
    addField(doc, 'Period at Address', `${application.period_years} years, ${application.period_months} months`);
    addAddressField(doc, 'Address', application.current_address);
    doc.moveDown();

    // Landlord Information (if private tenant)
    if (application.residential_status === 'Private Tenant' && application.landlord_name) {
      const landlordAddressLines = application.landlord_address ? application.landlord_address.split('\n').length : 2;
      addSection(doc, 'Current Landlord Information', measureSectionHeight(doc, 3, landlordAddressLines), id);
      addField(doc, 'Name', application.landlord_name);
      addAddressField(doc, 'Address', application.landlord_address);
      addField(doc, 'Email', application.landlord_email);
      addField(doc, 'Phone', application.landlord_phone);
      doc.moveDown();
    }

    // Address History
    if (application.address_history && Array.isArray(application.address_history) && application.address_history.length > 0) {
      // Each address has: title line + 4 fields + spacing
      const addressHistoryHeight = measureSectionHeight(doc, application.address_history.length * 5, 0, application.address_history.length * 20);
      addSection(doc, 'Previous Address History', addressHistoryHeight, id);
      application.address_history.forEach((addr, index) => {
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
          .text(`Address ${index + 1}:`, 70);
        doc.fontSize(10).font('Helvetica');
        addField(doc, '  Status', addr.residential_status === 'Other' ? addr.residential_status_other : addr.residential_status);
        addField(doc, '  Period', `${addr.period_years} years, ${addr.period_months} months`);
        addField(doc, '  Address', addr.address);
        addField(doc, '  Postcode', addr.postcode);
        doc.moveDown(0.5);
      });
      doc.moveDown();
    }

    // Student-specific fields
    if (application.application_type === 'student') {
      addSection(doc, 'Student Information', measureSectionHeight(doc, 6), id);
      addField(doc, 'Payment Method', application.payment_method);
      addField(doc, 'Payment Plan', application.payment_plan);
      addField(doc, 'University', application.university);
      addField(doc, 'Year of Study', application.year_of_study);
      addField(doc, 'Course', application.course);
      addField(doc, 'Student Number', application.student_number);
      doc.moveDown();
    }

    // Professional-specific fields
    if (application.application_type === 'professional') {
      const companyAddressLines = application.company_address ? application.company_address.split('\n').length : 2;
      addSection(doc, 'Employment Information', measureSectionHeight(doc, 8, companyAddressLines), id);
      addField(doc, 'Employment Type', application.employment_type);
      addField(doc, 'Company Name', application.company_name);
      addField(doc, 'Employment Start Date', formatDate(application.employment_start_date));
      addField(doc, 'Contact Name', application.contact_name);
      addField(doc, 'Contact Job Title', application.contact_job_title);
      addField(doc, 'Contact Email', application.contact_email);
      addField(doc, 'Contact Phone', application.contact_phone);
      addAddressField(doc, 'Company Address', application.company_address);
      addField(doc, 'Company Postcode', application.company_postcode);
      doc.moveDown();
    }

    // Guarantor Information
    if (application.guarantor_required) {
      const guarantorAddressLines = application.guarantor_address ? application.guarantor_address.split('\n').length : 2;
      const guarantorFieldCount = 6 + (application.guarantor_id_type ? 1 : 0);
      addSection(doc, 'Guarantor Information', measureSectionHeight(doc, guarantorFieldCount, guarantorAddressLines), id);
      addField(doc, 'Guarantor Required', 'Yes');
      if (application.guarantor_name) {
        addField(doc, 'Full Name', application.guarantor_name);
        addField(doc, 'Date of Birth', formatDate(application.guarantor_dob));
        addField(doc, 'Relationship', application.guarantor_relationship);
        addField(doc, 'Email', application.guarantor_email);
        addField(doc, 'Phone', application.guarantor_phone);
        addAddressField(doc, 'Address', application.guarantor_address);
        if (application.guarantor_id_type) {
          addField(doc, 'ID Type', formatIdType(application.guarantor_id_type));
        }
      }
      doc.moveDown();
    }

    // Digital Signatures Section
    // Legal text (60) + applicant signature (50) + guarantor signature if present (50)
    const signaturesHeight = 60 + 50 + (application.guarantor_required && application.guarantor_completed_at ? 50 : 0);
    addSection(doc, 'Digital Signatures', measureSectionHeight(doc, 0, 0, signaturesHeight), id);

    doc.fontSize(10).font('Helvetica-Oblique').fillColor('#444444')
      .text('This document uses digital signatures with timestamps, which are legally binding under the UK Electronic Communications Act 2000.', {
        align: 'left',
        width: 495
      });
    doc.moveDown();

    // Applicant Signature
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('Applicant Signature:', 70);
    doc.fontSize(10).font('Helvetica');
    addField(doc, 'Signed by', application.declaration_name);
    addField(doc, 'Timestamp', formatDateTime(application.declaration_date));
    addField(doc, 'Agreement', 'Confirmed and agreed to declaration');
    doc.moveDown();

    // Guarantor Signature (if applicable)
    if (application.guarantor_required && application.guarantor_completed_at) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('Guarantor Signature:', 70);
      doc.fontSize(10).font('Helvetica');
      addField(doc, 'Signed by', application.guarantor_signature_name);
      addField(doc, 'Timestamp', formatDateTime(application.guarantor_completed_at));
      addField(doc, 'Agreement', 'Confirmed and agreed to guarantor declaration');
      doc.moveDown();
    }

    // ID Documents Section
    if (idDocuments.length > 0) {
      // Create new page for ID documents section
      doc.addPage();
      addPageHeader(doc, id);

      addSection(doc, 'Identity Documents', null, id);

      doc.fontSize(10).font('Helvetica').fillColor('#666666')
        .text('The following identity documents were securely uploaded and verified:', {
          align: 'left'
        });
      doc.moveDown();

      for (const idDoc of idDocuments) {
        try {
          const directory = idDoc.document_type === 'applicant_id' ? APPLICANT_DOCS_DIR : GUARANTOR_DOCS_DIR;
          const filePath = path.join(directory, path.basename(idDoc.file_path));

          // Read and decrypt file
          const encryptedData = await fs.readFile(filePath);
          const decryptedData = decryptFile(encryptedData);

          // Add document info
          doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
            .text(idDoc.document_type === 'applicant_id' ? 'Applicant ID Document' : 'Guarantor ID Document', 70);
          doc.fontSize(9).font('Helvetica').fillColor('#666666');
          addField(doc, 'Filename', idDoc.original_filename);
          addField(doc, 'Uploaded', formatDateTime(idDoc.uploaded_at));
          doc.moveDown(0.5);

          // Embed image if it's an image file
          if (idDoc.mime_type.startsWith('image/')) {
            try {
              let imageData = decryptedData;

              // PDFKit only supports JPEG and PNG - convert other formats
              if (idDoc.mime_type === 'image/gif' ||
                  idDoc.mime_type === 'image/webp' ||
                  idDoc.mime_type === 'image/bmp' ||
                  idDoc.mime_type === 'image/tiff') {
                // Convert to PNG using sharp
                imageData = await sharp(decryptedData).png().toBuffer();
              }

              doc.image(imageData, 70, doc.y, {
                fit: [500, 400],
                align: 'center'
              });
              doc.moveDown(2);
            } catch (imgError) {
              console.error('Error embedding image:', imgError.message);
              doc.fontSize(10).fillColor('#ff0000')
                .text(`Error: Could not embed image (${idDoc.mime_type})`, 70);
              doc.moveDown();
            }
          } else if (idDoc.mime_type === 'application/pdf') {
            doc.fontSize(10).fillColor('#666666')
              .text('[PDF document - cannot be embedded in generated PDF]', 70);
            doc.moveDown();
          }

          // Add page break if there's another document
          if (idDoc !== idDocuments[idDocuments.length - 1]) {
            doc.addPage();
            addPageHeader(doc, id);
          }
        } catch (error) {
          console.error('Error embedding ID document:', error);
          doc.fontSize(10).fillColor('#ff0000')
            .text(`Error: Could not load ${idDoc.document_type} document`, 70);
          doc.moveDown();
        }
      }
    }

    // Finalize PDF
    doc.end();

  } catch (err) {
    console.error('Generate PDF error:', err);
    if (!res.headersSent) {
      handleError(res, err, 'generate PDF');
    }
  }
};

// Helper functions

/**
 * Adds Application ID header to the top right of the current page
 * Note: This function positions the cursor at Y=80 after adding the header
 * to ensure proper page initialization for all PDF viewers (including Edge)
 */
function addPageHeader(doc, applicationId) {
  const pageWidth = 595; // A4 width in points
  const topMargin = 30;
  const rightMargin = 50;

  // Add Application ID at top right using absolute positioning
  const headerText = `Application ID: ${applicationId}`;
  doc.fontSize(8).font('Helvetica').fillColor('#666666');
  const textWidth = doc.widthOfString(headerText);
  const xPosition = pageWidth - rightMargin - textWidth;

  doc.text(headerText, xPosition, topMargin, {
    lineBreak: false,
    width: textWidth + 10
  });

  // Reset to default styles and position cursor for content
  // This ensures the page is properly initialized for all PDF viewers
  doc.fontSize(10).font('Helvetica').fillColor('#000000');
  doc.x = 50;
  doc.y = 80;
}

/**
 * Ensures there's enough space on the current page for a section
 * If not enough space, creates a new page with Application ID header
 */
function ensureSpaceForSection(doc, requiredSpace, applicationId) {
  const pageHeight = 842; // A4 height in points
  const bottomMargin = 50;
  const maxY = pageHeight - bottomMargin;

  // Check if we need a new page
  if (doc.y + requiredSpace > maxY) {
    // Create new page
    doc.addPage();

    // Add Application ID header to the new page (also sets cursor position)
    if (applicationId) {
      addPageHeader(doc, applicationId);
    } else {
      // If no application ID, still reset position
      doc.x = 50;
      doc.y = 80;
    }
  }
}

/**
 * Measures the actual height needed for a section using PDFKit's measurement
 * @param {PDFDocument} doc - The PDF document
 * @param {number} fieldCount - Number of fields in the section
 * @param {number} addressLines - Number of address lines (for address fields)
 * @param {number} extraHeight - Any additional height for special content
 * @returns {number} Measured height in points
 */
function measureSectionHeight(doc, fieldCount = 0, addressLines = 0, extraHeight = 0) {
  // Measure actual heights with sample content
  doc.fontSize(14).font('Helvetica-Bold');
  const sectionTitleHeight = doc.heightOfString('Section Title', { width: 495 });

  doc.fontSize(10).font('Helvetica-Bold');
  const fieldLabelHeight = doc.heightOfString('Label:', { width: 150 });

  doc.fontSize(10).font('Helvetica');
  const fieldValueHeight = doc.heightOfString('Sample value text', { width: 350 });

  const addressLineHeight = doc.heightOfString('Address line', { width: 450 });

  // Calculate total height
  const SECTION_HEADER = sectionTitleHeight + 30; // +30 for line and spacing (moveDown * 2 + line)
  const FIELD_HEIGHT = Math.max(fieldLabelHeight, fieldValueHeight) + 8; // +8 for moveDown(0.3)
  const ADDRESS_LINE_HEIGHT = addressLineHeight + 3;
  const MOVEDOWN_HEIGHT = 12; // Final moveDown at end of section

  return SECTION_HEADER +
         (fieldCount * FIELD_HEIGHT) +
         (addressLines * ADDRESS_LINE_HEIGHT) +
         extraHeight +
         MOVEDOWN_HEIGHT;
}

function addSection(doc, title, estimatedHeight = null, applicationId = null) {
  // Ensure there's space for the section
  if (estimatedHeight) {
    ensureSpaceForSection(doc, estimatedHeight, applicationId);
  }

  doc.fontSize(14).font('Helvetica-Bold').fillColor('#ff6b35')
    .text(title, 50);
  doc.moveDown(0.5);
  doc.strokeColor('#ff6b35').lineWidth(2)
    .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);
  doc.fillColor('#000000');
}

function addField(doc, label, value) {
  if (!value) return;

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333')
    .text(`${label}:`, 70, doc.y, { continued: true, width: 150 });

  doc.font('Helvetica').fillColor('#000000')
    .text(` ${value}`, { width: 350 });

  doc.moveDown(0.3);
}

function addAddressField(doc, label, address) {
  if (!address) return;

  // Split address by newlines
  const lines = address.split('\n').filter(line => line.trim());

  // Add the label on its own line
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333')
    .text(`${label}:`, 70, doc.y);

  doc.moveDown(0.3);

  // Add each line of the address, indented slightly
  doc.font('Helvetica').fillColor('#000000');
  lines.forEach((line) => {
    doc.text(line.trim(), 85, doc.y, { width: 450 });
  });

  doc.moveDown(0.3);
}

function formatIdType(idType) {
  if (!idType) return 'N/A';

  // Convert database format to user-friendly format
  const idTypeMap = {
    'passport': 'Passport',
    'driving_licence': 'Driving Licence',
    'national_id': 'National ID Card',
    'biometric_residence_permit': 'Biometric Residence Permit'
  };

  return idTypeMap[idType] || idType;
}

// Use centralized date formatting utilities with fallback for N/A
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  return formatDateUtil(dateString, 'short') || 'N/A';
}

function formatDateTime(dateString) {
  if (!dateString) return 'N/A';
  return formatDateTimeUtil(dateString) || 'N/A';
}
