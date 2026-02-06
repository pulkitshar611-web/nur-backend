/**
 * Authentication Middleware
 * Verifies JWT token and checks user role
 */

const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * Middleware to verify JWT token
 * Extracts token from Authorization header and verifies it
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Authorization header must be: Bearer <token>'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database to ensure they still exist
    const [users] = await pool.execute(
      'SELECT id, email, role, company_id FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Use company_id from token if available, otherwise from database
    const companyId = decoded.companyId || users[0].company_id;

    // Attach user info to request
    req.user = {
      id: users[0].id,
      email: users[0].email,
      role: users[0].role,
      companyId: companyId,
      driverId: decoded.driverId || null
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message
    });
  }
};

/**
 * Middleware to check if user is admin
 * Must be used after authenticate middleware
 */
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin role required.'
    });
  }
};

/**
 * Middleware to check if user is company admin
 * Must be used after authenticate middleware
 */
const isCompany = (req, res, next) => {
  if (req.user && req.user.role === 'company') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Company admin role required.'
    });
  }
};

/**
 * Middleware to check if user is admin or company
 * Must be used after authenticate middleware
 */
const isAdminOrCompany = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'company')) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Company admin role required.'
    });
  }
};

/**
 * Middleware to check if user is driver
 * Must be used after authenticate middleware
 */
const isDriver = (req, res, next) => {
  if (req.user && req.user.role === 'driver') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Driver role required.'
    });
  }
};

module.exports = {
  authenticate,
  isAdmin,
  isDriver,
  isCompany,
  isAdminOrCompany
};

