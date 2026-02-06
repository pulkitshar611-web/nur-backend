/**
 * Utils Controller
 * Shared utility functions and endpoints
 */

const pool = require('../config/db');

/**
 * Get all customers (public endpoint for dropdowns)
 */
const getCustomers = async (req, res) => {
  try {
    const [customers] = await pool.execute(
      'SELECT id, name, default_bill_rate FROM customers ORDER BY name ASC'
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
 * Get all drivers (for admin dropdowns)
 */
const getDrivers = async (req, res) => {
  try {
    const [drivers] = await pool.execute(
      'SELECT id, name, user_id_code FROM drivers ORDER BY name ASC'
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

module.exports = {
  getCustomers,
  getDrivers
};

