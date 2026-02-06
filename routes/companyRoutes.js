/**
 * Company Routes
 * All routes require company admin authentication
 */

const express = require('express');
const router = express.Router();
const { authenticate, isCompany } = require('../middleware/auth');
const companyController = require('../controllers/companyController');

// Apply authentication middleware to all routes
router.use(authenticate);
router.use(isCompany);

// Dashboard routes
router.get('/dashboard/stats', companyController.getDashboardStats);

// Customer management routes
router.get('/customers', companyController.getAllCustomers);
router.post('/customers', companyController.createCustomer);
router.put('/customers/:id', companyController.updateCustomer);
router.delete('/customers/:id', companyController.deleteCustomer);

// Driver management routes
router.get('/drivers', companyController.getAllDrivers);
router.post('/drivers', companyController.createDriver);
router.put('/drivers/:id', companyController.updateDriver);
router.delete('/drivers/:id', companyController.deleteDriver);

// Ticket management routes (view only)
router.get('/tickets', companyController.getAllTickets);

module.exports = router;

