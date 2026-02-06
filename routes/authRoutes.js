/**
 * Authentication Routes
 * Handles login for both Admin and Driver
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/login - Login endpoint for Admin (email/password) or Driver (user_id_code/pin)
router.post('/login', authController.login);

module.exports = router;

