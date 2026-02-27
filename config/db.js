/**
 * Database Configuration
 * Creates and exports a MySQL connection pool using mysql2
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool for better performance
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Important for Railway/External Proxy stability
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 20000, // 20 seconds
  ssl: {
    rejectUnauthorized: false
  }
});

// Listener for pool errors to prevent process crash
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// Utility to test connection with retry
const testConnection = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const connection = await pool.getConnection();
      console.log('✅ Database connected successfully');
      connection.release();
      return true;
    } catch (err) {
      console.error(`❌ Connection attempt ${i + 1} failed:`, err.message);
      if (i === retries - 1) throw err;
      // Wait 1s before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};

testConnection().catch(err => {
  console.error('Final database connection failure:', err.message);
});

// Wrapper to handle automatic retries on connection lost
const originalExecute = pool.execute.bind(pool);
const originalQuery = pool.query.bind(pool);

pool.execute = async (...args) => {
  try {
    return await originalExecute(...args);
  } catch (err) {
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
      console.warn('⚠️ Connection lost. Retrying query...');
      return await originalExecute(...args);
    }
    throw err;
  }
};

pool.query = async (...args) => {
  try {
    return await originalQuery(...args);
  } catch (err) {
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
      console.warn('⚠️ Connection lost. Retrying query...');
      return await originalQuery(...args);
    }
    throw err;
  }
};

module.exports = pool;

