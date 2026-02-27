/**
 * System Settings Controller
 * Handles company profile and system-wide settings
 * Logo stored as base64 data URL in LONGTEXT column (works on Railway, no file system needed)
 */

const pool = require('../config/db');

// Auto-migrate: ensure company_logo column is LONGTEXT (supports base64 images)
const ensureLogoColumnType = async () => {
  try {
    await pool.execute(`
      ALTER TABLE company_settings
      MODIFY COLUMN company_logo LONGTEXT NULL
    `);
    console.log('[SystemSettings] ✅ Column company_logo ensured as LONGTEXT');
  } catch (err) {
    // Ignore if already correct type or table/column doesn't exist yet
    if (!err.message.includes('Duplicate') && !err.message.includes("doesn't exist")) {
      console.warn('[SystemSettings] ⚠️ Could not alter company_logo column:', err.message);
    }
  }
};

// Run migration with a slight delay to allow pool to settle
setTimeout(() => {
  ensureLogoColumnType();
}, 2000);

// ─── GET system settings ──────────────────────────────────────────────────────
const getSystemSettings = async (req, res) => {
  try {
    const [settings] = await pool.execute(
      'SELECT id, company_name, company_logo, address, phone, email, website FROM company_settings LIMIT 1'
    );

    if (settings.length === 0) {
      // Create default settings if none exist
      await pool.execute(
        'INSERT INTO company_settings (company_name, email) VALUES (?, ?)',
        ['Noor Trucking Inc.', 'accounting@noortruckinginc.com']
      );
      return res.json({
        success: true,
        data: {
          company_name: 'Noor Trucking Inc.',
          email: 'accounting@noortruckinginc.com',
          company_logo: '',
          address: '',
          phone: '',
          website: ''
        }
      });
    }

    return res.json({
      success: true,
      data: settings[0]
    });
  } catch (error) {
    console.error('[SystemSettings] Error fetching settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch system settings',
      error: error.message
    });
  }
};

// ─── PUT update system settings ──────────────────────────────────────────────
const updateSystemSettings = async (req, res) => {
  try {
    const { company_name, company_logo, address, phone, email, website } = req.body;

    if (!company_name) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      });
    }

    // Check if settings row exists
    const [existing] = await pool.execute('SELECT id FROM company_settings LIMIT 1');

    if (existing.length === 0) {
      // Create new settings row
      await pool.execute(
        'INSERT INTO company_settings (company_name, company_logo, address, phone, email, website) VALUES (?, ?, ?, ?, ?, ?)',
        [
          company_name.trim(),
          company_logo || null,
          address || null,
          phone || null,
          email || null,
          website || null
        ]
      );
    } else {
      // Update existing row
      await pool.execute(
        `UPDATE company_settings SET
          company_name = ?,
          company_logo = ?,
          address = ?,
          phone = ?,
          email = ?,
          website = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [
          company_name.trim(),
          company_logo || null,
          address || null,
          phone || null,
          email || null,
          website || null,
          existing[0].id
        ]
      );
    }

    console.log('[SystemSettings] ✅ Company profile updated for:', company_name.trim());

    return res.json({
      success: true,
      message: 'Company profile updated successfully',
      data: { company_name, company_logo, address, phone, email, website }
    });
  } catch (error) {
    console.error('[SystemSettings] Error updating settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update company profile',
      error: error.message
    });
  }
};

module.exports = {
  getSystemSettings,
  updateSystemSettings
};
