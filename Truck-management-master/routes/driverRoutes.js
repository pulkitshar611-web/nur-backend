/**
 * Driver Routes
 * All routes require driver authentication
 */

const express = require('express');
const router = express.Router();
const { authenticate, isDriver } = require('../middleware/auth');
const driverController = require('../controllers/driverController');
const multer = require('multer');
const path = require('path');

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'ticket-photo-' + uniqueSuffix + path.extname(file.originalname));
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
router.use(isDriver);

// Dashboard routes
router.get('/dashboard', driverController.getDashboard);

// Ticket routes
router.get('/tickets', driverController.getMyTickets);
router.post('/tickets', upload.single('photo'), driverController.createTicket);
router.get('/tickets/:id', driverController.getTicketById);

// Pay routes
router.get('/pay', driverController.getMyPay);
router.get('/pay/:month', driverController.getPayByMonth);

// Customer list (for dropdown in Add Ticket)
router.get('/customers', driverController.getCustomers);
router.get('/customers/available', driverController.getAllAvailableCustomers);
router.post('/customers', driverController.addNewCustomer); // Add new customer from keyboard
router.post('/customers/assign', driverController.addCustomer); // Assign existing customer to driver
router.delete('/customers/:customer_id', driverController.removeCustomer);

// Trucks list (for dropdown)
router.get('/trucks', driverController.getTrucks);
router.post('/trucks', driverController.addTruck);

// Equipment types list (for dropdown)
router.get('/equipment-types', driverController.getEquipmentTypes);

module.exports = router;

