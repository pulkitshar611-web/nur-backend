/**
 * Admin Routes
 * All routes require admin authentication
 */

const express = require('express');
const router = express.Router();
const { authenticate, isAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const masterDataController = require('../controllers/masterDataController');
const systemSettingsController = require('../controllers/systemSettingsController');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'photo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Apply authentication middleware to all routes
router.use(authenticate);
router.use(isAdmin);

// Driver management routes
router.get('/drivers', adminController.getAllDrivers);
router.post('/drivers', adminController.createDriver);
router.put('/drivers/:id', adminController.updateDriver);
router.delete('/drivers/:id', adminController.deleteDriver);

// Customer management routes
router.get('/customers', adminController.getAllCustomers);
router.post('/customers', adminController.createCustomer);
router.put('/customers/:id', adminController.updateCustomer);
router.delete('/customers/:id', adminController.deleteCustomer);

// Ticket management routes
router.get('/tickets', adminController.getAllTickets);
router.get('/tickets/:id', adminController.getTicketById);
router.put('/tickets/:id', adminController.updateTicket);
router.put('/tickets/:id/status', adminController.updateTicketStatus);

// Dashboard routes
router.get('/dashboard/stats', adminController.getDashboardStats);

// Invoice routes
router.get('/invoices/generate', adminController.generateInvoice);
router.get('/invoices/download/:customerId', adminController.downloadInvoice);
router.post('/invoices/send', adminController.sendInvoiceEmailHandler);

// Settlement routes
router.get('/settlements/generate', adminController.generateSettlement);
router.get('/settlements/download/:driverId', adminController.downloadSettlement);

// Data setup routes (default bill rates)
router.get('/settings/bill-rates', adminController.getBillRates);
router.put('/settings/bill-rates', adminController.updateBillRates);

// Truck management routes
router.get('/trucks', adminController.getAllTrucks);
router.post('/trucks', adminController.createTruck);
router.put('/trucks/:id', adminController.updateTruck);
router.delete('/trucks/:id', adminController.deleteTruck);

// Company management routes
router.get('/companies', adminController.getAllCompanies);
router.post('/companies', adminController.createCompany);
router.put('/companies/:id', adminController.updateCompany);
router.delete('/companies/:id', adminController.deleteCompany);

// Master Data Settings routes
router.get('/master/customers', masterDataController.getAllCustomerMaster);
router.post('/master/customers', masterDataController.createCustomerMaster);
router.delete('/master/customers/:id', masterDataController.deleteCustomerMaster);

router.get('/master/equipment-types', masterDataController.getAllEquipmentTypes);
router.post('/master/equipment-types', masterDataController.createEquipmentType);
router.delete('/master/equipment-types/:id', masterDataController.deleteEquipmentType);

router.get('/master/trucks', masterDataController.getAllTruckMaster);
router.post('/master/trucks', masterDataController.createTruckMaster);
router.delete('/master/trucks/:id', masterDataController.deleteTruckMaster);

// System Settings routes
router.get('/system-settings', systemSettingsController.getSystemSettings);
router.put('/system-settings', systemSettingsController.updateSystemSettings);

module.exports = router;

