/**
 * Letably API Server
 *
 * Multi-tenant property management SaaS backend.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const cron = require('node-cron');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Validate required environment variables
const requiredEnvVars = {
  'JWT_SECRET': { minLength: 32, description: 'JWT signing secret' },
  'DATABASE_URL': { description: 'PostgreSQL connection string' },
  'SUPER_JWT_SECRET': { minLength: 32, description: 'Super admin JWT secret' },
  'EMAIL_ENCRYPTION_KEY': { exactLength: 64, description: 'SMTP password encryption key (64 hex chars)' },
  'FILE_ENCRYPTION_KEY': { exactLength: 64, description: 'File encryption key (64 hex chars)' },
};

let hasErrors = false;
for (const [name, opts] of Object.entries(requiredEnvVars)) {
  const value = process.env[name];
  if (!value) {
    console.error(`ERROR: ${name} must be set (${opts.description})`);
    hasErrors = true;
  } else if (opts.minLength && value.length < opts.minLength) {
    console.error(`ERROR: ${name} must be at least ${opts.minLength} characters long`);
    hasErrors = true;
  } else if (opts.exactLength && value.length !== opts.exactLength) {
    console.error(`ERROR: ${name} must be exactly ${opts.exactLength} characters (got ${value.length})`);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('\nTo generate encryption keys, run:');
  console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - required when behind nginx reverse proxy
app.set('trust proxy', 1);

// Security Middleware
const isDevelopment = process.env.NODE_ENV !== 'production';
app.use(helmet({
  contentSecurityPolicy: isDevelopment ? false : {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS Middleware - allow multiple agency domains
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000'
];

// Parse additional allowed origins from environment
if (process.env.CORS_ALLOWED_ORIGINS) {
  process.env.CORS_ALLOWED_ORIGINS.split(',').forEach(origin => {
    allowedOrigins.push(origin.trim());
  });
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In development only, allow localhost origins
    if (isDevelopment && origin.includes('localhost')) {
      return callback(null, true);
    }

    // SECURITY: In production, reject unknown origins
    // TODO: Add database lookup for agency custom domains when implemented
    if (!isDevelopment) {
      console.warn(`CORS: Rejected request from origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'), false);
    }

    // Development fallback - allow but warn
    console.warn(`CORS: Allowing unknown origin in development: ${origin}`);
    callback(null, true);
  },
  credentials: true
}));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files - serve uploads with CORS headers
app.use('/uploads', (req, res, next) => {
  // SECURITY: Use same origin validation as main CORS
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || (isDevelopment && origin.includes('localhost')))) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (isDevelopment) {
    // Development only: allow for testing
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  // No Access-Control-Allow-Origin header in production for unknown origins
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '../uploads')));

// Import routes
const authRoutes = require('./routes/auth');
const agenciesRoutes = require('./routes/agencies');
const superRoutes = require('./routes/super');
const propertiesRoutes = require('./routes/properties');
const bedroomsRoutes = require('./routes/bedrooms');
const imagesRoutes = require('./routes/images');
const landlordsRoutes = require('./routes/landlords');
const usersRoutes = require('./routes/users');
const settingsRoutes = require('./routes/settings');
const viewingRequestsRoutes = require('./routes/viewingRequests');
const applicationsRoutes = require('./routes/applications');
const tenanciesRoutes = require('./routes/tenancies');
const paymentsRoutes = require('./routes/payments');
const maintenanceRoutes = require('./routes/maintenance');
const agreementSectionsRoutes = require('./routes/agreementSections');
const certificateTypesRoutes = require('./routes/certificateTypes');
const certificatesRoutes = require('./routes/certificates');
const tenantDocumentsRoutes = require('./routes/tenantDocuments');
const remindersRoutes = require('./routes/reminders');
const smtpRoutes = require('./routes/smtp');
const emailQueueRoutes = require('./routes/emailQueue');
const guarantorRoutes = require('./routes/guarantor');
const landlordPanelRoutes = require('./routes/landlordPanel');
const reportsRoutes = require('./routes/reports');
const adminReportsRoutes = require('./routes/adminReports');
const tenancyCommunicationRoutes = require('./routes/tenancyCommunication');
const idDocumentsRoutes = require('./routes/idDocuments');
const dataExportRoutes = require('./routes/dataExport');
const holdingDepositsRoutes = require('./routes/holdingDeposits');

// Health check (no auth required)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Letably API is running',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/agencies', agenciesRoutes);

// Super Admin Routes (Letably staff only)
app.use('/api/super', superRoutes);

// Property management routes
app.use('/api/properties', propertiesRoutes);
app.use('/api/bedrooms', bedroomsRoutes);
app.use('/api/images', imagesRoutes);
app.use('/api/landlords', landlordsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/viewing-requests', viewingRequestsRoutes);

// Applications and tenancies
app.use('/api/applications', applicationsRoutes);
app.use('/api/applications', idDocumentsRoutes);  // ID document upload/download for applications
app.use('/api/tenancies', tenanciesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/maintenance', maintenanceRoutes);

// Documents and certificates
app.use('/api/agreement-sections', agreementSectionsRoutes);
app.use('/api/certificate-types', certificateTypesRoutes);
app.use('/api/certificates', certificatesRoutes);
app.use('/api/tenant-documents', tenantDocumentsRoutes);

// Admin tools
app.use('/api/reminders', remindersRoutes);
app.use('/api/smtp', smtpRoutes);
app.use('/api/email-queue', emailQueueRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminReportsRoutes);
app.use('/api/data-export', dataExportRoutes);
app.use('/api/holding-deposits', holdingDepositsRoutes);

// Public/external
app.use('/api/guarantor', guarantorRoutes);
app.use('/api/landlord-panel', landlordPanelRoutes);
app.use('/api/tenancy-communication', tenancyCommunicationRoutes);

// 404 handler - must be placed after all routes
app.use(notFoundHandler);

// Centralized error handler - must be last middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Import services for scheduled jobs
const { processQueue: processExportQueue, cleanupOldExports } = require('./services/dataExportService');
const holdingDepositRepo = require('./repositories/holdingDepositRepository');

// Start server
app.listen(PORT, () => {
  console.log(`\n=== Letably API Server ===`);
  console.log(`Port: ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log(`\nReady for connections.\n`);

  // Initialize scheduled jobs

  // Process data export queue every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    try {
      const results = await processExportQueue(3);
      if (results.length > 0) {
        console.log(`[Data Export] Processed ${results.length} export jobs`);
      }
    } catch (error) {
      console.error('[Data Export] Queue processing error:', error);
    }
  });

  // Cleanup old export files daily at 3 AM
  cron.schedule('0 3 * * *', async () => {
    try {
      const deleted = await cleanupOldExports(7);
      if (deleted > 0) {
        console.log(`[Data Export] Cleaned up ${deleted} old export files`);
      }
    } catch (error) {
      console.error('[Data Export] Cleanup error:', error);
    }
  });

  // Release expired holding deposit reservations daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      // Query all agencies and release expired reservations for each
      const agenciesResult = await require('./db').systemQuery('SELECT id FROM agencies');
      let totalReleased = 0;
      for (const agency of agenciesResult.rows) {
        const released = await holdingDepositRepo.releaseExpiredReservations(agency.id);
        totalReleased += released;
      }
      if (totalReleased > 0) {
        console.log(`[Holding Deposits] Released ${totalReleased} expired reservations`);
      }
    } catch (error) {
      console.error('[Holding Deposits] Reservation release error:', error);
    }
  });

  console.log('[Scheduled Jobs] Data export queue processor started');
  console.log('[Scheduled Jobs] Holding deposit reservation release started');

  // TODO: Initialize additional scheduled jobs
  // - Email queue processor
  // - Payment reminder service
  // - Certificate expiry checker
  // - Overdue payment updater
});

module.exports = app;
