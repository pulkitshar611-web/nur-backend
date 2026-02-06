-- ============================================
-- FIX ALL MISSING COLUMNS - CUSTOMERS & TRUCKS
-- ============================================
-- Ye script sab missing columns add karega
-- Run this script in MySQL to fix all column errors

USE truck_management;

-- ============================================
-- CUSTOMERS TABLE - Add Missing Columns
-- ============================================

-- Add contact_person column
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'customers' 
               AND COLUMN_NAME = 'contact_person');
SET @sql = IF(@exists = 0, 
              'ALTER TABLE customers ADD COLUMN contact_person VARCHAR(255) NULL AFTER name',
              'SELECT "contact_person already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add phone column
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'customers' 
               AND COLUMN_NAME = 'phone');
SET @sql = IF(@exists = 0, 
              'ALTER TABLE customers ADD COLUMN phone VARCHAR(20) NULL AFTER contact_person',
              'SELECT "phone already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add email column
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'customers' 
               AND COLUMN_NAME = 'email');
SET @sql = IF(@exists = 0, 
              'ALTER TABLE customers ADD COLUMN email VARCHAR(255) NULL AFTER phone',
              'SELECT "email already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add billing_enabled column (YEH MAIN HAI)
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'customers' 
               AND COLUMN_NAME = 'billing_enabled');
SET @sql = IF(@exists = 0, 
              'ALTER TABLE customers ADD COLUMN billing_enabled BOOLEAN DEFAULT TRUE AFTER email',
              'SELECT "billing_enabled already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add status column
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'customers' 
               AND COLUMN_NAME = 'status');
SET @sql = IF(@exists = 0, 
              'ALTER TABLE customers ADD COLUMN status ENUM(\'Active\', \'Inactive\') DEFAULT \'Active\' AFTER billing_enabled',
              'SELECT "status already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Update existing customers with default values
UPDATE customers SET billing_enabled = TRUE WHERE billing_enabled IS NULL;
UPDATE customers SET status = 'Active' WHERE status IS NULL;
UPDATE customers SET contact_person = name WHERE contact_person IS NULL;

-- ============================================
-- TRUCKS TABLE - Add Missing Columns
-- ============================================

-- Add truck_type column
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'trucks' 
               AND COLUMN_NAME = 'truck_type');
SET @sql = IF(@exists = 0, 
              'ALTER TABLE trucks ADD COLUMN truck_type ENUM(\'Box Truck\', \'Semi\', \'Pickup\') NULL AFTER truck_number',
              'SELECT "truck_type already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add assigned_customer_id column
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'trucks' 
               AND COLUMN_NAME = 'assigned_customer_id');
SET @sql = IF(@exists = 0, 
              'ALTER TABLE trucks ADD COLUMN assigned_customer_id INT NULL AFTER truck_type',
              'SELECT "assigned_customer_id already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add status column
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'trucks' 
               AND COLUMN_NAME = 'status');
SET @sql = IF(@exists = 0, 
              'ALTER TABLE trucks ADD COLUMN status ENUM(\'Active\', \'Inactive\') DEFAULT \'Active\' AFTER assigned_customer_id',
              'SELECT "status already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add notes column
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'trucks' 
               AND COLUMN_NAME = 'notes');
SET @sql = IF(@exists = 0, 
              'ALTER TABLE trucks ADD COLUMN notes TEXT NULL AFTER status',
              'SELECT "notes already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Update existing trucks with default status
UPDATE trucks SET status = 'Active' WHERE status IS NULL;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT '✅ SUCCESS! All missing columns added!' AS Status;
SELECT '✅ Customers table: contact_person, phone, email, billing_enabled, status' AS CustomersColumns;
SELECT '✅ Trucks table: truck_type, assigned_customer_id, status, notes' AS TrucksColumns;
SELECT '✅ Ab sab APIs kaam karengi!' AS Message;

