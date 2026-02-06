/**
 * Driver Controller
 * Handles driver operations: dashboard, tickets, pay history
 */

const pool = require('../config/db');
const path = require('path');

/**
 * Get driver dashboard data
 */
const getDashboard = async (req, res) => {
  try {
    const driverId = req.user.driverId || req.user.id;

    // Get driver info
    const [drivers] = await pool.execute(
      'SELECT id, name, user_id_code FROM drivers WHERE (id = ? OR user_id = ?)',
      [driverId, req.user.id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const driver = drivers[0];
    const actualDriverId = driver.id;

    // Get current week dates
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Get weekly hours and pay
    const [weeklyStats] = await pool.execute(
      `SELECT 
        COALESCE(SUM(quantity), 0) as total_hours,
        COALESCE(SUM(total_pay), 0) as estimated_pay
       FROM tickets
       WHERE driver_id = ?
       AND date >= ? AND date <= ?
       AND status = 'Approved'`,
      [actualDriverId, startOfWeek.toISOString().split('T')[0], endOfWeek.toISOString().split('T')[0]]
    );

    // Get recent tickets (last 5)
    const [recentTickets] = await pool.execute(
      `SELECT 
        id, date, customer, quantity as hours, status, ticket_number
       FROM tickets
       WHERE driver_id = ?
       ORDER BY date DESC, created_at DESC
       LIMIT 5`,
      [actualDriverId]
    );

    return res.json({
      success: true,
      data: {
        driver: {
          id: driver.id,
          name: driver.name,
          user_id_code: driver.user_id_code
        },
        weeklySnapshot: {
          totalHours: parseFloat(weeklyStats[0].total_hours),
          estimatedPay: parseFloat(weeklyStats[0].estimated_pay)
        },
        recentTickets: recentTickets.map(ticket => ({
          ...ticket,
          hours: parseFloat(ticket.hours)
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching driver dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
};

/**
 * Get driver's tickets
 */
const getMyTickets = async (req, res) => {
  try {
    const driverId = req.user.driverId || req.user.id;

    // Get actual driver ID
    const [drivers] = await pool.execute(
      'SELECT id FROM drivers WHERE id = ? OR user_id = ?',
      [driverId, req.user.id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const actualDriverId = drivers[0].id;

    const [tickets] = await pool.execute(
      `SELECT 
        id, date, truck_number, customer, job_type, equipment_type, ticket_number, 
        quantity, photo_path, status, total_bill, total_pay, created_at
       FROM tickets
       WHERE driver_id = ?
       ORDER BY date DESC, created_at DESC`,
      [actualDriverId]
    );

    return res.json({
      success: true,
      data: tickets
    });
  } catch (error) {
    console.error('Error fetching driver tickets:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tickets',
      error: error.message
    });
  }
};

/**
 * Create a new ticket
 */
const createTicket = async (req, res) => {
  try {
    const driverId = req.user.driverId || req.user.id;

    // Get actual driver ID and default pay rate
    const [drivers] = await pool.execute(
      'SELECT id, default_pay_rate FROM drivers WHERE (id = ? OR user_id = ?)',
      [driverId, req.user.id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const driver = drivers[0];
    const actualDriverId = driver.id;

    const { date, truck_number, customer, equipment_type, ticket_number, quantity } = req.body;

    // Validate required fields
    if (!date || !truck_number || !customer || !equipment_type || !ticket_number || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Date, truck number, customer, equipment type, ticket number, and quantity are required'
      });
    }

    // Handle multiple customers (comma-separated)
    const customerNames = customer.split(',').map(name => name.trim()).filter(name => name.length > 0);
    
    if (customerNames.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one customer is required'
      });
    }

    // Get bill rates for all customers (company-scoped)
    const placeholders = customerNames.map(() => '?').join(',');
    const [customersData] = await pool.execute(
      `SELECT default_bill_rate FROM customers WHERE name IN (${placeholders})`,
      [...customerNames]
    );

    // Calculate average bill rate from all selected customers
    let billRate = 0;
    if (customersData.length > 0) {
      const totalBillRate = customersData.reduce((sum, c) => sum + (parseFloat(c.default_bill_rate) || 0), 0);
      billRate = totalBillRate / customersData.length;
    }

    const payRate = driver.default_pay_rate || 0;

    // Calculate totals
    const totalBill = parseFloat(quantity) * parseFloat(billRate);
    const totalPay = parseFloat(quantity) * parseFloat(payRate);

    // Store customer names as comma-separated string
    const customerString = customerNames.join(', ');

    // Handle photo upload
    let photoPath = null;
    if (req.file) {
      photoPath = `/uploads/${req.file.filename}`;
    }

    // Insert ticket
    const [result] = await pool.execute(
      `INSERT INTO tickets 
       (driver_id, date, truck_number, customer, equipment_type, ticket_number, quantity, photo_path, bill_rate, pay_rate, total_bill, total_pay, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [actualDriverId, date, truck_number, customerString, equipment_type, ticket_number, quantity, photoPath, billRate, payRate, totalBill, totalPay]
    );

    return res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: {
        id: result.insertId,
        ticket_number,
        status: 'Pending'
      }
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create ticket',
      error: error.message
    });
  }
};

/**
 * Get ticket by ID (driver's own tickets only)
 */
const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const driverId = req.user.driverId || req.user.id;

    // Get actual driver ID
    const [drivers] = await pool.execute(
      'SELECT id FROM drivers WHERE (id = ? OR user_id = ?)',
      [driverId, req.user.id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const actualDriverId = drivers[0].id;

    const [tickets] = await pool.execute(
      `SELECT * FROM tickets WHERE id = ? AND driver_id = ?`,
      [id, actualDriverId]
    );

    if (tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found or access denied'
      });
    }

    return res.json({
      success: true,
      data: tickets[0]
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch ticket',
      error: error.message
    });
  }
};

/**
 * Get driver's pay history
 */
const getMyPay = async (req, res) => {
  try {
    const driverId = req.user.driverId || req.user.id;
    const { month } = req.query; // Format: "2025-11" or "November 2025"

    // Get actual driver ID
    const [drivers] = await pool.execute(
      'SELECT id FROM drivers WHERE (id = ? OR user_id = ?)',
      [driverId, req.user.id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const actualDriverId = drivers[0].id;

    let query = `
      SELECT 
        date, customer, ticket_number, quantity as hours, total_pay as amount, status
      FROM tickets
      WHERE driver_id = ?
    `;
    const params = [actualDriverId];

    if (month) {
      // Parse month string like "November 2025" or "2025-11"
      let year, monthNum;
      if (month.includes('-')) {
        // Format: "2025-11"
        [year, monthNum] = month.split('-');
      } else {
        // Format: "November 2025"
        const [monthName, yearStr] = month.split(' ');
        year = yearStr;
        monthNum = new Date(`${monthName} 1, ${year}`).getMonth() + 1;
      }
      query += ` AND MONTH(date) = ? AND YEAR(date) = ?`;
      params.push(monthNum, year);
    }

    query += ` ORDER BY date DESC`;

    const [tickets] = await pool.execute(query, params);

    // Calculate totals
    const totalHours = tickets.reduce((sum, ticket) => sum + parseFloat(ticket.hours || 0), 0);
    const grossPay = tickets.reduce((sum, ticket) => sum + parseFloat(ticket.amount || 0), 0);
    
    // Determine status (all approved = "Up-to-date", otherwise "Pending")
    const allApproved = tickets.every(ticket => ticket.status === 'Approved');
    const status = allApproved ? 'Up-to-date' : 'Pending';

    return res.json({
      success: true,
      data: {
        summary: {
          totalHours,
          grossPay,
          status
        },
        tickets: tickets.map(ticket => ({
          ...ticket,
          hours: parseFloat(ticket.hours),
          amount: parseFloat(ticket.amount)
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching pay history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pay history',
      error: error.message
    });
  }
};

/**
 * Get pay by specific month
 */
const getPayByMonth = async (req, res) => {
  try {
    req.query.month = req.params.month;
    return getMyPay(req, res);
  } catch (error) {
    console.error('Error fetching pay by month:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pay by month',
      error: error.message
    });
  }
};

/**
 * Get customers list (for dropdown in Add Ticket)
 * Returns driver-specific customers if any, otherwise all customers
 */
const getCustomers = async (req, res) => {
  try {
    const driverId = req.user.driverId || req.user.id;

    // Get actual driver ID
    const [drivers] = await pool.execute(
      'SELECT id FROM drivers WHERE (id = ? OR user_id = ?)',
      [driverId, req.user.id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const actualDriverId = drivers[0].id;

    // Get driver-specific customers, or all customers if none assigned
    const [driverCustomers] = await pool.execute(
      `SELECT c.id, c.name 
       FROM customers c
       INNER JOIN driver_customers dc ON c.id = dc.customer_id
       WHERE dc.driver_id = ?
       ORDER BY c.name ASC`,
      [actualDriverId]
    );

    // If driver has specific customers, return those; otherwise return all
    if (driverCustomers.length > 0) {
      return res.json({
        success: true,
        data: driverCustomers
      });
    } else {
      // Return all customers if driver has no specific customers assigned
      const [allCustomers] = await pool.execute(
        'SELECT id, name FROM customers ORDER BY name ASC'
      );
      return res.json({
        success: true,
        data: allCustomers
      });
    }
  } catch (error) {
    console.error('Error fetching customers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      error: error.message
    });
  }
};

/**
 * Get all available customers (for driver to add to their list)
 */
const getAllAvailableCustomers = async (req, res) => {
  try {
    const driverId = req.user.driverId || req.user.id;

    // Get actual driver ID
    const [drivers] = await pool.execute(
      'SELECT id FROM drivers WHERE (id = ? OR user_id = ?)',
      [driverId, req.user.id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const actualDriverId = drivers[0].id;

    // Get all customers that are not already assigned to this driver
    const [customers] = await pool.execute(
      `SELECT c.id, c.name 
       FROM customers c
       WHERE c.id NOT IN (
         SELECT customer_id FROM driver_customers WHERE driver_id = ?
       )
       ORDER BY c.name ASC`,
      [actualDriverId]
    );

    return res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('Error fetching available customers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch available customers',
      error: error.message
    });
  }
};

/**
 * Add customer to driver's customer list
 */
const addCustomer = async (req, res) => {
  try {
    const driverId = req.user.driverId || req.user.id;
    const { customer_id } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID is required'
      });
    }

    // Get actual driver ID
    const [drivers] = await pool.execute(
      'SELECT id FROM drivers WHERE (id = ? OR user_id = ?)',
      [driverId, req.user.id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const actualDriverId = drivers[0].id;

    // Check if customer exists and belongs to company
    const [customers] = await pool.execute(
      'SELECT id FROM customers WHERE id = ?',
      [customer_id]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if already assigned
    const [existing] = await pool.execute(
      'SELECT id FROM driver_customers WHERE driver_id = ? AND customer_id = ?',
      [actualDriverId, customer_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer already added to your list'
      });
    }

    // Add customer to driver's list
    await pool.execute(
      'INSERT INTO driver_customers (driver_id, customer_id) VALUES (?, ?)',
      [actualDriverId, customer_id]
    );

    return res.json({
      success: true,
      message: 'Customer added successfully'
    });
  } catch (error) {
    console.error('Error adding customer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add customer',
      error: error.message
    });
  }
};

/**
 * Remove customer from driver's customer list
 */
const removeCustomer = async (req, res) => {
  try {
    const driverId = req.user.driverId || req.user.id;
    const { customer_id } = req.params;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID is required'
      });
    }

    // Get actual driver ID
    const [drivers] = await pool.execute(
      'SELECT id FROM drivers WHERE (id = ? OR user_id = ?)',
      [driverId, req.user.id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const actualDriverId = drivers[0].id;

    // Remove customer from driver's list
    const [result] = await pool.execute(
      'DELETE FROM driver_customers WHERE driver_id = ? AND customer_id = ?',
      [actualDriverId, customer_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found in your list'
      });
    }

    return res.json({
      success: true,
      message: 'Customer removed successfully'
    });
  } catch (error) {
    console.error('Error removing customer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove customer',
      error: error.message
    });
  }
};

/**
 * Get trucks list (for dropdown)
 */
/**
 * Get equipment types from master table (or return defaults if table doesn't exist)
 */
const getEquipmentTypes = async (req, res) => {
  try {
    // Try to get from equipment_type_master table
    let equipmentTypes;
    try {
      const [result] = await pool.execute(
        'SELECT id, equipment_name FROM equipment_type_master WHERE status = "Active" ORDER BY equipment_name ASC'
      );
      equipmentTypes = result;
    } catch (tableError) {
      // Table doesn't exist, return default equipment types
      console.log('equipment_type_master table not found, returning default equipment types');
      equipmentTypes = [
        { id: 1, equipment_name: 'Tandem' },
        { id: 2, equipment_name: 'Tri End Dump' },
        { id: 3, equipment_name: 'Livebottom' },
        { id: 4, equipment_name: 'Tri Pup' },
        { id: 5, equipment_name: 'Super B' },
        { id: 6, equipment_name: 'Quad' }
      ];
    }

    return res.json({
      success: true,
      data: equipmentTypes
    });
  } catch (error) {
    console.error('Error fetching equipment types:', error);
    // Return default equipment types as fallback
    return res.json({
      success: true,
      data: [
        { id: 1, equipment_name: 'Tandem' },
        { id: 2, equipment_name: 'Tri End Dump' },
        { id: 3, equipment_name: 'Livebottom' },
        { id: 4, equipment_name: 'Tri Pup' },
        { id: 5, equipment_name: 'Super B' },
        { id: 6, equipment_name: 'Quad' }
      ]
    });
  }
};

/**
 * Add new truck from keyboard (driver can add truck number)
 */
const addTruck = async (req, res) => {
  try {
    const { truck_number } = req.body;

    if (!truck_number || truck_number.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Truck number is required'
      });
    }

    // Check if truck already exists in trucks table
    const [existingTruck] = await pool.execute(
      'SELECT id FROM trucks WHERE truck_number = ?',
      [truck_number.trim()]
    );

    if (existingTruck.length > 0) {
      return res.json({
        success: true,
        message: 'Truck already exists',
        data: { id: existingTruck[0].id, truck_number: truck_number.trim() }
      });
    }

    // Try to add to truck_master table if it exists (optional)
    try {
      const [masterCheck] = await pool.execute(
        'SELECT id FROM truck_master WHERE truck_number = ?',
        [truck_number.trim()]
      );
      
      if (masterCheck.length === 0) {
        await pool.execute(
          'INSERT INTO truck_master (truck_number, status) VALUES (?, ?)',
          [truck_number.trim(), 'Active']
        );
      }
    } catch (masterError) {
      // truck_master table doesn't exist, that's okay - continue
      console.log('truck_master table not found, skipping master insert');
    }

    // Check if status column exists in trucks table
    const [columns] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'trucks' 
       AND COLUMN_NAME = 'status'`
    );
    
    const hasStatusColumn = columns.length > 0;
    
    // Add to trucks table (with or without status column)
    let result;
    if (hasStatusColumn) {
      [result] = await pool.execute(
        'INSERT INTO trucks (truck_number, status) VALUES (?, ?)',
        [truck_number.trim(), 'Active']
      );
    } else {
      [result] = await pool.execute(
        'INSERT INTO trucks (truck_number) VALUES (?)',
        [truck_number.trim()]
      );
    }

    return res.json({
      success: true,
      message: 'Truck added successfully',
      data: { id: result.insertId, truck_number: truck_number.trim() }
    });
  } catch (error) {
    console.error('Error adding truck:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add truck',
      error: error.message
    });
  }
};

/**
 * Add new customer from keyboard (driver can add customer)
 */
const addNewCustomer = async (req, res) => {
  try {
    const { customer_name } = req.body;

    if (!customer_name || customer_name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Customer name is required'
      });
    }

    // Check if customer exists in master table
    const [masterCustomer] = await pool.execute(
      'SELECT id FROM customer_master WHERE customer_name = ? AND status = "Active"',
      [customer_name.trim()]
    );

    let customerMasterId;
    if (masterCustomer.length > 0) {
      customerMasterId = masterCustomer[0].id;
    } else {
      // Add to master table first
      const [masterResult] = await pool.execute(
        'INSERT INTO customer_master (customer_name, billing_enabled, status) VALUES (?, ?, ?)',
        [customer_name.trim(), true, 'Active']
      );
      customerMasterId = masterResult.insertId;
    }

    // Add to company customers table if not exists
    const [companyCustomer] = await pool.execute(
      'SELECT id FROM customers WHERE name = ?',
      [customer_name.trim()]
    );

    let customerId;
    if (companyCustomer.length > 0) {
      customerId = companyCustomer[0].id;
    } else {
      const [result] = await pool.execute(
        'INSERT INTO customers (name, default_bill_rate, status) VALUES (?, ?, ?)',
        [customer_name.trim(), 0.00, 'Active']
      );
      customerId = result.insertId;
    }

    // Auto-assign to driver
    const driverId = req.user.driverId || req.user.id;
    const [drivers] = await pool.execute(
      'SELECT id FROM drivers WHERE (id = ? OR user_id = ?)',
      [driverId, req.user.id]
    );

    if (drivers.length > 0) {
      const actualDriverId = drivers[0].id;
      // Check if already assigned
      const [existing] = await pool.execute(
        'SELECT id FROM driver_customers WHERE driver_id = ? AND customer_id = ?',
        [actualDriverId, customerId]
      );

      if (existing.length === 0) {
        await pool.execute(
          'INSERT INTO driver_customers (driver_id, customer_id) VALUES (?, ?)',
          [actualDriverId, customerId]
        );
      }
    }

    return res.json({
      success: true,
      message: 'Customer added successfully',
      data: { id: customerId, name: customer_name.trim(), customer_name: customer_name.trim() }
    });
  } catch (error) {
    console.error('Error adding customer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add customer',
      error: error.message
    });
  }
};

const getTrucks = async (req, res) => {
  try {
    // Check if status column exists in trucks table
    let [columns] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'trucks' 
       AND COLUMN_NAME = 'status'`
    );
    
    const hasStatusColumn = columns.length > 0;
    
    // Build query based on whether status column exists
    let query;
    if (hasStatusColumn) {
      query = `SELECT DISTINCT id, truck_number 
               FROM trucks
               WHERE status = "Active"
               ORDER BY truck_number ASC`;
    } else {
      query = `SELECT DISTINCT id, truck_number 
               FROM trucks
               ORDER BY truck_number ASC`;
    }
    
    let [trucks] = await pool.execute(query);

    // If no trucks found in trucks table, try truck_master table (if it exists)
    if (trucks.length === 0) {
      try {
        const [masterTrucks] = await pool.execute(
          'SELECT id, truck_number FROM truck_master WHERE status = "Active" ORDER BY truck_number ASC'
        );
        if (masterTrucks.length > 0) {
          return res.json({
            success: true,
            data: masterTrucks
          });
        }
      } catch (masterError) {
        // truck_master table doesn't exist, that's okay - continue with empty array
        console.log('truck_master table not found, using trucks table only');
      }
    }

    return res.json({
      success: true,
      data: trucks || []
    });
  } catch (error) {
    console.error('Error fetching trucks:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch trucks',
      error: error.message
    });
  }
};

module.exports = {
  getDashboard,
  getMyTickets,
  createTicket,
  getTicketById,
  getMyPay,
  getPayByMonth,
  getCustomers,
  getAllAvailableCustomers,
  addCustomer,
  removeCustomer,
  getTrucks,
  addTruck,
  getEquipmentTypes,
  addNewCustomer
};

