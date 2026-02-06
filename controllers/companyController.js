/**
 * Company Controller
 * Handles company admin operations: dashboard, customers, drivers, tickets
 */

const pool = require('../config/db');

/**
 * Get company dashboard statistics
 */
const getDashboardStats = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Unbilled tickets (Pending status)
    const [unbilledResult] = await pool.execute(
      'SELECT COUNT(*) as count FROM tickets WHERE status = ? AND company_id = ?',
      ['Pending', companyId]
    );
    const unbilledTickets = unbilledResult[0].count;

    // Revenue this month (total_bill from approved tickets)
    const [revenueResult] = await pool.execute(
      `SELECT COALESCE(SUM(total_bill), 0) as revenue
       FROM tickets
       WHERE status = 'Approved'
       AND company_id = ?
       AND MONTH(date) = ? AND YEAR(date) = ?`,
      [companyId, currentMonth, currentYear]
    );
    const revenue = parseFloat(revenueResult[0].revenue);

    // Driver pay this month (total_pay from approved tickets)
    const [payResult] = await pool.execute(
      `SELECT COALESCE(SUM(total_pay), 0) as pay
       FROM tickets
       WHERE status = 'Approved'
       AND company_id = ?
       AND MONTH(date) = ? AND YEAR(date) = ?`,
      [companyId, currentMonth, currentYear]
    );
    const driverPay = parseFloat(payResult[0].pay);

    // Estimated profit
    const estimatedProfit = revenue - driverPay;

    // Get total drivers count
    const [driversResult] = await pool.execute(
      'SELECT COUNT(*) as count FROM drivers WHERE company_id = ?',
      [companyId]
    );
    const totalDrivers = driversResult[0].count;

    // Get total customers count
    const [customersResult] = await pool.execute(
      'SELECT COUNT(*) as count FROM customers WHERE company_id = ?',
      [companyId]
    );
    const totalCustomers = customersResult[0].count;

    // Weekly breakdown for chart
    const [weeklyData] = await pool.execute(
      `SELECT 
        WEEK(date, 1) as week,
        COALESCE(SUM(total_bill), 0) as revenue,
        COALESCE(SUM(total_pay), 0) as pay
       FROM tickets
       WHERE status = 'Approved'
       AND company_id = ?
       AND MONTH(date) = ? AND YEAR(date) = ?
       GROUP BY WEEK(date, 1)
       ORDER BY week`,
      [companyId, currentMonth, currentYear]
    );

    return res.json({
      success: true,
      data: {
        unbilledTickets,
        revenue,
        driverPay,
        estimatedProfit,
        totalDrivers,
        totalCustomers,
        weeklyData
      }
    });
  } catch (error) {
    console.error('Error fetching company dashboard stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};

/**
 * Get all customers for company
 */
const getAllCustomers = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const [customers] = await pool.execute(
      'SELECT * FROM customers WHERE company_id = ? ORDER BY name ASC',
      [companyId]
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
 * Create a new customer for company
 */
const createCustomer = async (req, res) => {
  try {
    const { name, default_bill_rate } = req.body;
    const companyId = req.user.companyId;

    if (!name || default_bill_rate === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name and default bill rate are required'
      });
    }

    const [result] = await pool.execute(
      'INSERT INTO customers (company_id, name, default_bill_rate) VALUES (?, ?, ?)',
      [companyId, name, default_bill_rate]
    );

    return res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: { id: result.insertId, name, default_bill_rate }
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
    const { name, default_bill_rate } = req.body;
    const companyId = req.user.companyId;

    // Verify customer belongs to company
    const [existing] = await pool.execute(
      'SELECT id FROM customers WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const updates = [];
    const values = [];

    if (name) {
      updates.push('name = ?');
      values.push(name);
    }

    if (default_bill_rate !== undefined) {
      updates.push('default_bill_rate = ?');
      values.push(default_bill_rate);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(id, companyId);
    await pool.execute(
      `UPDATE customers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND company_id = ?`,
      values
    );

    return res.json({
      success: true,
      message: 'Customer updated successfully'
    });
  } catch (error) {
    console.error('Error updating customer:', error);
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
    const companyId = req.user.companyId;

    await pool.execute('DELETE FROM customers WHERE id = ? AND company_id = ?', [id, companyId]);

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
 * Get all drivers for company
 */
const getAllDrivers = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const [drivers] = await pool.execute(
      `SELECT d.id, d.user_id, d.user_id_code, d.name, d.phone, d.default_pay_rate, u.email, u.created_at
       FROM drivers d
       JOIN users u ON d.user_id = u.id
       WHERE d.company_id = ?
       ORDER BY d.created_at DESC`,
      [companyId]
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
 * Create a new driver for company
 */
const createDriver = async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { user_id_code, name, phone, default_pay_rate, pin } = req.body;
    const companyId = req.user.companyId;

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

    // Check if user_id_code already exists for this company
    const [existing] = await pool.execute(
      'SELECT id FROM drivers WHERE user_id_code = ? AND company_id = ?',
      [user_id_code, companyId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User ID code already exists for this company'
      });
    }

    // Hash PIN
    const hashedPin = await bcrypt.hash(pin, 10);

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Create user account for driver
      const [userResult] = await connection.execute(
        'INSERT INTO users (email, password, role, company_id) VALUES (?, ?, ?, ?)',
        [`driver_${user_id_code}@trucking.com`, hashedPin, 'driver', companyId]
      );

      const userId = userResult.insertId;

      // Create driver record
      await connection.execute(
        `INSERT INTO drivers (user_id, company_id, user_id_code, name, phone, default_pay_rate, pin)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, companyId, user_id_code, name, phone || null, default_pay_rate, hashedPin]
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
    const bcrypt = require('bcryptjs');
    const { id } = req.params;
    const { user_id_code, name, phone, default_pay_rate, pin } = req.body;
    const companyId = req.user.companyId;

    // Check if driver exists and belongs to company
    const [drivers] = await pool.execute(
      'SELECT id, user_id FROM drivers WHERE id = ? AND company_id = ?',
      [id, companyId]
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
      // Check if user_id_code already exists for another driver in same company
      const [existing] = await pool.execute(
        'SELECT id FROM drivers WHERE user_id_code = ? AND id != ? AND company_id = ?',
        [user_id_code, id, companyId]
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

    values.push(id, companyId);
    await pool.execute(
      `UPDATE drivers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND company_id = ?`,
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
    const companyId = req.user.companyId;

    // Get driver info and verify company
    const [drivers] = await pool.execute(
      'SELECT user_id FROM drivers WHERE id = ? AND company_id = ?',
      [id, companyId]
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
 * Get all tickets for company
 */
const getAllTickets = async (req, res) => {
  try {
    const { month, customer, driver, status, search } = req.query;
    const companyId = req.user.companyId;

    let query = `
      SELECT t.*, d.name as driver_name, d.user_id_code, c.name as customer_name
      FROM tickets t
      LEFT JOIN drivers d ON t.driver_id = d.id
      LEFT JOIN customers c ON t.customer = c.name
      WHERE t.company_id = ?
    `;
    const params = [companyId];

    if (month && month.trim() !== '') {
      let monthNum, year;
      
      if (month.includes('-')) {
        const parts = month.split('-');
        if (parts.length === 2 && parts[0] && parts[1]) {
          year = parseInt(parts[0], 10);
          monthNum = parseInt(parts[1], 10);
        }
      } else {
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

    const validParams = params.filter(param => param !== undefined && param !== null);
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

module.exports = {
  getDashboardStats,
  getAllCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getAllDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
  getAllTickets
};

