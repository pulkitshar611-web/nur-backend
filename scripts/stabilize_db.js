/**
 * DATABASE STABILIZATION SCRIPT
 * Run this to ensure all tables, constraints and basic data are present.
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
});

async function stabilizeDB() {
    const connection = await pool.getConnection();
    try {
        console.log('--- STARTING DATABASE STABILIZATION ---');
        await connection.query('SET FOREIGN_KEY_CHECKS = 0;');

        // 1. Create independent tables
        console.log('Ensuring core tables exist...');

        // Companies
        await connection.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id int(11) NOT NULL AUTO_INCREMENT,
        name varchar(255) NOT NULL,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        deleted_at timestamp NULL DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_company_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // Company Settings
        await connection.query(`
      CREATE TABLE IF NOT EXISTS company_settings (
        id int(11) NOT NULL AUTO_INCREMENT,
        company_name varchar(255) NOT NULL,
        company_logo longtext DEFAULT NULL,
        address text DEFAULT NULL,
        phone varchar(50) DEFAULT NULL,
        email varchar(255) DEFAULT NULL,
        website varchar(255) DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        deleted_at timestamp NULL DEFAULT NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // Users
        await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id int(11) NOT NULL AUTO_INCREMENT,
        email varchar(255) NOT NULL,
        password varchar(255) NOT NULL,
        role enum('admin','driver') NOT NULL,
        company_id int(11) NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        deleted_at timestamp NULL DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_user_email (email),
        KEY idx_user_company_id (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // Customers
        await connection.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id int(11) NOT NULL AUTO_INCREMENT,
        name varchar(255) NOT NULL,
        contact_person varchar(255) DEFAULT NULL,
        phone varchar(20) DEFAULT NULL,
        email varchar(255) DEFAULT NULL,
        gst_number varchar(50) DEFAULT NULL,
        billing_enabled tinyint(1) DEFAULT 1,
        status enum('Active','Inactive') DEFAULT 'Active',
        default_bill_rate decimal(10,2) NOT NULL DEFAULT 0.00,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        deleted_at timestamp NULL DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_customer_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // Invoices
        await connection.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id int(11) NOT NULL AUTO_INCREMENT,
        company_id int(11) NOT NULL DEFAULT 1,
        customer_id int(11) NOT NULL,
        invoice_number varchar(100) NOT NULL,
        invoice_date date NOT NULL,
        due_date date DEFAULT NULL,
        subtotal decimal(12,2) NOT NULL DEFAULT 0.00,
        tax_rate decimal(5,2) NOT NULL DEFAULT 0.00,
        tax_amount decimal(12,2) NOT NULL DEFAULT 0.00,
        total_amount decimal(12,2) NOT NULL DEFAULT 0.00,
        amount_paid decimal(12,2) NOT NULL DEFAULT 0.00,
        balance_due decimal(12,2) NOT NULL DEFAULT 0.00,
        status enum('Draft','Sent','Partially Paid','Paid','Overdue','Cancelled') NOT NULL DEFAULT 'Draft',
        notes text DEFAULT NULL,
        created_by int(11) DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        deleted_at timestamp NULL DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_invoice_number (invoice_number),
        KEY idx_invoice_customer_id (customer_id),
        KEY idx_invoice_company_id (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // Invoice Items
        await connection.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id int(11) NOT NULL AUTO_INCREMENT,
        invoice_id int(11) NOT NULL,
        ticket_id int(11) DEFAULT NULL,
        description varchar(500) NOT NULL,
        quantity decimal(10,2) NOT NULL DEFAULT 1.00,
        unit_price decimal(12,2) NOT NULL DEFAULT 0.00,
        total decimal(12,2) NOT NULL DEFAULT 0.00,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        deleted_at timestamp NULL DEFAULT NULL,
        PRIMARY KEY (id),
        KEY idx_ii_invoice_id (invoice_id),
        KEY idx_ii_ticket_id (ticket_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // Payments
        await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id int(11) NOT NULL AUTO_INCREMENT,
        company_id int(11) NOT NULL DEFAULT 1,
        customer_id int(11) NOT NULL,
        payment_date date NOT NULL,
        amount decimal(12,2) NOT NULL DEFAULT 0.00,
        payment_method enum('Cheque','Bank Transfer','Cash','Credit Card','Other') NOT NULL DEFAULT 'Cheque',
        reference_number varchar(255) DEFAULT NULL,
        notes text DEFAULT NULL,
        received_by int(11) DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        deleted_at timestamp NULL DEFAULT NULL,
        PRIMARY KEY (id),
        KEY idx_payment_customer_id (customer_id),
        KEY idx_payment_company_id (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // Invoice Payments (Junction)
        await connection.query(`
      CREATE TABLE IF NOT EXISTS invoice_payments (
        id int(11) NOT NULL AUTO_INCREMENT,
        invoice_id int(11) NOT NULL,
        payment_id int(11) NOT NULL,
        amount_applied decimal(12,2) NOT NULL DEFAULT 0.00,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        deleted_at timestamp NULL DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_invoice_payment (invoice_id, payment_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // Attachments
        await connection.query(`
      CREATE TABLE IF NOT EXISTS attachments (
        id int(11) NOT NULL AUTO_INCREMENT,
        related_table varchar(100) NOT NULL,
        related_id int(11) NOT NULL,
        file_name varchar(500) NOT NULL,
        file_path varchar(1000) NOT NULL,
        file_type varchar(100) DEFAULT NULL,
        file_size int(11) DEFAULT NULL,
        uploaded_by int(11) DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        deleted_at timestamp NULL DEFAULT NULL,
        PRIMARY KEY (id),
        KEY idx_attach_related (related_table, related_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // Change Logs
        await connection.query(`
      CREATE TABLE IF NOT EXISTS change_logs (
        id int(11) NOT NULL AUTO_INCREMENT,
        table_name varchar(100) NOT NULL,
        record_id int(11) NOT NULL,
        action enum('INSERT','UPDATE','DELETE','SOFT_DELETE','RESTORE') NOT NULL,
        field_name varchar(100) DEFAULT NULL,
        old_value text DEFAULT NULL,
        new_value text DEFAULT NULL,
        changed_by int(11) DEFAULT NULL,
        changed_at timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id),
        KEY idx_cl_table_record (table_name, record_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // 2. Add Foreign Keys (Safe approach - check existence first)
        console.log('Ensuring foreign keys...');

        const addFK = async (table, constraint, definition) => {
            const [rows] = await connection.query(`
            SELECT CONSTRAINT_NAME 
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
            WHERE TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND TABLE_SCHEMA = DATABASE()
        `, [table, constraint]);

            if (rows.length === 0) {
                try {
                    await connection.query(`ALTER TABLE ${table} ADD CONSTRAINT ${constraint} ${definition}`);
                    console.log(`Added FK: ${constraint} to ${table}`);
                } catch (e) {
                    console.error(`Failed to add FK ${constraint}:`, e.message);
                }
            }
        };

        await addFK('users', 'fk_users_company', 'FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE RESTRICT ON UPDATE CASCADE');
        await addFK('invoices', 'fk_invoice_customer', 'FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT ON UPDATE CASCADE');
        await addFK('invoice_items', 'fk_ii_invoice', 'FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE RESTRICT ON UPDATE CASCADE');
        await addFK('invoice_payments', 'fk_ip_invoice', 'FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE RESTRICT ON UPDATE CASCADE');
        await addFK('invoice_payments', 'fk_ip_payment', 'FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE RESTRICT ON UPDATE CASCADE');

        // 3. Ensure Company Settings Data
        console.log('Ensuring company settings data...');
        const [compRows] = await connection.query('SELECT id FROM company_settings LIMIT 1');
        if (compRows.length === 0) {
            await connection.query(`
            INSERT INTO company_settings (company_name, email, address, phone, website)
            VALUES ('Noor Trucking Inc.', 'accounting@noortruckinginc.com', '123 Main Street, Edmonton, AB T5J 0N3', '+1 (780) 555-0100', 'https://www.noortruckinginc.com')
        `);
        } else {
            // Force correct accounting email
            await connection.query(`UPDATE company_settings SET email = 'accounting@noortruckinginc.com' WHERE id > 0`);
        }

        await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
        console.log('--- DATABASE STABILIZATION COMPLETE ---');
    } catch (err) {
        console.error('STABILIZATION FAILED:', err);
    } finally {
        connection.release();
        process.exit();
    }
}

stabilizeDB();
