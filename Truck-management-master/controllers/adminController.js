/**
 * Admin Controller
 * Handles all admin operations: drivers, customers, tickets, invoices, settlements, dashboard
 */

const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { sendInvoiceEmail } = require('../utils/emailService');

/**
 * Helper function to ensure customer columns exist
 * Automatically adds missing columns if they don't exist
 */
const ensureCustomerColumns = async () => {
  try {
    const columnsToAdd = [
      { name: 'contact_person', sql: 'ALTER TABLE customers ADD COLUMN contact_person VARCHAR(255) NULL AFTER name' },
      { name: 'phone', sql: 'ALTER TABLE customers ADD COLUMN phone VARCHAR(20) NULL AFTER contact_person' },
      { name: 'email', sql: 'ALTER TABLE customers ADD COLUMN email VARCHAR(255) NULL AFTER phone' },
      { name: 'gst_number', sql: 'ALTER TABLE customers ADD COLUMN gst_number VARCHAR(50) NULL AFTER email' },
      { name: 'billing_enabled', sql: 'ALTER TABLE customers ADD COLUMN billing_enabled BOOLEAN DEFAULT TRUE AFTER gst_number' },
      { name: 'status', sql: 'ALTER TABLE customers ADD COLUMN status ENUM(\'Active\', \'Inactive\') DEFAULT \'Active\' AFTER billing_enabled' }
    ];

    const [columns] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'customers'`
    );
    const existingColumns = columns.map(col => col.COLUMN_NAME);

    for (const col of columnsToAdd) {
      if (!existingColumns.includes(col.name)) {
        try {
          await pool.execute(col.sql);
          console.log(`✅ Added missing column: customers.${col.name}`);
          
          // Set default values for new columns
          if (col.name === 'billing_enabled') {
            await pool.execute('UPDATE customers SET billing_enabled = TRUE WHERE billing_enabled IS NULL');
          } else if (col.name === 'status') {
            await pool.execute('UPDATE customers SET status = \'Active\' WHERE status IS NULL');
          } else if (col.name === 'contact_person') {
            await pool.execute('UPDATE customers SET contact_person = name WHERE contact_person IS NULL');
          }
        } catch (err) {
          console.error(`Error adding column ${col.name}:`, err.message);
        }
      }
    }
  } catch (error) {
    console.error('Error ensuring customer columns:', error.message);
  }
};

/**
 * Helper function to ensure tickets table has subcontractor column
 * Automatically adds missing column if it doesn't exist
 */
const ensureTicketColumns = async () => {
  try {
    const [columns] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'tickets'`
    );
    const existingColumns = columns.map(col => col.COLUMN_NAME);

    // Add subcontractor column if it doesn't exist
    if (!existingColumns.includes('subcontractor')) {
      try {
        await pool.execute('ALTER TABLE tickets ADD COLUMN subcontractor VARCHAR(255) NULL AFTER driver_id');
        console.log('✅ Added missing column: tickets.subcontractor');
      } catch (err) {
        console.error('Error adding subcontractor column:', err.message);
      }
    }
  } catch (error) {
    console.error('Error ensuring ticket columns:', error.message);
  }
};
/**
 * Get all drivers
 */
const getAllDrivers = async (req, res) => {
  try {
    const [drivers] = await pool.execute(
      `SELECT d.id, d.user_id, d.user_id_code, d.name, d.phone, d.default_pay_rate, u.email, u.created_at
       FROM drivers d
       JOIN users u ON d.user_id = u.id
       ORDER BY d.created_at DESC`
    );

    return res.json({
      success: true,
      data: drivers
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch drivers',
      error: error.message
    });
  }
};

/**
 * Create a new driver
 */
const createDriver = async (req, res) => {
  try {
    const { user_id_code, name, phone, default_pay_rate, pin } = req.body;

    // Validate required fields
    if (!user_id_code || !name || !default_pay_rate || !pin) {
      return res.status(400).json({
        success: false,
        message: 'User ID code, name, default pay rate, and PIN are required'
      });
    }

    // Validate PIN is 4 digits
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be exactly 4 digits'
      });
    }

    // Check if user_id_code already exists
    const [existing] = await pool.execute(
      'SELECT id FROM drivers WHERE user_id_code = ?',
      [user_id_code]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User ID code already exists'
      });
    }

    // Hash PIN
    const hashedPin = await bcrypt.hash(pin, 10);

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Check which columns exist in users table
      const [userColumns] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'users'`
      );
      const userExistingColumns = userColumns.map(col => col.COLUMN_NAME);
      
      // Check which columns exist in drivers table
      const [driverColumns] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'drivers'`
      );
      const driverExistingColumns = driverColumns.map(col => col.COLUMN_NAME);

      // Build user INSERT query dynamically
      const userInsertCols = ['email', 'password', 'role'];
      const userInsertVals = [`driver_${user_id_code}@trucking.com`, hashedPin, 'driver'];
      
      if (userExistingColumns.includes('company_id')) {
        userInsertCols.push('company_id');
        userInsertVals.push(1); // Default company_id if column exists
      }

      // Create user account for driver
      const [userResult] = await connection.execute(
        `INSERT INTO users (${userInsertCols.join(', ')}) VALUES (${userInsertVals.map(() => '?').join(', ')})`,
        userInsertVals
      );

      const userId = userResult.insertId;

      // Build driver INSERT query dynamically
      const driverInsertCols = ['user_id', 'user_id_code', 'name', 'phone', 'default_pay_rate', 'pin'];
      const driverInsertVals = [userId, user_id_code, name, phone || null, default_pay_rate, hashedPin];
      
      if (driverExistingColumns.includes('company_id')) {
        driverInsertCols.splice(1, 0, 'company_id'); // Insert after user_id
        driverInsertVals.splice(1, 0, 1); // Default company_id if column exists
      }

      // Create driver record
      await connection.execute(
        `INSERT INTO drivers (${driverInsertCols.join(', ')}) VALUES (${driverInsertVals.map(() => '?').join(', ')})`,
        driverInsertVals
      );

      await connection.commit();

      return res.status(201).json({
        success: true,
        message: 'Driver created successfully'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating driver:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create driver',
      error: error.message
    });
  }
};

/**
 * Update a driver
 */
const updateDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id_code, name, phone, default_pay_rate, pin } = req.body;

    // Check if driver exists
    const [drivers] = await pool.execute(
      'SELECT id, user_id FROM drivers WHERE id = ?',
      [id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const updates = [];
    const values = [];

    if (user_id_code) {
      // Check if user_id_code already exists for another driver
      const [existing] = await pool.execute(
        'SELECT id FROM drivers WHERE user_id_code = ? AND id != ?',
        [user_id_code, id]
      );
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'User ID code already exists'
        });
      }
      updates.push('user_id_code = ?');
      values.push(user_id_code);
    }

    if (name) {
      updates.push('name = ?');
      values.push(name);
    }

    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone || null);
    }

    if (default_pay_rate !== undefined) {
      updates.push('default_pay_rate = ?');
      values.push(default_pay_rate);
    }

    if (pin) {
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({
          success: false,
          message: 'PIN must be exactly 4 digits'
        });
      }
      const hashedPin = await bcrypt.hash(pin, 10);
      updates.push('pin = ?');
      values.push(hashedPin);
      
      // Also update user password
      await pool.execute(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPin, drivers[0].user_id]
      );
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(id);
    await pool.execute(
      `UPDATE drivers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    return res.json({
      success: true,
      message: 'Driver updated successfully'
    });
  } catch (error) {
    console.error('Error updating driver:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update driver',
      error: error.message
    });
  }
};

/**
 * Delete a driver
 */
const deleteDriver = async (req, res) => {
  try {
    const { id } = req.params;

    // Get driver info
    const [drivers] = await pool.execute(
      'SELECT user_id FROM drivers WHERE id = ?',
      [id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const userId = drivers[0].user_id;

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Delete driver
      await connection.execute('DELETE FROM drivers WHERE id = ?', [id]);
      
      // Delete user account
      await connection.execute('DELETE FROM users WHERE id = ?', [userId]);

      await connection.commit();

      return res.json({
        success: true,
        message: 'Driver deleted successfully'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error deleting driver:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete driver',
      error: error.message
    });
  }
};

/**
 * Get all customers
 */
const getAllCustomers = async (req, res) => {
  try {
    // AUTO-FIX: Ensure all required columns exist
    await ensureCustomerColumns();
    
    const [customers] = await pool.execute(
      'SELECT * FROM customers ORDER BY name ASC'
    );

    return res.json({
      success: true,
      data: customers
    });
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
 * Create a new customer
 */
const createCustomer = async (req, res) => {
  try {
    // AUTO-FIX: Ensure all required columns exist
    await ensureCustomerColumns();
    
    const { name, contact_person, phone, email, gst_number, billing_enabled, status, default_bill_rate } = req.body;

    if (!name || !contact_person || !phone || !email || default_bill_rate === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name, contact person, phone, email, and default bill rate are required'
      });
    }

    // Check which columns exist
    const [columns] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'customers'`
    );
    const existingColumns = columns.map(col => col.COLUMN_NAME);

    // Build dynamic INSERT query
    const insertCols = ['name', 'contact_person', 'phone', 'email'];
    const insertVals = [name, contact_person, phone, email];
    
    if (existingColumns.includes('gst_number')) {
      insertCols.push('gst_number');
      insertVals.push(gst_number || null);
    }
    
    insertCols.push('billing_enabled', 'status', 'default_bill_rate');
    insertVals.push(
      billing_enabled !== undefined ? billing_enabled : true,
      status || 'Active',
      default_bill_rate
    );

    const [result] = await pool.execute(
      `INSERT INTO customers (${insertCols.join(', ')}) 
       VALUES (${insertVals.map(() => '?').join(', ')})`,
      insertVals
    );

    return res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: { 
        id: result.insertId, 
        name, 
        contact_person, 
        phone, 
        email,
        gst_number: gst_number || null,
        billing_enabled: billing_enabled !== undefined ? billing_enabled : true,
        status: status || 'Active',
        default_bill_rate 
      }
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create customer',
      error: error.message
    });
  }
};

/**
 * Update a customer
 */
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_person, phone, email, gst_number, billing_enabled, status, default_bill_rate } = req.body;
    
    // AUTO-FIX: Ensure all required columns exist FIRST
    await ensureCustomerColumns();
    
    // Verify customer exists
    const [existing] = await pool.execute(
      'SELECT id FROM customers WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check which columns exist
    const [columns] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'customers'`
    );
    const existingColumns = columns.map(col => col.COLUMN_NAME);

    // Build update query dynamically - only include fields that are provided
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (contact_person !== undefined) {
      updates.push('contact_person = ?');
      values.push(contact_person);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (gst_number !== undefined && existingColumns.includes('gst_number')) {
      updates.push('gst_number = ?');
      values.push(gst_number || null);
    }
    if (billing_enabled !== undefined) {
      updates.push('billing_enabled = ?');
      values.push(billing_enabled ? 1 : 0);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (default_bill_rate !== undefined) {
      updates.push('default_bill_rate = ?');
      values.push(default_bill_rate);
    }

    // Must have at least one field to update
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields provided to update'
      });
    }

    // Add updated_at and id
    updates.push('updated_at = NOW()');
    values.push(id);
    
    // Execute update
    await pool.execute(
      `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return res.json({
      success: true,
      message: 'Customer updated successfully'
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    // If column doesn't exist error, try to add it and retry
    if (error.message.includes('Unknown column')) {
      try {
        await ensureCustomerColumns();
        // Retry the update
        return updateCustomer(req, res);
      } catch (retryError) {
        return res.status(500).json({
          success: false,
          message: 'Failed to update customer. Please run ADD_CUSTOMER_COLUMNS.sql migration.',
          error: error.message
        });
      }
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update customer',
      error: error.message
    });
  }
};

/**
 * Delete a customer
 */
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM customers WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete customer',
      error: error.message
    });
  }
};

/**
 * Get all tickets with filters
 */
const getAllTickets = async (req, res) => {
  try {
    const { month, customer, driver, status, search } = req.query;
    let query = `
      SELECT t.*, d.name as driver_name, d.user_id_code, c.name as customer_name
      FROM tickets t
      LEFT JOIN drivers d ON t.driver_id = d.id
      LEFT JOIN customers c ON t.customer = c.name
      WHERE 1=1
    `;
    const params = [];

    if (month && month.trim() !== '') {
      let monthNum, year;
      
      // Handle different month formats
      if (month.includes('-')) {
        // Format: "2025-11" (YYYY-MM)
        const parts = month.split('-');
        if (parts.length === 2 && parts[0] && parts[1]) {
          year = parseInt(parts[0], 10);
          monthNum = parseInt(parts[1], 10);
        }
      } else {
        // Format: "Nov 2025" or "November 2025"
        const parts = month.split(' ');
        if (parts.length >= 2 && parts[0] && parts[parts.length - 1]) {
          const monthName = parts[0];
          year = parseInt(parts[parts.length - 1], 10);
          const dateObj = new Date(`${monthName} 1, ${year}`);
          if (!isNaN(dateObj.getTime())) {
            monthNum = dateObj.getMonth() + 1;
          }
        }
      }
      
      // Only add to query if we have valid month and year
      if (monthNum && year && !isNaN(monthNum) && !isNaN(year) && monthNum >= 1 && monthNum <= 12) {
        query += ` AND MONTH(t.date) = ? AND YEAR(t.date) = ?`;
        params.push(monthNum, year);
      }
    }

    if (customer && customer !== 'All' && customer.trim() !== '') {
      query += ` AND t.customer = ?`;
      params.push(customer);
    }

    if (driver && driver !== 'All' && driver.trim() !== '') {
      query += ` AND d.name = ?`;
      params.push(driver);
    }

    if (status && status.trim() !== '') {
      query += ` AND t.status = ?`;
      params.push(status);
    }

    if (search && search.trim() !== '') {
      query += ` AND t.ticket_number LIKE ?`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY t.date DESC, t.created_at DESC`;

    // Validate params - ensure no undefined values
    const validParams = params.filter(param => param !== undefined && param !== null);
    if (validParams.length !== params.length) {
      console.error('[getAllTickets] Invalid parameters detected:', { params, validParams });
      return res.status(400).json({
        success: false,
        message: 'Invalid filter parameters provided',
        error: 'Some filter parameters contain invalid values'
      });
    }

    console.log('[getAllTickets] Executing query with params:', { query, params: validParams });
    const [tickets] = await pool.execute(query, validParams);

    return res.json({
      success: true,
      data: tickets
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tickets',
      error: error.message
    });
  }
};

/**
 * Get ticket by ID
 */
const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;

    const [tickets] = await pool.execute(
      `SELECT t.*, d.name as driver_name, d.user_id_code, c.name as customer_name
       FROM tickets t
       LEFT JOIN drivers d ON t.driver_id = d.id
       LEFT JOIN customers c ON t.customer = c.name
       WHERE t.id = ?`,
      [id]
    );

    if (tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
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
 * Update ticket
 */
const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { bill_rate, pay_rate, status, quantity } = req.body;

    const updates = [];
    const values = [];

    if (bill_rate !== undefined) {
      updates.push('bill_rate = ?');
      values.push(bill_rate);
    }

    if (pay_rate !== undefined) {
      updates.push('pay_rate = ?');
      values.push(pay_rate);
    }

    if (status) {
      updates.push('status = ?');
      values.push(status);
    }

    if (quantity !== undefined) {
      updates.push('quantity = ?');
      values.push(quantity);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    // Get current ticket to recalculate totals
    const [tickets] = await pool.execute(
      'SELECT quantity, bill_rate, pay_rate FROM tickets WHERE id = ?',
      [id]
    );

    if (tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    const currentTicket = tickets[0];
    const finalQty = quantity !== undefined ? quantity : currentTicket.quantity;
    const finalBillRate = bill_rate !== undefined ? bill_rate : currentTicket.bill_rate;
    const finalPayRate = pay_rate !== undefined ? pay_rate : currentTicket.pay_rate;

    // Calculate totals
    updates.push('total_bill = ?');
    values.push(finalQty * finalBillRate);
    
    updates.push('total_pay = ?');
    values.push(finalQty * finalPayRate);

    values.push(id);
    await pool.execute(
      `UPDATE tickets SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    return res.json({
      success: true,
      message: 'Ticket updated successfully'
    });
  } catch (error) {
    console.error('Error updating ticket:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update ticket',
      error: error.message
    });
  }
};

/**
 * Update ticket status
 */
const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['Pending', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (Pending, Approved, or Rejected)'
      });
    }

    await pool.execute(
      'UPDATE tickets SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );

    return res.json({
      success: true,
      message: 'Ticket status updated successfully'
    });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update ticket status',
      error: error.message
    });
  }
};

/**
 * Get dashboard statistics
 */
const getDashboardStats = async (req, res) => {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Unbilled tickets (Pending status)
    const [unbilledResult] = await pool.execute(
      'SELECT COUNT(*) as count FROM tickets WHERE status = ?',
      ['Pending']
    );
    const unbilledTickets = unbilledResult[0].count;

    // Revenue this month (total_bill from approved tickets)
    const [revenueResult] = await pool.execute(
      `SELECT COALESCE(SUM(total_bill), 0) as revenue
       FROM tickets
       WHERE status = 'Approved'
       AND MONTH(date) = ? AND YEAR(date) = ?`,
      [currentMonth, currentYear]
    );
    const revenue = parseFloat(revenueResult[0].revenue);

    // Driver pay this month (total_pay from approved tickets)
    const [payResult] = await pool.execute(
      `SELECT COALESCE(SUM(total_pay), 0) as pay
       FROM tickets
       WHERE status = 'Approved'
       AND MONTH(date) = ? AND YEAR(date) = ?`,
      [currentMonth, currentYear]
    );
    const driverPay = parseFloat(payResult[0].pay);

    // Estimated profit
    const estimatedProfit = revenue - driverPay;

    // Weekly breakdown for chart
    const [weeklyData] = await pool.execute(
      `SELECT 
        WEEK(date, 1) as week,
        COALESCE(SUM(total_bill), 0) as revenue,
        COALESCE(SUM(total_pay), 0) as pay
       FROM tickets
       WHERE status = 'Approved'
       AND MONTH(date) = ? AND YEAR(date) = ?
       GROUP BY WEEK(date, 1)
       ORDER BY week`,
      [currentMonth, currentYear]
    );

    return res.json({
      success: true,
      data: {
        unbilledTickets,
        revenue,
        driverPay,
        estimatedProfit,
        weeklyData
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};

/**
 * Generate invoice for customer
 */
const generateInvoice = async (req, res) => {
  try {
    const { customerId, startDate, endDate } = req.query;

    if (!customerId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID, start date, and end date are required'
      });
    }

    // Get customer details including GST number
    const [customers] = await pool.execute(
      'SELECT name, gst_number, email FROM customers WHERE id = ?',
      [customerId]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const customerName = customers[0].name;
    const customerGstNumber = customers[0].gst_number || null;
    const customerEmail = customers[0].email || null;

    // Ensure tickets table has required columns
    await ensureTicketColumns();

    // Get approved tickets for customer in date range
    // Use DATE() function to ensure date is returned as date string, not datetime
    const [tickets] = await pool.execute(
      `SELECT t.*, DATE(t.date) as date, d.name as driver_name, d.user_id_code
       FROM tickets t
       LEFT JOIN drivers d ON t.driver_id = d.id
       WHERE t.customer = ? 
       AND t.status = 'Approved'
       AND t.date >= ? AND t.date <= ?
       ORDER BY t.date ASC`,
      [customerName, startDate, endDate]
    );

    const subtotal = tickets.reduce((sum, ticket) => sum + parseFloat(ticket.total_bill), 0);
    const gst = subtotal * 0.05; // 5% GST
    const total = subtotal + gst;

    return res.json({
      success: true,
      data: {
        customer: customerName,
        customerGstNumber: customerGstNumber,
        customerEmail: customerEmail,
        startDate,
        endDate,
        tickets,
        subtotal,
        gst,
        total
      }
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate invoice',
      error: error.message
    });
  }
};

/**
 * Download invoice as PDF
 * Route: GET /admin/invoices/download/:customerId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Returns: PDF binary data (application/pdf)
 */
const downloadInvoice = async (req, res) => {
  // Set error response headers early to ensure JSON errors are properly identified
  const sendError = (statusCode, message) => {
    res.status(statusCode);
    res.setHeader('Content-Type', 'application/json');
    return res.json({ success: false, message });
  };

  try {
    const { customerId } = req.params;
    const { startDate, endDate } = req.query;

    console.log(`[PDF Download] Request received: customerId=${customerId}, startDate=${startDate}, endDate=${endDate}`);

    // Validate required parameters
    if (!customerId || !startDate || !endDate) {
      console.error('[PDF Download] Missing required parameters');
      return sendError(400, 'Customer ID, start date, and end date are required');
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      console.error('[PDF Download] Invalid date format');
      return sendError(400, 'Dates must be in YYYY-MM-DD format');
    }

    // Fetch customer details including GST number
    const [customers] = await pool.execute('SELECT name, gst_number, email FROM customers WHERE id = ?', [customerId]);
    if (customers.length === 0) {
      console.error(`[PDF Download] Customer not found: ${customerId}`);
      return sendError(404, 'Customer not found');
    }
    const customerName = customers[0].name;
    const customerGstNumber = customers[0].gst_number || null;
    const customerEmail = customers[0].email || null;
    console.log(`[PDF Download] Customer found: ${customerName}, GST: ${customerGstNumber || 'N/A'}`);

    // Ensure tickets table has required columns
    await ensureTicketColumns();

    // Fetch approved tickets in date range
    // Use DATE() function to ensure date is returned as date string, not datetime
    const [tickets] = await pool.execute(
      `SELECT t.*, DATE(t.date) as date, d.name as driver_name, d.user_id_code
       FROM tickets t
       LEFT JOIN drivers d ON t.driver_id = d.id
       WHERE t.customer = ? 
         AND t.status = 'Approved'
         AND t.date >= ? AND t.date <= ?
       ORDER BY t.date ASC`,
      [customerName, startDate, endDate]
    );

    if (tickets.length === 0) {
      console.error(`[PDF Download] No tickets found for customer ${customerName} in date range`);
      return sendError(404, 'No approved tickets found for the selected date range');
    }
    
    // Log first ticket for debugging
    if (tickets.length > 0) {
      console.log(`[PDF Download] Sample ticket:`, {
        date: tickets[0].date,
        dateType: typeof tickets[0].date,
        description: tickets[0].equipment_type || tickets[0].job_type || tickets[0].description,
        driver: tickets[0].driver_name,
        bill_rate: tickets[0].bill_rate,
        quantity: tickets[0].quantity,
        total_bill: tickets[0].total_bill
      });
    }

    console.log(`[PDF Download] Found ${tickets.length} tickets`);

    // Calculate totals
    const subtotal = tickets.reduce((sum, ticket) => sum + parseFloat(ticket.total_bill || 0), 0);
    const gst = subtotal * 0.05; // 5% GST
    const total = subtotal + gst;

    console.log(`[PDF Download] Totals calculated: subtotal=$${subtotal.toFixed(2)}, gst=$${gst.toFixed(2)}, total=$${total.toFixed(2)}`);

    // Generate PDF using pdf-lib
    console.log('[PDF Download] Starting PDF generation...');
    let pdfDoc;
    let currentPage;
    let font;
    let boldFont;
    let width, height;
    
    try {
      pdfDoc = await PDFDocument.create();
      currentPage = pdfDoc.addPage([612, 792]); // US Letter
      const pageSize = currentPage.getSize();
      width = pageSize.width;
      height = pageSize.height;
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    } catch (pdfInitError) {
      console.error('[PDF Download] Error initializing PDF document:', pdfInitError);
      return sendError(500, `Failed to initialize PDF: ${pdfInitError.message}`);
    }
    
    const primaryColor = rgb(0.16, 0.36, 0.32); // #295b52
    const margin = 50;
    const topMargin = 50;
    let yPos = height - topMargin;

    // Helper function to wrap text (simple character-based wrapping)
    const wrapText = (text, maxChars) => {
      const textStr = String(text || '');
      if (textStr.length <= maxChars) return [textStr];
      
      const lines = [];
      let currentLine = '';
      const words = textStr.split(' ');
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length <= maxChars) {
          currentLine = testLine;
        } else {
          if (currentLine) lines.push(currentLine);
          // If word itself is longer than maxChars, split it
          if (word.length > maxChars) {
            for (let i = 0; i < word.length; i += maxChars) {
              lines.push(word.substring(i, i + maxChars));
            }
            currentLine = '';
          } else {
            currentLine = word;
          }
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    };

    // Header Section with better spacing
    currentPage.drawText('INVOICE', {
      x: margin,
      y: yPos,
      size: 32,
      font: boldFont,
      color: primaryColor,
    });

    // Invoice metadata with better spacing
    const invoiceNumber = `INV-${customerId}-${Date.now().toString().slice(-6)}`;
    const today = new Date();
    const invoiceDate = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
    yPos -= 35;
    currentPage.drawText(`Invoice #: ${invoiceNumber}`, { x: margin, y: yPos, size: 11, font });
    yPos -= 18;
    currentPage.drawText(`Date of Issue: ${invoiceDate}`, { x: margin, y: yPos, size: 11, font });

    // Bill To Section (Right aligned) with better spacing
    const billToX = width - 260;
    yPos = height - topMargin;
    currentPage.drawText('Bill To:', {
      x: billToX,
      y: yPos,
      size: 13,
      font: boldFont,
      color: primaryColor,
    });
    yPos -= 20;
    
    // Customer name with wrapping
    const customerNameLines = wrapText(customerName, 25);
    customerNameLines.forEach(line => {
      currentPage.drawText(line, { x: billToX, y: yPos, size: 11, font });
      yPos -= 16;
    });
    
    // Period with formatted dates
    const formatPeriodDate = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
    };
    currentPage.drawText(`Period: ${formatPeriodDate(startDate)} to ${formatPeriodDate(endDate)}`, {
      x: billToX,
      y: yPos,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Table Header with optimized spacing
    yPos = height - 200;
    const rowHeight = 26;
    
    // Optimized column widths to fit all 8 columns properly on page
    // [Date, Ticket #, Description, Driver, Subcontractor, Qty, Rate, Total]
    // Page width: 612px, margins: 50px each side = 512px available
    // Optimized widths: 60+58+120+70+85+42+50+65 = 550px + 21px spacing = 571px
    const colWidths = [60, 58, 120, 70, 85, 42, 50, 65];
    const colSpacing = 3;
    
    // Calculate actual table width based on column widths
    const totalColWidths = colWidths.reduce((sum, width) => sum + width, 0);
    const totalSpacing = colSpacing * (colWidths.length + 1); // spacing before first, between, and after last
    const actualTableWidth = totalColWidths + totalSpacing;
    
    // Center the table on the page
    const tableStartX = (width - actualTableWidth) / 2;
    
    // Draw header background
    currentPage.drawRectangle({
      x: tableStartX,
      y: yPos - 22,
      width: actualTableWidth,
      height: rowHeight,
      color: primaryColor,
    });
    
    // Header labels - use full text, columns are wide enough
    const headerLabels = ['Date', 'Ticket #:', 'Description', 'Driver', 'Subcontractor', 'Qty', 'Rate', 'Total'];
    let xPos = tableStartX + colSpacing;
    headerLabels.forEach((header, index) => {
      // Left-align headers with consistent padding
      currentPage.drawText(header, {
        x: xPos + 2, // Small padding from column start
        y: yPos - 5,
        size: 9,
        font: boldFont,
        color: rgb(1, 1, 1),
      });
      xPos += colWidths[index] + colSpacing;
    });

    yPos -= rowHeight + 8;

    // Table Rows with proper text wrapping
    tickets.forEach((ticket, index) => {
      // Check if we need a new page
      if (yPos < 150) {
        currentPage = pdfDoc.addPage([612, 792]);
        yPos = height - 50;
        
        // Redraw header on new page with same alignment
        currentPage.drawRectangle({
          x: tableStartX,
          y: yPos - 22,
          width: actualTableWidth,
          height: rowHeight,
          color: primaryColor,
        });
        xPos = tableStartX + colSpacing;
        headerLabels.forEach((header, idx) => {
          currentPage.drawText(header, {
            x: xPos + 2,
            y: yPos - 5,
            size: 9,
            font: boldFont,
            color: rgb(1, 1, 1),
          });
          xPos += colWidths[idx] + colSpacing;
        });
        yPos -= rowHeight + 8;
      }

      // Format date properly (MM/DD/YYYY format)
      let ticketDate = '-';
      if (ticket.date) {
        try {
          let dateObj = null;
          
          // Check if it's already a Date object
          if (ticket.date instanceof Date) {
            dateObj = ticket.date;
          } else {
            // Convert to string and check format
            let dateStr = String(ticket.date);
            
            // Remove any timezone or GMT strings that might be in the date string
            dateStr = dateStr.split('GMT')[0].split('UTC')[0].trim();
            
            // Handle MySQL date format (YYYY-MM-DD) - most common case
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
              // MySQL date format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
              const dateParts = dateStr.split('T')[0].split(' ')[0].split('-');
              if (dateParts.length === 3) {
                const [year, month, day] = dateParts;
                ticketDate = `${month}/${day}/${year}`;
              } else {
                dateObj = new Date(dateStr);
              }
            } else if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}/)) {
              // Already in MM/DD/YYYY format
              ticketDate = dateStr.substring(0, 10);
            } else {
              // Try parsing as Date
              dateObj = new Date(dateStr);
            }
          }
          
          // Format Date object to MM/DD/YYYY if not already formatted
          if (dateObj && !isNaN(dateObj.getTime()) && ticketDate === '-') {
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const year = dateObj.getFullYear();
            ticketDate = `${month}/${day}/${year}`;
          }
        } catch (e) {
          console.error('[PDF Download] Date formatting error:', e, 'Date value:', ticket.date, 'Type:', typeof ticket.date);
          ticketDate = '-';
        }
      }
      
      // Ensure ticketDate is clean and properly formatted
      if (!ticketDate.match(/^\d{2}\/\d{2}\/\d{4}$/) && ticketDate !== '-') {
        ticketDate = '-';
      }
      
      // Clean description - remove date/time strings
      let cleanDescription = String(ticket.equipment_type || ticket.job_type || ticket.description || '-');
      cleanDescription = cleanDescription
        .replace(/\d{4}-\d{2}-\d{2}.*GMT.*/g, '')
        .replace(/Coordinated Universal Time/g, '')
        .replace(/GMT.*/g, '')
        .replace(/UTC.*/g, '')
        .replace(/Mon|Tue|Wed|Thu|Fri|Sat|Sun.*\d{4}/g, '')
        .replace(/\(.*Universal.*Time.*\)/g, '')
        .trim() || '-';
      const cleanDescriptionLines = wrapText(cleanDescription.substring(0, 40), 16);
      
      // Truncate and wrap driver name
      const driverName = (ticket.driver_name || '-').substring(0, 20);
      const driverLines = wrapText(driverName, 15);
      
      // Clean ticket number - remove any date/time strings
      let ticketNum = String(ticket.ticket_number || '-');
      ticketNum = ticketNum
        .replace(/\d{4}-\d{2}-\d{2}.*/g, '')
        .replace(/GMT.*/g, '')
        .replace(/UTC.*/g, '')
        .replace(/Coordinated Universal Time/g, '')
        .replace(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/g, '')
        .replace(/\d{4}.*GMT/g, '')
        .trim() || '-';
      ticketNum = ticketNum.substring(0, 15);
      
      const maxLines = Math.max(cleanDescriptionLines.length, driverLines.length, 1);
      const cellHeight = Math.max(maxLines * 18 + 12, rowHeight);

      // Draw row data with consistent alignment matching headers
      xPos = tableStartX + colSpacing;
      
      // Date - ensure it's properly formatted (MM/DD/YYYY) - left aligned like header
      const dateText = ticketDate.match(/^\d{2}\/\d{2}\/\d{4}$/) ? ticketDate : '-';
      currentPage.drawText(dateText, {
        x: xPos + 2, // Match header padding
        y: yPos - 5,
        size: 9,
        font: font,
      });
      xPos += colWidths[0] + colSpacing;
      
      // Ticket # - cleaned and truncated - left aligned like header
      const ticketNumShort = ticketNum.substring(0, 9);
      currentPage.drawText(ticketNumShort, {
        x: xPos + 2, // Match header padding
        y: yPos - 5,
        size: 9,
        font: font,
      });
      xPos += colWidths[1] + colSpacing;
      
      // Description (wrapped) - left aligned like header
      cleanDescriptionLines.forEach((line, lineIdx) => {
        const truncatedLine = line.substring(0, 17);
        if (truncatedLine && !truncatedLine.match(/Coordinated|Universal|Time|GMT|UTC/)) {
          currentPage.drawText(truncatedLine, {
            x: xPos + 2, // Match header padding
            y: yPos - 5 - (lineIdx * 14),
            size: 9,
            font: font,
          });
        }
      });
      xPos += colWidths[2] + colSpacing;
      
      // Driver (wrapped) - left aligned like header
      driverLines.forEach((line, lineIdx) => {
        const truncatedLine = line.substring(0, 11);
        currentPage.drawText(truncatedLine, {
          x: xPos + 2, // Match header padding
          y: yPos - 5 - (lineIdx * 14),
          size: 9,
          font: font,
        });
      });
      xPos += colWidths[3] + colSpacing;
      
      // Subcontractor - left aligned like header
      const subcontractor = (ticket.subcontractor || '-').substring(0, 15);
      currentPage.drawText(subcontractor, {
        x: xPos + 2, // Match header padding
        y: yPos - 5,
        size: 9,
        font: font,
      });
      xPos += colWidths[4] + colSpacing;
      
      // Qty - right aligned (fits 42px column)
      const qtyText = parseFloat(ticket.quantity || 0).toFixed(1);
      const qtyWidth = qtyText.length * 5;
      currentPage.drawText(qtyText, {
        x: xPos + colWidths[5] - qtyWidth - 2,
        y: yPos - 5,
        size: 9,
        font: font,
      });
      xPos += colWidths[5] + colSpacing;
      
      // Rate - right aligned (fits 50px column)
      const billRate = parseFloat(ticket.bill_rate || ticket.rate || 0);
      const rateText = `$${billRate.toFixed(2)}`;
      const rateWidth = rateText.length * 5;
      currentPage.drawText(rateText, {
        x: xPos + colWidths[6] - rateWidth - 2,
        y: yPos - 5,
        size: 9,
        font: font,
      });
      xPos += colWidths[6] + colSpacing;
      
      // Total - right aligned (fits 65px column)
      const totalText = `$${parseFloat(ticket.total_bill || 0).toFixed(2)}`;
      const totalWidth = totalText.length * 5;
      currentPage.drawText(totalText, {
        x: xPos + colWidths[7] - totalWidth - 2,
        y: yPos - 5,
        size: 9,
        font: font,
      });

      // Move to next row with proper spacing (use calculated cellHeight)
      yPos -= cellHeight;
      
      // Draw subtle separator line using rectangle
      if (index < tickets.length - 1) {
        currentPage.drawRectangle({
          x: tableStartX,
          y: yPos + 3,
          width: actualTableWidth,
          height: 0.5,
          color: rgb(0.85, 0.85, 0.85),
        });
        yPos -= 5;
      }
    });

    // Totals Section (on last page, ensure enough space) with better spacing
    yPos -= 35;
    if (yPos < 130) {
      currentPage = pdfDoc.addPage([612, 792]);
      yPos = height - 130;
    }
    
    const totalsX = width - 260;
    const totalsRightX = width - 90;
    
    // Subtotal with better spacing
    currentPage.drawText('Subtotal:', { x: totalsX, y: yPos, size: 11, font });
    const subtotalText = `$${subtotal.toFixed(2)}`;
    currentPage.drawText(subtotalText, { x: totalsRightX, y: yPos, size: 11, font });

    yPos -= 22;
    // GST
    const companyGstNumber = '818440612RT0001';
    currentPage.drawText('GST (5%)', { x: totalsX, y: yPos, size: 11, font });
    currentPage.drawText(`#: ${companyGstNumber}`, { x: totalsX + 55, y: yPos, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
    const gstText = `$${gst.toFixed(2)}`;
    currentPage.drawText(gstText, { x: totalsRightX, y: yPos, size: 11, font });

    yPos -= 22;
    // Draw line above total
    currentPage.drawRectangle({
      x: totalsX - 15,
      y: yPos + 6,
      width: 220,
      height: 1.5,
      color: rgb(0.4, 0.4, 0.4),
    });
    
    yPos -= 12;
    // Total (bold and colored) with larger font
    currentPage.drawText('Total:', {
      x: totalsX,
      y: yPos,
      size: 16,
      font: boldFont,
      color: primaryColor,
    });
    const totalAmountText = `$${total.toFixed(2)}`;
    currentPage.drawText(totalAmountText, {
      x: totalsRightX,
      y: yPos,
      size: 16,
      font: boldFont,
      color: primaryColor,
    });

    // Finalize PDF
    console.log('[PDF Download] Saving PDF document...');
    const pdfBytesUint8 = await pdfDoc.save();

    // Validate PDF bytes
    if (!pdfBytesUint8 || pdfBytesUint8.length === 0) {
      console.error('[PDF Download] PDF bytes are empty!');
      return sendError(500, 'Failed to generate PDF: Empty PDF bytes');
    }

    // Convert Uint8Array to Buffer for Node.js
    const pdfBytes = Buffer.from(pdfBytesUint8);

    // Validate PDF header (should start with %PDF)
    const pdfHeader = pdfBytes.slice(0, 4).toString('utf8');
    console.log(`[PDF Download] PDF header check: "${pdfHeader}" (expected: "%PDF")`);
    
    if (pdfHeader !== '%PDF') {
      console.error(`[PDF Download] Invalid PDF header: "${pdfHeader}" (hex: ${pdfBytes.slice(0, 4).toString('hex')})`);
      console.error(`[PDF Download] First 20 bytes: ${pdfBytes.slice(0, 20).toString('hex')}`);
      return sendError(500, 'Failed to generate PDF: Invalid PDF format');
    }

    console.log(`[PDF Download] PDF generated successfully: ${pdfBytes.length} bytes`);

    // Prepare filename
    const sanitizedCustomerName = customerName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Invoice-${sanitizedCustomerName}-${startDate}-${endDate}.pdf`;

    // Prevent caching (CRITICAL for PDF downloads)
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.removeHeader('ETag');

    // Set PDF headers - MUST be set before sending
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBytes.length);

    // Send PDF binary data directly (Buffer is already correct format)
    console.log(`[PDF Download] Sending PDF response: ${pdfBytes.length} bytes`);
    res.status(200);
    return res.send(pdfBytes);

  } catch (error) {
    console.error('[PDF Download] Error generating PDF:', error);
    console.error('[PDF Download] Stack trace:', error.stack);
    return sendError(500, `Failed to generate invoice PDF: ${error.message}`);
  }
};

/**
 * Send invoice via email
 * Route: POST /admin/invoices/send
 * Body: { customerId, startDate, endDate, email (optional, defaults to customer email) }
 */
const sendInvoiceEmailHandler = async (req, res) => {
  try {
    const { customerId, startDate, endDate, email } = req.body;

    // Validate required parameters
    if (!customerId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID, start date, and end date are required'
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Dates must be in YYYY-MM-DD format'
      });
    }

    // Fetch customer details
    const [customers] = await pool.execute(
      'SELECT name, gst_number, email FROM customers WHERE id = ?',
      [customerId]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const customerName = customers[0].name;
    const customerEmail = customers[0].email || null;
    const recipientEmail = email || customerEmail;

    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required. Please provide email or ensure customer has an email address.'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address format'
      });
    }

    // Ensure tickets table has required columns
    await ensureTicketColumns();

    // Fetch approved tickets
    // Use DATE() function to ensure date is returned as date string, not datetime
    const [tickets] = await pool.execute(
      `SELECT t.*, DATE(t.date) as date, d.name as driver_name, d.user_id_code
       FROM tickets t
       LEFT JOIN drivers d ON t.driver_id = d.id
       WHERE t.customer = ? 
         AND t.status = 'Approved'
         AND t.date >= ? AND t.date <= ?
       ORDER BY t.date ASC`,
      [customerName, startDate, endDate]
    );

    if (tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No approved tickets found for the selected date range'
      });
    }

    // Generate PDF (reuse downloadInvoice logic but return buffer instead of sending)
    // We'll create a helper function to generate PDF buffer
    const pdfBuffer = await generateInvoicePDFBuffer({
      customerId,
      customerName,
      customerGstNumber: customers[0].gst_number || '818440612RT0001',
      startDate,
      endDate,
      tickets,
    });

    if (!pdfBuffer) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate invoice PDF'
      });
    }

    // Generate invoice number
    const invoiceNumber = `INV-${customerId}-${Date.now().toString().slice(-6)}`;
    const sanitizedCustomerName = customerName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Invoice-${sanitizedCustomerName}-${startDate}-${endDate}.pdf`;

    // Send email
    const emailResult = await sendInvoiceEmail({
      to: recipientEmail,
      customerName,
      invoiceNumber,
      startDate,
      endDate,
      pdfBuffer,
      filename,
    });

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: emailResult.message || 'Failed to send invoice email',
        error: emailResult.error
      });
    }

    return res.json({
      success: true,
      message: 'Invoice email sent successfully',
      data: {
        messageId: emailResult.messageId,
        recipientEmail,
        invoiceNumber,
      }
    });

  } catch (error) {
    console.error('[Send Invoice Email] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send invoice email',
      error: error.message
    });
  }
};

/**
 * Helper function to generate invoice PDF buffer
 * Reuses logic from downloadInvoice but returns buffer instead of sending response
 */
const generateInvoicePDFBuffer = async ({
  customerId,
  customerName,
  customerGstNumber,
  startDate,
  endDate,
  tickets,
}) => {
  try {
    // Calculate totals
    const subtotal = tickets.reduce((sum, ticket) => sum + parseFloat(ticket.total_bill || 0), 0);
    const gst = subtotal * 0.05;
    const total = subtotal + gst;

    // Generate PDF
    const pdfDoc = await PDFDocument.create();
    let currentPage = pdfDoc.addPage([612, 792]);
    const pageSize = currentPage.getSize();
    const width = pageSize.width;
    let height = pageSize.height;
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const primaryColor = rgb(0.16, 0.36, 0.32);
    const margin = 50;
    const topMargin = 50;
    let yPos = height - topMargin;

    // Helper function to wrap text
    const wrapText = (text, maxChars) => {
      const textStr = String(text || '');
      if (textStr.length <= maxChars) return [textStr];
      const lines = [];
      let currentLine = '';
      const words = textStr.split(' ');
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length <= maxChars) {
          currentLine = testLine;
        } else {
          if (currentLine) lines.push(currentLine);
          if (word.length > maxChars) {
            for (let i = 0; i < word.length; i += maxChars) {
              lines.push(word.substring(i, i + maxChars));
            }
            currentLine = '';
          } else {
            currentLine = word;
          }
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    };

    // Header with better spacing
    currentPage.drawText('INVOICE', {
      x: margin,
      y: yPos,
      size: 32,
      font: boldFont,
      color: primaryColor,
    });

    const invoiceNumber = `INV-${customerId}-${Date.now().toString().slice(-6)}`;
    const today = new Date();
    const invoiceDate = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
    yPos -= 35;
    currentPage.drawText(`Invoice #: ${invoiceNumber}`, { x: margin, y: yPos, size: 11, font });
    yPos -= 18;
    currentPage.drawText(`Date of Issue: ${invoiceDate}`, { x: margin, y: yPos, size: 11, font });

    // Bill To with better spacing
    const billToX = width - 260;
    yPos = height - topMargin;
    currentPage.drawText('Bill To:', {
      x: billToX,
      y: yPos,
      size: 13,
      font: boldFont,
      color: primaryColor,
    });
    yPos -= 20;
    const customerNameLines = wrapText(customerName, 25);
    customerNameLines.forEach(line => {
      currentPage.drawText(line, { x: billToX, y: yPos, size: 11, font });
      yPos -= 16;
    });
    const formatPeriodDate = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
    };
    currentPage.drawText(`Period: ${formatPeriodDate(startDate)} to ${formatPeriodDate(endDate)}`, {
      x: billToX,
      y: yPos,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Table Header
    yPos = height - 200;
    const rowHeight = 26;
    
    // Optimized column widths to fit all 8 columns properly on page
    // [Date, Ticket #, Description, Driver, Subcontractor, Qty, Rate, Total]
    // Page width: 612px, margins: 50px each side = 512px available
    // Optimized widths: 60+58+120+70+85+42+50+65 = 550px + 21px spacing = 571px
    const colWidths = [60, 58, 120, 70, 85, 42, 50, 65];
    const colSpacing = 3;
    
    // Calculate actual table width based on column widths
    const totalColWidths = colWidths.reduce((sum, width) => sum + width, 0);
    const totalSpacing = colSpacing * (colWidths.length + 1); // spacing before first, between, and after last
    const actualTableWidth = totalColWidths + totalSpacing;
    
    // Center the table on the page
    const tableStartX = (width - actualTableWidth) / 2;
    
    currentPage.drawRectangle({
      x: tableStartX,
      y: yPos - 22,
      width: actualTableWidth,
      height: rowHeight,
      color: primaryColor,
    });
    
    // Header labels - use full text, columns are wide enough
    const headerLabels = ['Date', 'Ticket #:', 'Description', 'Driver', 'Subcontractor', 'Qty', 'Rate', 'Total'];
    let xPos = tableStartX + colSpacing;
    headerLabels.forEach((header, index) => {
      // Left-align headers with consistent padding
      currentPage.drawText(header, {
        x: xPos + 2, // Small padding from column start
        y: yPos - 5,
        size: 9,
        font: boldFont,
        color: rgb(1, 1, 1),
      });
      xPos += colWidths[index] + colSpacing;
    });

    yPos -= rowHeight + 8;

    // Table Rows
    tickets.forEach((ticket, index) => {
      if (yPos < 150) {
        currentPage = pdfDoc.addPage([612, 792]);
        yPos = height - 50;
        currentPage.drawRectangle({
          x: tableStartX,
          y: yPos - 22,
          width: actualTableWidth,
          height: rowHeight,
          color: primaryColor,
        });
        xPos = tableStartX + colSpacing;
        headerLabels.forEach((header, idx) => {
          currentPage.drawText(header, {
            x: xPos + 2,
            y: yPos - 5,
            size: 9,
            font: boldFont,
            color: rgb(1, 1, 1),
          });
          xPos += colWidths[idx] + colSpacing;
        });
        yPos -= rowHeight + 8;
      }

      // Format date properly (MM/DD/YYYY format)
      let ticketDate = '-';
      if (ticket.date) {
        try {
          let dateObj = null;
          
          // Check if it's already a Date object
          if (ticket.date instanceof Date) {
            dateObj = ticket.date;
          } else {
            // Convert to string and check format
            let dateStr = String(ticket.date);
            
            // Remove any timezone or GMT strings that might be in the date string
            dateStr = dateStr.split('GMT')[0].split('UTC')[0].trim();
            
            // Handle MySQL date format (YYYY-MM-DD) - most common case
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
              // MySQL date format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
              const dateParts = dateStr.split('T')[0].split(' ')[0].split('-');
              if (dateParts.length === 3) {
                const [year, month, day] = dateParts;
                ticketDate = `${month}/${day}/${year}`;
              } else {
                dateObj = new Date(dateStr);
              }
            } else if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}/)) {
              // Already in MM/DD/YYYY format
              ticketDate = dateStr.substring(0, 10);
            } else {
              // Try parsing as Date
              dateObj = new Date(dateStr);
            }
          }
          
          // Format Date object to MM/DD/YYYY if not already formatted
          if (dateObj && !isNaN(dateObj.getTime()) && ticketDate === '-') {
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const year = dateObj.getFullYear();
            ticketDate = `${month}/${day}/${year}`;
          }
        } catch (e) {
          console.error('[PDF Buffer] Date formatting error:', e, 'Date value:', ticket.date, 'Type:', typeof ticket.date);
          ticketDate = '-';
        }
      }
      
      // Ensure ticketDate is clean and properly formatted
      if (!ticketDate.match(/^\d{2}\/\d{2}\/\d{4}$/) && ticketDate !== '-') {
        ticketDate = '-';
      }
      
      // Clean ticket number - remove any date/time strings
      let ticketNum = String(ticket.ticket_number || '-');
      ticketNum = ticketNum
        .replace(/\d{4}-\d{2}-\d{2}.*/g, '')
        .replace(/GMT.*/g, '')
        .replace(/UTC.*/g, '')
        .replace(/Coordinated Universal Time/g, '')
        .replace(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/g, '')
        .replace(/\d{4}.*GMT/g, '')
        .trim() || '-';
      ticketNum = ticketNum.substring(0, 15);
      
      // Clean description - remove date/time strings
      let cleanDescription = String(ticket.equipment_type || ticket.job_type || ticket.description || '-');
      cleanDescription = cleanDescription
        .replace(/\d{4}-\d{2}-\d{2}.*GMT.*/g, '')
        .replace(/Coordinated Universal Time/g, '')
        .replace(/GMT.*/g, '')
        .replace(/UTC.*/g, '')
        .replace(/Mon|Tue|Wed|Thu|Fri|Sat|Sun.*\d{4}/g, '')
        .replace(/\(.*Universal.*Time.*\)/g, '')
        .trim() || '-';
      const cleanDescriptionLines = wrapText(cleanDescription.substring(0, 35), 18);
      
      // Truncate and wrap driver name
      const driverName = (ticket.driver_name || '-').substring(0, 20);
      const driverLines = wrapText(driverName, 12);
      
      const maxLines = Math.max(cleanDescriptionLines.length, driverLines.length, 1);
      const cellHeight = Math.max(maxLines * 14 + 8, rowHeight);

      xPos = tableStartX + colSpacing;
      
      // Date - ensure it's properly formatted (MM/DD/YYYY) - left aligned like header
      const dateText = ticketDate.match(/^\d{2}\/\d{2}\/\d{4}$/) ? ticketDate : '-';
      currentPage.drawText(dateText, { x: xPos + 2, y: yPos - 5, size: 9, font });
      xPos += colWidths[0] + colSpacing;
      
      // Ticket # - cleaned and truncated - left aligned like header
      const ticketNumShort = ticketNum.substring(0, 9);
      currentPage.drawText(ticketNumShort, { x: xPos + 2, y: yPos - 5, size: 9, font });
      xPos += colWidths[1] + colSpacing;
      
      // Description (wrapped) - left aligned like header
      cleanDescriptionLines.forEach((line, lineIdx) => {
        const truncatedLine = line.substring(0, 17);
        if (truncatedLine && !truncatedLine.match(/Coordinated|Universal|Time|GMT|UTC/)) {
          currentPage.drawText(truncatedLine, { x: xPos + 2, y: yPos - 5 - (lineIdx * 14), size: 9, font });
        }
      });
      xPos += colWidths[2] + colSpacing;
      
      // Driver (wrapped) - left aligned like header
      driverLines.forEach((line, lineIdx) => {
        const truncatedLine = line.substring(0, 11);
        currentPage.drawText(truncatedLine, { x: xPos + 2, y: yPos - 5 - (lineIdx * 14), size: 9, font });
      });
      xPos += colWidths[3] + colSpacing;
      
      // Subcontractor - left aligned like header
      const subcontractor = (ticket.subcontractor || '-').substring(0, 15);
      currentPage.drawText(subcontractor, { x: xPos + 2, y: yPos - 5, size: 9, font });
      xPos += colWidths[4] + colSpacing;
      
      // Qty - right aligned (fits 42px column)
      const qtyText = parseFloat(ticket.quantity || 0).toFixed(1);
      const qtyWidth = qtyText.length * 5;
      currentPage.drawText(qtyText, { x: xPos + colWidths[5] - qtyWidth - 2, y: yPos - 5, size: 9, font });
      xPos += colWidths[5] + colSpacing;
      
      // Rate - right aligned (fits 50px column)
      const billRate = parseFloat(ticket.bill_rate || ticket.rate || 0);
      const rateText = `$${billRate.toFixed(2)}`;
      const rateWidth = rateText.length * 5;
      currentPage.drawText(rateText, { x: xPos + colWidths[6] - rateWidth - 2, y: yPos - 5, size: 9, font });
      xPos += colWidths[6] + colSpacing;
      
      // Total - right aligned (fits 65px column)
      const totalText = `$${parseFloat(ticket.total_bill || 0).toFixed(2)}`;
      const totalWidth = totalText.length * 5;
      currentPage.drawText(totalText, { x: xPos + colWidths[7] - totalWidth - 2, y: yPos - 5, size: 9, font });
      
      // Move to next row with proper spacing
      yPos -= cellHeight;
      
      if (index < tickets.length - 1) {
        currentPage.drawRectangle({
          x: tableStartX,
          y: yPos + 3,
          width: actualTableWidth,
          height: 0.5,
          color: rgb(0.85, 0.85, 0.85),
        });
        yPos -= 5;
      }
    });

    // Totals Section with better spacing
    yPos -= 35;
    if (yPos < 130) {
      currentPage = pdfDoc.addPage([612, 792]);
      yPos = height - 130;
    }
    const totalsX = width - 260;
    const totalsRightX = width - 90;
    
    // Subtotal
    currentPage.drawText('Subtotal:', { x: totalsX, y: yPos, size: 11, font });
    currentPage.drawText(`$${subtotal.toFixed(2)}`, { x: totalsRightX, y: yPos, size: 11, font });
    yPos -= 22;
    
    // GST
    const companyGstNumber = '818440612RT0001';
    currentPage.drawText('GST (5%)', { x: totalsX, y: yPos, size: 11, font });
    currentPage.drawText(`#: ${companyGstNumber}`, { x: totalsX + 55, y: yPos, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
    currentPage.drawText(`$${gst.toFixed(2)}`, { x: totalsRightX, y: yPos, size: 11, font });
    
    yPos -= 22;
    
    // Draw line above total
    currentPage.drawRectangle({
      x: totalsX - 15,
      y: yPos + 6,
      width: 220,
      height: 1.5,
      color: rgb(0.4, 0.4, 0.4),
    });
    yPos -= 12;
    
    // Total (bold and colored) with larger font
    currentPage.drawText('Total:', { x: totalsX, y: yPos, size: 16, font: boldFont, color: primaryColor });
    currentPage.drawText(`$${total.toFixed(2)}`, { x: totalsRightX, y: yPos, size: 16, font: boldFont, color: primaryColor });

    const pdfBytesUint8 = await pdfDoc.save();
    return Buffer.from(pdfBytesUint8);
  } catch (error) {
    console.error('[Generate PDF Buffer] Error:', error);
    return null;
  }
};

/**
 * Generate settlement for driver
 */
const generateSettlement = async (req, res) => {
  try {
    const { driverId, startDate, endDate } = req.query;

    // Validate all required parameters with specific error messages
    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
        missing: 'driverId'
      });
    }
    
    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date is required (format: YYYY-MM-DD)',
        missing: 'startDate'
      });
    }
    
    if (!endDate) {
      return res.status(400).json({
        success: false,
        message: 'End date is required (format: YYYY-MM-DD)',
        missing: 'endDate'
      });
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate)) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be in YYYY-MM-DD format',
        received: startDate
      });
    }
    
    if (!dateRegex.test(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be in YYYY-MM-DD format',
        received: endDate
      });
    }

    // Get driver info
    const [drivers] = await pool.execute(
      'SELECT id, name, user_id_code FROM drivers WHERE id = ?',
      [driverId]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const driver = drivers[0];

    // Get tickets for driver in date range
    const [tickets] = await pool.execute(
      `SELECT t.*, c.name as customer_name
       FROM tickets t
       LEFT JOIN customers c ON t.customer = c.name
       WHERE t.driver_id = ?
       AND t.date >= ? AND t.date <= ?
       ORDER BY t.date ASC`,
      [driverId, startDate, endDate]
    );

    const totalPay = tickets.reduce((sum, ticket) => sum + parseFloat(ticket.total_pay), 0);

    return res.json({
      success: true,
      data: {
        driver: {
          id: driver.id,
          name: driver.name,
          user_id_code: driver.user_id_code
        },
        startDate,
        endDate,
        tickets,
        totalPay
      }
    });
  } catch (error) {
    console.error('Error generating settlement:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate settlement',
      error: error.message
    });
  }
};

/**
 * Download settlement as PDF (placeholder)
 * 
 * Route: GET /admin/settlements/download/:driverId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * 
 * Parameters:
 * - driverId (URL param): Driver ID
 * - startDate (query param): Start date in YYYY-MM-DD format (required)
 * - endDate (query param): End date in YYYY-MM-DD format (required)
 * 
 * Note: Settlements are generated dynamically from tickets. This endpoint requires
 * all three parameters to generate the settlement PDF.
 */
/**
 * Download settlement as PDF
 */
const downloadSettlement = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { startDate, endDate } = req.query;

    if (!driverId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID, start date, and end date are required'
      });
    }

    // Get driver info
    const [drivers] = await pool.execute(
      'SELECT name, user_id_code FROM drivers WHERE id = ?',
      [driverId]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const driver = drivers[0];
    const filename = `Settlement-${driver.user_id_code}-${startDate}-${endDate}.pdf`;

    // Get tickets for driver grouped by customer
    const [tickets] = await pool.execute(
      `SELECT t.*, c.name as customer_name
       FROM tickets t
       LEFT JOIN customers c ON t.customer = c.name
       WHERE t.driver_id = ?
       AND t.date >= ? AND t.date <= ?
       ORDER BY c.name, t.date ASC`,
      [driverId, startDate, endDate]
    );

    // Group tickets by customer
    const customerGroups = {};
    tickets.forEach(ticket => {
      const custName = ticket.customer_name || ticket.customer || 'Unknown';
      if (!customerGroups[custName]) {
        customerGroups[custName] = [];
      }
      customerGroups[custName].push(ticket);
    });

    // Generate PDF - Invoice style
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const primaryColor = rgb(0.16, 0.36, 0.32);
    const margin = 50;
    const topMargin = 50;
    
    let grandTotalPay = 0;
    const customerEntries = Object.entries(customerGroups);

    // Format date helper
    const formatDate = (dateStr) => {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
    };

    // Each customer gets their own page (like invoice)
    for (let custIndex = 0; custIndex < customerEntries.length; custIndex++) {
      const [customerName, custTickets] = customerEntries[custIndex];
      
      // New page for each customer
      let currentPage = pdfDoc.addPage([612, 792]);
      const pageSize = currentPage.getSize();
      const width = pageSize.width;
      const height = pageSize.height;
      let yPos = height - topMargin;

      // Calculate customer totals
      const customerSubtotal = custTickets.reduce((sum, t) => sum + parseFloat(t.total_bill || 0), 0);
      const customerGst = customerSubtotal * 0.05;
      const customerTotal = customerSubtotal + customerGst;
      const customerPay = custTickets.reduce((sum, t) => sum + parseFloat(t.total_pay || 0), 0);
      grandTotalPay += customerPay;

      // Header - INVOICE style
      currentPage.drawText('INVOICE', {
        x: margin,
        y: yPos,
        size: 32,
        font: boldFont,
        color: primaryColor,
      });

      // Invoice metadata
      const invoiceNumber = `INV-${custIndex + 1}-${Date.now().toString().slice(-6)}`;
      const today = new Date();
      const invoiceDate = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
      yPos -= 35;
      currentPage.drawText(`Invoice #: ${invoiceNumber}`, { x: margin, y: yPos, size: 11, font });
      yPos -= 18;
      currentPage.drawText(`Date of Issue: ${invoiceDate}`, { x: margin, y: yPos, size: 11, font });

      // Bill To Section (Right aligned)
      const billToX = width - 260;
      let billToY = height - topMargin;
      currentPage.drawText('Bill To:', {
        x: billToX,
        y: billToY,
        size: 13,
        font: boldFont,
        color: primaryColor,
      });
      billToY -= 20;
      currentPage.drawText(customerName, { x: billToX, y: billToY, size: 11, font });
      billToY -= 18;
      currentPage.drawText(`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, {
        x: billToX,
        y: billToY,
        size: 10,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });

      // Table Header
      yPos = height - 200;
      const rowHeight = 26;
      const colWidths = [70, 60, 100, 70, 85, 45, 55, 65];
      const colSpacing = 3;
      const totalColWidths = colWidths.reduce((sum, w) => sum + w, 0);
      const totalSpacing = colSpacing * (colWidths.length + 1);
      const actualTableWidth = totalColWidths + totalSpacing;
      const tableStartX = (width - actualTableWidth) / 2;

      // Header background
      currentPage.drawRectangle({
        x: tableStartX,
        y: yPos - 22,
        width: actualTableWidth,
        height: rowHeight,
        color: primaryColor,
      });

      const headerLabels = ['Date', 'Ticket #:', 'Description', 'Driver', 'Subcontractor', 'Qty', 'Rate', 'Total'];
      let xPos = tableStartX + colSpacing;
      headerLabels.forEach((header, index) => {
        currentPage.drawText(header, {
          x: xPos + 2,
          y: yPos - 5,
          size: 9,
          font: boldFont,
          color: rgb(1, 1, 1),
        });
        xPos += colWidths[index] + colSpacing;
      });

      yPos -= rowHeight + 8;

      // Table rows
      for (const ticket of custTickets) {
        if (yPos < 150) {
          currentPage = pdfDoc.addPage([612, 792]);
          yPos = height - 50;
          
          // Redraw header
          currentPage.drawRectangle({
            x: tableStartX,
            y: yPos - 22,
            width: actualTableWidth,
            height: rowHeight,
            color: primaryColor,
          });
          xPos = tableStartX + colSpacing;
          headerLabels.forEach((header, idx) => {
            currentPage.drawText(header, {
              x: xPos + 2,
              y: yPos - 5,
              size: 9,
              font: boldFont,
              color: rgb(1, 1, 1),
            });
            xPos += colWidths[idx] + colSpacing;
          });
          yPos -= rowHeight + 8;
        }

        const rowData = [
          formatDate(ticket.date),
          String(ticket.ticket_number || '-').substring(0, 8),
          String(ticket.equipment_type || ticket.description || '-').substring(0, 15),
          String(driver.name || '-').substring(0, 10),
          String(ticket.subcontractor || '-').substring(0, 12),
          parseFloat(ticket.quantity || 0).toFixed(1),
          `$${parseFloat(ticket.bill_rate || ticket.rate || 0).toFixed(2)}`,
          `$${parseFloat(ticket.total_bill || 0).toFixed(2)}`
        ];

        xPos = tableStartX + colSpacing;
        rowData.forEach((data, idx) => {
          currentPage.drawText(data, {
            x: xPos + 2,
            y: yPos,
            size: 9,
            font: font,
          });
          xPos += colWidths[idx] + colSpacing;
        });
        yPos -= 18;
      }

      // Totals section - same as invoice
      yPos -= 20;
      const totalsX = width - 260;
      const totalsRightX = width - 90;

      // Subtotal
      currentPage.drawText('Subtotal:', { x: totalsX, y: yPos, size: 11, font });
      currentPage.drawText(`$${customerSubtotal.toFixed(2)}`, { x: totalsRightX, y: yPos, size: 11, font });

      yPos -= 22;
      // GST with number
      const companyGstNumber = '818440612RT0001';
      currentPage.drawText('GST (5%)', { x: totalsX, y: yPos, size: 11, font });
      currentPage.drawText(`#: ${companyGstNumber}`, { x: totalsX + 55, y: yPos, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
      currentPage.drawText(`$${customerGst.toFixed(2)}`, { x: totalsRightX, y: yPos, size: 11, font });

      yPos -= 22;
      // Line above total
      currentPage.drawRectangle({
        x: totalsX - 15,
        y: yPos + 6,
        width: 220,
        height: 1.5,
        color: rgb(0.4, 0.4, 0.4),
      });

      yPos -= 12;
      // Total
      currentPage.drawText('Total:', {
        x: totalsX,
        y: yPos,
        size: 16,
        font: boldFont,
        color: primaryColor,
      });
      currentPage.drawText(`$${customerTotal.toFixed(2)}`, {
        x: totalsRightX,
        y: yPos,
        size: 16,
        font: boldFont,
        color: primaryColor,
      });
    }

    // Final page with Total Pay to Driver
    let finalPage = pdfDoc.addPage([612, 792]);
    const finalWidth = 612;
    const finalHeight = 792;
    let finalY = finalHeight - 100;

    finalPage.drawText('SETTLEMENT SUMMARY', {
      x: margin,
      y: finalY,
      size: 28,
      font: boldFont,
      color: primaryColor,
    });

    finalY -= 40;
    finalPage.drawText(`Driver: ${driver.name} (${driver.user_id_code})`, {
      x: margin,
      y: finalY,
      size: 14,
      font: font,
    });

    finalY -= 25;
    finalPage.drawText(`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, {
      x: margin,
      y: finalY,
      size: 12,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });

    finalY -= 50;
    // Total Pay box
    finalPage.drawRectangle({
      x: margin,
      y: finalY - 15,
      width: finalWidth - 2 * margin,
      height: 50,
      color: rgb(0.96, 0.96, 0.96),
    });
    
    finalPage.drawText('Total Pay to Driver:', {
      x: margin + 20,
      y: finalY + 5,
      size: 18,
      font: boldFont,
      color: primaryColor,
    });
    
    finalPage.drawText(`$${grandTotalPay.toFixed(2)}`, {
      x: finalWidth - margin - 120,
      y: finalY + 5,
      size: 18,
      font: boldFont,
      color: primaryColor,
    });

    const pdfBytes = await pdfDoc.save();

    // Headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.status(200).send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Error downloading settlement:', error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      success: false,
      message: 'Failed to generate settlement PDF',
      error: error.message
    });
  }
};

/**
 * Get bill rates (default customer bill rates)
 */
const getBillRates = async (req, res) => {
  try {
    const [customers] = await pool.execute(
      'SELECT id, name, default_bill_rate FROM customers ORDER BY name ASC'
    );

    return res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('Error fetching bill rates:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch bill rates',
      error: error.message
    });
  }
};

/**
 * Update bill rates
 */
const updateBillRates = async (req, res) => {
  try {
    const { rates } = req.body; // Array of {id, default_bill_rate}

    if (!Array.isArray(rates)) {
      return res.status(400).json({
        success: false,
        message: 'Rates must be an array'
      });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      for (const rate of rates) {
        await connection.execute(
          'UPDATE customers SET default_bill_rate = ?, updated_at = NOW() WHERE id = ?',
          [rate.default_bill_rate, rate.id]
        );
      }

      await connection.commit();

      return res.json({
        success: true,
        message: 'Bill rates updated successfully'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating bill rates:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update bill rates',
      error: error.message
    });
  }
};

/**
 * Get all trucks
 */
const getAllTrucks = async (req, res) => {
  try {
    // First try with all columns
    try {
      const [trucks] = await pool.execute(
        `SELECT id, truck_number, truck_type, assigned_customer_id, status, notes, created_at, updated_at 
         FROM trucks ORDER BY truck_number ASC`
      );

      return res.json({
        success: true,
        data: trucks
      });
    } catch (columnError) {
      // If columns don't exist, try with basic columns only
      if (columnError.code === 'ER_BAD_FIELD_ERROR' || columnError.message.includes('Unknown column')) {
        console.log('Some columns missing, fetching with basic columns only');
        const [trucks] = await pool.execute(
          `SELECT id, truck_number, created_at, updated_at 
           FROM trucks ORDER BY truck_number ASC`
        );

        // Add default values for missing columns
        const trucksWithDefaults = trucks.map(truck => ({
          ...truck,
          truck_type: null,
          assigned_customer_id: null,
          status: 'Active',
          notes: null
        }));

        return res.json({
          success: true,
          data: trucksWithDefaults,
          message: 'Some columns are missing. Please run ADD_TRUCK_COLUMNS.sql migration.'
        });
      }
      throw columnError;
    }
  } catch (error) {
    console.error('Error fetching trucks:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch trucks',
      error: error.message
    });
  }
};

/**
 * Create a new truck
 */
const createTruck = async (req, res) => {
  try {
    const { truck_number, truck_type, assigned_customer_id, status, notes } = req.body;

    if (!truck_number || truck_number.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Truck number is required'
      });
    }

    // Check which columns exist in the database
    const [columns] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'trucks'`
    );
    const existingColumns = columns.map(col => col.COLUMN_NAME);

    // Only require truck_type if the column exists
    if (existingColumns.includes('truck_type') && !truck_type) {
      return res.status(400).json({
        success: false,
        message: 'Truck type is required'
      });
    }

    // Check if truck number already exists
    const [existing] = await pool.execute(
      'SELECT id FROM trucks WHERE truck_number = ?',
      [truck_number.trim()]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Truck number already exists'
      });
    }

    // Verify customer exists if assigned
    if (assigned_customer_id) {
      const [customer] = await pool.execute(
        'SELECT id FROM customers WHERE id = ?',
        [assigned_customer_id]
      );
      if (customer.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid customer assignment'
        });
      }
    }

    // Build INSERT query dynamically based on existing columns
    const insertColumns = ['truck_number'];
    const insertValues = [truck_number.trim()];

    if (existingColumns.includes('truck_type')) {
      insertColumns.push('truck_type');
      insertValues.push(truck_type || null);
    }

    if (existingColumns.includes('assigned_customer_id')) {
      insertColumns.push('assigned_customer_id');
      insertValues.push(assigned_customer_id || null);
    }

    if (existingColumns.includes('status')) {
      insertColumns.push('status');
      insertValues.push(status || 'Active');
    }

    if (existingColumns.includes('notes')) {
      insertColumns.push('notes');
      insertValues.push(notes || null);
    }

    const placeholders = insertValues.map(() => '?').join(', ');
    const [result] = await pool.execute(
      `INSERT INTO trucks (${insertColumns.join(', ')}) VALUES (${placeholders})`,
      insertValues
    );

    return res.status(201).json({
      success: true,
      message: 'Truck added successfully',
      data: { 
        id: result.insertId, 
        truck_number: truck_number.trim(),
        truck_type: existingColumns.includes('truck_type') ? truck_type : null,
        assigned_customer_id: existingColumns.includes('assigned_customer_id') ? (assigned_customer_id || null) : null,
        status: existingColumns.includes('status') ? (status || 'Active') : 'Active',
        notes: existingColumns.includes('notes') ? (notes || null) : null
      }
    });
  } catch (error) {
    console.error('Error creating truck:', error);
    // If column doesn't exist error, try to add it and retry
    if (error.message.includes('Unknown column')) {
      try {
        // Try to add missing columns
        const columnsToAdd = [
          { name: 'truck_type', sql: 'ALTER TABLE trucks ADD COLUMN truck_type ENUM(\'Box Truck\', \'Semi\', \'Pickup\') NULL AFTER truck_number' },
          { name: 'assigned_customer_id', sql: 'ALTER TABLE trucks ADD COLUMN assigned_customer_id INT NULL AFTER truck_type' },
          { name: 'status', sql: 'ALTER TABLE trucks ADD COLUMN status ENUM(\'Active\', \'Inactive\') DEFAULT \'Active\' AFTER assigned_customer_id' },
          { name: 'notes', sql: 'ALTER TABLE trucks ADD COLUMN notes TEXT NULL AFTER status' }
        ];

        const [columns] = await pool.execute(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'trucks'`
        );
        const existingCols = columns.map(col => col.COLUMN_NAME);

        for (const col of columnsToAdd) {
          if (!existingCols.includes(col.name)) {
            try {
              await pool.execute(col.sql);
              console.log(`✅ Added missing column: trucks.${col.name}`);
            } catch (addError) {
              console.error(`Error adding column ${col.name}:`, addError.message);
            }
          }
        }

        // Retry the insert
        return createTruck(req, res);
      } catch (retryError) {
        return res.status(500).json({
          success: false,
          message: 'Failed to create truck. Please run ADD_TRUCK_COLUMNS.sql migration.',
          error: error.message
        });
      }
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create truck',
      error: error.message
    });
  }
};

/**
 * Update a truck
 */
const updateTruck = async (req, res) => {
  try {
    const { id } = req.params;
    const { truck_number, truck_type, assigned_customer_id, status, notes } = req.body;
    // Verify truck exists
    const [existing] = await pool.execute(
      'SELECT id FROM trucks WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Truck not found'
      });
    }

    // Check if truck number already exists for another truck
    if (truck_number) {
      const [duplicate] = await pool.execute(
        'SELECT id FROM trucks WHERE truck_number = ? AND id != ?',
        [truck_number.trim(), id]
      );
      if (duplicate.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Truck number already exists'
        });
      }
    }

    // Verify customer exists if assigned
    if (assigned_customer_id) {
      const [customer] = await pool.execute(
        'SELECT id FROM customers WHERE id = ?',
        [assigned_customer_id]
      );
      if (customer.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid customer assignment'
        });
      }
    }

    const updates = [];
    const values = [];

    if (truck_number !== undefined) {
      updates.push('truck_number = ?');
      values.push(truck_number.trim());
    }

    if (truck_type !== undefined) {
      updates.push('truck_type = ?');
      values.push(truck_type);
    }

    if (assigned_customer_id !== undefined) {
      updates.push('assigned_customer_id = ?');
      values.push(assigned_customer_id || null);
    }

    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(id);
    await pool.execute(
      `UPDATE trucks SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    return res.json({
      success: true,
      message: 'Truck updated successfully'
    });
  } catch (error) {
    console.error('Error updating truck:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update truck',
      error: error.message
    });
  }
};

/**
 * Delete a truck
 */
const deleteTruck = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Truck ID is required'
      });
    }

    // Check if truck exists
    const [truck] = await pool.execute(
      'SELECT id, truck_number FROM trucks WHERE id = ?',
      [id]
    );

    if (truck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Truck not found'
      });
    }

    await pool.execute('DELETE FROM trucks WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Truck deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting truck:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete truck',
      error: error.message
    });
  }
};

/**
 * Get all companies
 */
const getAllCompanies = async (req, res) => {
  try {
    const [companies] = await pool.execute(
      'SELECT id, name, created_at, updated_at FROM companies ORDER BY name ASC'
    );

    return res.json({
      success: true,
      data: companies
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch companies',
      error: error.message
    });
  }
};

/**
 * Create a new company
 */
const createCompany = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      });
    }

    // Check if company name already exists
    const [existing] = await pool.execute(
      'SELECT id FROM companies WHERE name = ?',
      [name.trim()]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Company name already exists'
      });
    }

    const [result] = await pool.execute(
      'INSERT INTO companies (name) VALUES (?)',
      [name.trim()]
    );

    return res.status(201).json({
      success: true,
      message: 'Company created successfully',
      data: { id: result.insertId, name: name.trim() }
    });
  } catch (error) {
    console.error('Error creating company:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create company',
      error: error.message
    });
  }
};

/**
 * Update a company
 */
const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      });
    }

    // Check if company exists
    const [existing] = await pool.execute(
      'SELECT id FROM companies WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Check if name already exists for another company
    const [nameExists] = await pool.execute(
      'SELECT id FROM companies WHERE name = ? AND id != ?',
      [name.trim(), id]
    );

    if (nameExists.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Company name already exists'
      });
    }

    await pool.execute(
      'UPDATE companies SET name = ?, updated_at = NOW() WHERE id = ?',
      [name.trim(), id]
    );

    return res.json({
      success: true,
      message: 'Company updated successfully'
    });
  } catch (error) {
    console.error('Error updating company:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update company',
      error: error.message
    });
  }
};

/**
 * Delete a company
 */
const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if company exists
    const [company] = await pool.execute(
      'SELECT id, name FROM companies WHERE id = ?',
      [id]
    );

    if (company.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Check if company has any users/drivers/customers/trucks/tickets
    const [users] = await pool.execute('SELECT COUNT(*) as count FROM users', []);
    const [drivers] = await pool.execute('SELECT COUNT(*) as count FROM drivers', []);
    const [customers] = await pool.execute('SELECT COUNT(*) as count FROM customers', []);
    const [trucks] = await pool.execute('SELECT COUNT(*) as count FROM trucks', []);
    const [tickets] = await pool.execute('SELECT COUNT(*) as count FROM tickets', []);

    const totalRecords = parseInt(users[0].count) + parseInt(drivers[0].count) + parseInt(customers[0].count) + parseInt(trucks[0].count) + parseInt(tickets[0].count);

    if (totalRecords > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete company. It has associated users, drivers, customers, trucks, or tickets. Please delete all associated data first.',
        details: {
          users: parseInt(users[0].count),
          drivers: parseInt(drivers[0].count),
          customers: parseInt(customers[0].count),
          trucks: parseInt(trucks[0].count),
          tickets: parseInt(tickets[0].count)
        }
      });
    }

    await pool.execute('DELETE FROM companies WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Company deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting company:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete company',
      error: error.message
    });
  }
};

module.exports = {
  getAllDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
  getAllCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getAllTickets,
  getTicketById,
  updateTicket,
  updateTicketStatus,
  getDashboardStats,
  generateInvoice,
  downloadInvoice,
  sendInvoiceEmailHandler,
  generateSettlement,
  downloadSettlement,
  getBillRates,
  updateBillRates,
  getAllTrucks,
  createTruck,
  updateTruck,
  deleteTruck,
  getAllCompanies,
  createCompany,
  updateCompany,
  deleteCompany
};

