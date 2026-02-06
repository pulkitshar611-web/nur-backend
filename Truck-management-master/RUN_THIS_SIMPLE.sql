-- ============================================
-- SIMPLE FIX - COPY PASTE THIS IN MYSQL
-- ============================================
-- Step 1: MySQL Workbench ya command line mein yeh script run karo
-- Step 2: Sab columns add ho jayengi

USE truck_management;

-- CUSTOMERS TABLE - Add billing_enabled (YEH MAIN HAI)
-- contact_person
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'contact_person');
SET @sql = IF(@exists = 0, 'ALTER TABLE customers ADD COLUMN contact_person VARCHAR(255) NULL AFTER name', 'SELECT "contact_person exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- phone
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'phone');
SET @sql = IF(@exists = 0, 'ALTER TABLE customers ADD COLUMN phone VARCHAR(20) NULL AFTER contact_person', 'SELECT "phone exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- email
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'email');
SET @sql = IF(@exists = 0, 'ALTER TABLE customers ADD COLUMN email VARCHAR(255) NULL AFTER phone', 'SELECT "email exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_enabled (YEH MAIN HAI - ISKO ADD KARNA HAI)
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'billing_enabled');
SET @sql = IF(@exists = 0, 'ALTER TABLE customers ADD COLUMN billing_enabled BOOLEAN DEFAULT TRUE AFTER email', 'SELECT "billing_enabled exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- status
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'status');
SET @sql = IF(@exists = 0, 'ALTER TABLE customers ADD COLUMN status ENUM(\'Active\', \'Inactive\') DEFAULT \'Active\' AFTER billing_enabled', 'SELECT "status exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Update existing data
UPDATE customers SET billing_enabled = TRUE WHERE billing_enabled IS NULL;
UPDATE customers SET status = 'Active' WHERE status IS NULL;
UPDATE customers SET contact_person = name WHERE contact_person IS NULL;

-- TRUCKS TABLE
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trucks' AND COLUMN_NAME = 'truck_type');
SET @sql = IF(@exists = 0, 'ALTER TABLE trucks ADD COLUMN truck_type ENUM(\'Box Truck\', \'Semi\', \'Pickup\') NULL AFTER truck_number', 'SELECT "truck_type exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trucks' AND COLUMN_NAME = 'assigned_customer_id');
SET @sql = IF(@exists = 0, 'ALTER TABLE trucks ADD COLUMN assigned_customer_id INT NULL AFTER truck_type', 'SELECT "assigned_customer_id exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trucks' AND COLUMN_NAME = 'status');
SET @sql = IF(@exists = 0, 'ALTER TABLE trucks ADD COLUMN status ENUM(\'Active\', \'Inactive\') DEFAULT \'Active\' AFTER assigned_customer_id', 'SELECT "status exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trucks' AND COLUMN_NAME = 'notes');
SET @sql = IF(@exists = 0, 'ALTER TABLE trucks ADD COLUMN notes TEXT NULL AFTER status', 'SELECT "notes exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE trucks SET status = 'Active' WHERE status IS NULL;

SELECT '✅ DONE! Sab columns add ho gaye!' AS Status;
SELECT '✅ billing_enabled column ab available hai!' AS Message;

