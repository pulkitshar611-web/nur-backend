/**
 * Invoice Routes
 * All routes require admin authentication
 * /api/admin/invoices  &  /api/admin/payments
 */

const express = require('express');
const router = express.Router();
const { authenticate, isAdmin } = require('../middleware/auth');
const invoiceController = require('../controllers/invoiceController');

// Apply auth middleware
router.use(authenticate);
router.use(isAdmin);

// ── Invoice Stats ───────────────────────────────────────
router.get('/stats', invoiceController.getInvoiceStats);

// ── Uninvoiced tickets helper (for building invoice) ───
router.get('/uninvoiced-tickets', invoiceController.getUninvoicedTickets);

// ── Invoice CRUD ────────────────────────────────────────
router.get('/', invoiceController.getAllInvoices);
router.get('/:id', invoiceController.getInvoiceById);
router.post('/', invoiceController.createInvoice);
router.put('/:id', invoiceController.updateInvoice);
router.delete('/:id', invoiceController.deleteInvoice);

// ── Invoice Status ──────────────────────────────────────
router.put('/:id/status', invoiceController.updateInvoiceStatus);

// ── Invoice Line Items ──────────────────────────────────
router.post('/:id/items', invoiceController.addInvoiceItem);
router.delete('/:id/items/:itemId', invoiceController.deleteInvoiceItem);

module.exports = router;
