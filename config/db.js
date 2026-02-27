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
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 10 seconds
  connectTimeout: 10000,
  maxIdle: 10,
  idleTimeout: 60000, // 60 seconds
  ssl: {
    rejectUnauthorized: false // Often required for Railway/external connections
  }
});

// Listener for pool errors
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.error('Database connection was closed by server. Pool will attempt to reconnect on next request.');
  }
});

// Test the connection
pool.getConnection()
  .then(connection => {
    console.log('✅ Database connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Initial database connection error:', err.message);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('Tip: The server closed the connection immediately. This might be a firewall or proxy issue.');
    }
  });

module.exports = pool;

