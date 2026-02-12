const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes require admin authentication
router.use(authenticateToken, requireAdmin);

// Get all users
router.get('/', usersController.getAllUsers);

// Lookup user by email (must be before /:id to avoid conflict)
router.get('/lookup', usersController.lookupByEmail);

// Get single user
router.get('/:id', usersController.getUserById);

// Update user
router.put('/:id', usersController.updateUser);

// Delete user
router.delete('/:id', usersController.deleteUser);

// Bulk delete users
router.post('/bulk-delete', usersController.bulkDeleteUsers);

module.exports = router;
