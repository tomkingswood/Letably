const express = require('express');
const router = express.Router();
const multer = require('multer');
const idDocumentsController = require('../controllers/idDocumentsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Configure multer for memory storage (we'll encrypt before saving to disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Public guarantor routes (no authentication required)
router.post(
  '/guarantor/:token/upload-id',
  upload.single('id_document'),
  idDocumentsController.uploadGuarantorId
);

router.get(
  '/guarantor/:token/id-document',
  idDocumentsController.downloadGuarantorId
);

router.get(
  '/guarantor/:token/id-document/status',
  idDocumentsController.checkGuarantorIdDocumentStatus
);

router.delete(
  '/guarantor/:token/delete-id',
  idDocumentsController.deleteGuarantorId
);

// Authenticated applicant routes
router.post(
  '/:id/upload-id',
  authenticateToken,
  upload.single('id_document'),
  idDocumentsController.uploadApplicantId
);

router.get(
  '/:id/id-document',
  authenticateToken,
  idDocumentsController.downloadApplicantId
);

router.get(
  '/:id/id-document/status',
  authenticateToken,
  idDocumentsController.checkIdDocumentStatus
);

router.delete(
  '/:id/delete-id',
  authenticateToken,
  idDocumentsController.deleteApplicantId
);

module.exports = router;
