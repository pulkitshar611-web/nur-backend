/**
 * Setup Script: Create Admin User
 * Run this script to create/update the admin user with proper password hash
 * Usage: node setup-admin.js
 */

const bcrypt = require('bcryptjs');
const pool = require('./config/db');

async function setupAdmin() {
  try {
    const email = 'admin@m.com';
    const password = 'password';
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Generated password hash:', hashedPassword);
    
    // Check if admin exists
    const [users] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length > 0) {
      // Update existing admin
      await pool.execute(
        'UPDATE users SET password = ? WHERE email = ?',
        [hashedPassword, email]
      );
      console.log('✅ Admin user password updated successfully');
    } else {
      // Create new admin
      await pool.execute(
        'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
        [email, hashedPassword, 'admin']
      );
      console.log('✅ Admin user created successfully');
    }
    
    console.log('\nAdmin credentials:');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('\nYou can now login with these credentials.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up admin:', error);
    process.exit(1);
  }
}

setupAdmin();

