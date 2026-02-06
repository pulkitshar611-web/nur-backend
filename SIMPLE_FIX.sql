-- ============================================
-- SIMPLE FIX: Add company_id to tickets table
-- ============================================
-- Copy and paste this directly into MySQL

USE truck_management;

-- Create companies table if needed
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO companies (id, name) VALUES (1, 'Noor Trucking Inc.');

-- Add company_id to tickets table
ALTER TABLE tickets ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER id;
UPDATE tickets SET company_id = 1;

-- Add company_id to other tables if they don't have it
ALTER TABLE users ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER role;
UPDATE users SET company_id = 1;

ALTER TABLE drivers ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER user_id;
UPDATE drivers SET company_id = 1;

ALTER TABLE customers ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER id;
UPDATE customers SET company_id = 1;

ALTER TABLE trucks ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER id;
UPDATE trucks SET company_id = 1;

SELECT '✅ All company_id columns added!' AS Status;

