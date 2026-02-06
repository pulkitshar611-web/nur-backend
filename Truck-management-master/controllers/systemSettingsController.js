/**
 * System Settings Controller
 * Handles company profile and system-wide settings
 */

const pool = require('../config/db');

// Get system settings
const getSystemSettings = async (req, res) => {
  try {
    // Check if table exists first
    try {
      const [settings] = await pool.execute(
        'SELECT * FROM company_settings LIMIT 1'
      );

      if (settings.length === 0) {
        // Create default settings if none exist
        await pool.execute(
          'INSERT INTO company_settings (company_name) VALUES (?)',
          ['Noor Trucking Inc.']
        );
        return res.json({
          success: true,
          data: { company_name: 'Noor Trucking Inc.' }
        });
      }

      return res.json({
        success: true,
        data: settings[0]
      });
    } catch (tableError) {
      // Table doesn't exist
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        return res.json({
          success: true,
          data: { company_name: 'Noor Trucking Inc.' },
          message: 'Company settings table not found. Please run database migration.'
        });
      }
      throw tableError;
    }
  } catch (error) {
    console.error('Error fetching system settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch system settings',
      error: error.message
    });
  }
};

// Update system settings
const updateSystemSettings = async (req, res) => {
  try {
    const { company_name } = req.body;

    if (!company_name) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      });
    }

    // Check if settings exist
    const [existing] = await pool.execute(
      'SELECT id FROM company_settings LIMIT 1'
    );

    if (existing.length === 0) {
      // Create new settings
      await pool.execute(
        'INSERT INTO company_settings (company_name) VALUES (?)',
        [company_name.trim()]
      );
    } else {
      // Update existing settings
      await pool.execute(
        'UPDATE company_settings SET company_name = ?, updated_at = NOW() WHERE id = ?',
        [company_name.trim(), existing[0].id]
      );
    }

    return res.json({
      success: true,
      message: 'System settings updated successfully',
      data: { company_name: company_name.trim() }
    });
  } catch (error) {
    console.error('Error updating system settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update system settings',
      error: error.message
    });
  }
};

module.exports = {
  getSystemSettings,
  updateSystemSettings
};

