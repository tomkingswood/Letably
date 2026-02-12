const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { loginLimiter, registerLimiter, passwordResetLimiter, setupTokenLimiter } = require('../middleware/rateLimit');

router.post('/register', registerLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.get('/me', authenticateToken, authController.getCurrentUser);

// Password reset routes
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, authController.resetPassword);

// Password setup routes (for admin-created accounts)
router.get('/setup/:token', setupTokenLimiter, authController.validateSetupToken);
router.post('/setup/:token', setupTokenLimiter, authController.setPasswordWithToken);

// Change password (for forced password change on login)
router.post('/change-password', authenticateToken, authController.changePassword);

// Update own account (for logged-in users)
router.put('/me', authenticateToken, authController.updateMyAccount);

// Admin user management routes (for migration)
router.post('/admin/users', authenticateToken, requireAdmin, authController.adminCreateUser);
router.get('/admin/users', authenticateToken, requireAdmin, authController.adminGetUsers);
router.get('/admin/users/:id', authenticateToken, requireAdmin, authController.adminGetUser);
router.put('/admin/users/:id', authenticateToken, requireAdmin, authController.adminUpdateUser);
router.post('/admin/users/:id/reset-password', authenticateToken, requireAdmin, authController.adminResetPassword);
router.delete('/admin/users/:id', authenticateToken, requireAdmin, authController.adminDeleteUser);

module.exports = router;
