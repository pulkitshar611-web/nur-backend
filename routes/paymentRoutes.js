/**
 * Payment Routes
 * All routes require admin authentication
 * /api/admin/payments
 */

const express = require('express');
const router = express.Router();
const { authenticate, isAdmin } = require('../middleware/auth');
const invoiceController = require('../controllers/invoiceController');

router.use(authenticate);
router.use(isAdmin);

// Payments CRUD
router.get('/', invoiceController.getAllPayments);
router.get('/:id', invoiceController.getPaymentById);
router.post('/', invoiceController.createPayment);
router.delete('/:id', invoiceController.deletePayment);

module.exports = router;
