/**
 * Master Data Controller
 * Handles Customer Master, Equipment Type Master, and Truck Number Master
 */

const pool = require('../config/db');

// ========== CUSTOMER MASTER ==========

const getAllCustomerMaster = async (req, res) => {
  try {
    const [customers] = await pool.execute(
      'SELECT * FROM customer_master WHERE status = "Active" ORDER BY customer_name ASC'
    );

    return res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('Error fetching customer master:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch customer master',
      error: error.message
    });
  }
};

const createCustomerMaster = async (req, res) => {
  try {
    const { customer_name, billing_enabled, status } = req.body;

    if (!customer_name) {
      return res.status(400).json({
        success: false,
        message: 'Customer name is required'
      });
    }

    const [result] = await pool.execute(
      'INSERT INTO customer_master (customer_name, billing_enabled, status) VALUES (?, ?, ?)',
      [customer_name.trim(), billing_enabled !== undefined ? billing_enabled : true, status || 'Active']
    );

    return res.status(201).json({
      success: true,
      message: 'Customer added successfully',
      data: { id: result.insertId, customer_name: customer_name.trim(), billing_enabled, status: status || 'Active' }
    });
  } catch (error) {
    console.error('Error creating customer master:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create customer',
      error: error.message
    });
  }
};

const deleteCustomerMaster = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute('DELETE FROM customer_master WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting customer master:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete customer',
      error: error.message
    });
  }
};

// ========== EQUIPMENT TYPE MASTER ==========

const getAllEquipmentTypes = async (req, res) => {
  try {
    // Check if table exists, if not return empty array
    try {
      // Get ALL equipment types (Active and Inactive) for admin page
      const [equipmentTypes] = await pool.execute(
        'SELECT * FROM equipment_type_master ORDER BY equipment_name ASC'
      );

      return res.json({
        success: true,
        data: equipmentTypes || []
      });
    } catch (tableError) {
      // Table doesn't exist, try to create it automatically
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        try {
          // Auto-create table if it doesn't exist
          await pool.execute(`
            CREATE TABLE IF NOT EXISTS equipment_type_master (
              id INT AUTO_INCREMENT PRIMARY KEY,
              equipment_name VARCHAR(255) NOT NULL UNIQUE,
              status ENUM('Active', 'Inactive') DEFAULT 'Active',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
          
          // Insert default equipment types
          await pool.execute(`
            INSERT INTO equipment_type_master (equipment_name, status) VALUES
            ('Tandem', 'Active'),
            ('Tri End Dump', 'Active'),
            ('Livebottom', 'Active'),
            ('Tri Pup', 'Active'),
            ('Super B', 'Active'),
            ('Quad', 'Active')
            ON DUPLICATE KEY UPDATE equipment_name=equipment_name
          `);
          
          // Fetch after creation
          const [equipmentTypes] = await pool.execute(
            'SELECT * FROM equipment_type_master ORDER BY equipment_name ASC'
          );
          
          return res.json({
            success: true,
            data: equipmentTypes || []
          });
        } catch (createError) {
          console.error('Error creating equipment_type_master table:', createError);
          return res.json({
            success: true,
            data: [],
            message: 'Equipment type master table not found. Please run database migration.'
          });
        }
      }
      throw tableError;
    }
  } catch (error) {
    console.error('Error fetching equipment types:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch equipment types',
      error: error.message
    });
  }
};

const createEquipmentType = async (req, res) => {
  try {
    const { equipment_name, status } = req.body;

    if (!equipment_name || equipment_name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Equipment name is required'
      });
    }

    // Check if table exists, if not create it
    try {
      const [result] = await pool.execute(
        'INSERT INTO equipment_type_master (equipment_name, status) VALUES (?, ?)',
        [equipment_name.trim(), status || 'Active']
      );

      return res.status(201).json({
        success: true,
        message: 'Equipment type added successfully',
        data: { id: result.insertId, equipment_name: equipment_name.trim(), status: status || 'Active' }
      });
    } catch (tableError) {
      // Table doesn't exist, create it
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS equipment_type_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            equipment_name VARCHAR(255) NOT NULL UNIQUE,
            status ENUM('Active', 'Inactive') DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // Now insert the equipment type
        const [result] = await pool.execute(
          'INSERT INTO equipment_type_master (equipment_name, status) VALUES (?, ?)',
          [equipment_name.trim(), status || 'Active']
        );

        return res.status(201).json({
          success: true,
          message: 'Equipment type added successfully',
          data: { id: result.insertId, equipment_name: equipment_name.trim(), status: status || 'Active' }
        });
      }
      
      // Duplicate entry error
      if (tableError.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          message: 'Equipment type already exists'
        });
      }
      
      throw tableError;
    }
  } catch (error) {
    console.error('Error creating equipment type:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create equipment type',
      error: error.message
    });
  }
};

const deleteEquipmentType = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute('DELETE FROM equipment_type_master WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Equipment type deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting equipment type:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete equipment type',
      error: error.message
    });
  }
};

// ========== TRUCK NUMBER MASTER ==========

const getAllTruckMaster = async (req, res) => {
  try {
    const [trucks] = await pool.execute(
      'SELECT * FROM truck_master WHERE status = "Active" ORDER BY truck_number ASC'
    );

    return res.json({
      success: true,
      data: trucks
    });
  } catch (error) {
    console.error('Error fetching truck master:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch truck master',
      error: error.message
    });
  }
};

const createTruckMaster = async (req, res) => {
  try {
    const { truck_number, status } = req.body;

    if (!truck_number) {
      return res.status(400).json({
        success: false,
        message: 'Truck number is required'
      });
    }

    // Check if truck number already exists
    const [existing] = await pool.execute(
      'SELECT id FROM truck_master WHERE truck_number = ?',
      [truck_number.trim()]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Truck number already exists'
      });
    }

    const [result] = await pool.execute(
      'INSERT INTO truck_master (truck_number, status) VALUES (?, ?)',
      [truck_number.trim(), status || 'Active']
    );

    return res.status(201).json({
      success: true,
      message: 'Truck number added successfully',
      data: { id: result.insertId, truck_number: truck_number.trim(), status: status || 'Active' }
    });
  } catch (error) {
    console.error('Error creating truck master:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create truck number',
      error: error.message
    });
  }
};

const deleteTruckMaster = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute('DELETE FROM truck_master WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Truck number deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting truck master:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete truck number',
      error: error.message
    });
  }
};

module.exports = {
  getAllCustomerMaster,
  createCustomerMaster,
  deleteCustomerMaster,
  getAllEquipmentTypes,
  createEquipmentType,
  deleteEquipmentType,
  getAllTruckMaster,
  createTruckMaster,
  deleteTruckMaster
};

