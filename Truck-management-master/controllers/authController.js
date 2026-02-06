/**
 * Authentication Controller
 * Handles login for Admin (email/password) and Driver (user_id_code/pin)
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * Login handler
 * Supports both Admin (email/password) and Driver (user_id_code/pin) login
 */
const login = async (req, res) => {
  try {
    const { email, password, user_id_code, pin, loginType } = req.body;

    // Determine login type: 'admin' uses email/password, 'driver' uses user_id_code/pin
    if (loginType === 'admin' || email) {
      // Admin login with email and password
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required for admin login'
        });
      }

      // Find user (admin login)
      const roleToCheck = 'admin';
      
      let users;
      try {
        [users] = await pool.execute(
          `SELECT u.id, u.email, u.password, u.role
           FROM users u 
           WHERE u.email = ? AND u.role = ?`,
          [email, roleToCheck]
        );
      } catch (dbError) {
        console.error('Admin login database error:', dbError);
        throw dbError;
      }

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const user = users[0];

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          companyName: 'Noor Trucking Inc.'
        }
      });
    } else if (loginType === 'driver' || user_id_code) {
      // Driver login with user_id_code and PIN
      if (!user_id_code || !pin) {
        return res.status(400).json({
          success: false,
          message: 'User ID code and PIN are required for driver login'
        });
      }

      // Find driver by user_id_code
      let drivers;
      try {
        [drivers] = await pool.execute(
          `SELECT d.id, d.user_id, d.user_id_code, d.name, d.pin, u.role
           FROM drivers d 
           JOIN users u ON d.user_id = u.id 
           WHERE d.user_id_code = ? AND u.role = ?`,
          [user_id_code, 'driver']
        );
      } catch (dbError) {
        console.error('Driver login database error:', dbError);
        throw dbError;
      }

      if (drivers.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid user ID code or PIN'
        });
      }

      const driver = drivers[0];

      // Verify PIN (PIN is stored as hashed string)
      const isPinValid = await bcrypt.compare(pin, driver.pin);
      if (!isPinValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid user ID code or PIN'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: driver.user_id, driverId: driver.id, role: driver.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: driver.user_id,
          driverId: driver.id,
          name: driver.name,
          user_id_code: driver.user_id_code,
          role: driver.role,
          companyName: 'Noor Trucking Inc.'
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid login type. Use email/password for admin or user_id_code/pin for driver'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

module.exports = {
  login
};

