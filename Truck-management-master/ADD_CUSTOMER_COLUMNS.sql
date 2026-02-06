-- ============================================
-- ADD MISSING COLUMNS TO CUSTOMERS TABLE
-- ============================================
-- Ye script customers table mein missing columns add karega

USE truck_management;

-- Add contact_person column (if not exists)
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'customers' 
               AND COLUMN_NAME = 'contact_person');
SET @sql = IF(@exists = 0, 
              'ALTER TABLE customers ADD COLUMN contact_person VARCHAR(255) NULL AFTER name',
              'SELECT "contact_person already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add phone column (if not exists)
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'customers' 
               AND COLUMN_NAME = 'phone');
SET @sql = IF(@exists = 0, 
              'ALTER TABLE customers ADD COLUMN phone VARCHAR(20) NULL AFTER contact_person',
              'SELECT "phone already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add email column (if not exists)
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'customers' 
               AND COLUMN_NAME = 'email');
SET @sql = IF(@exists = 0, 
              'ALTER TABLE customers ADD COLUMN email VARCHAR(255) NULL AFTER phone',
              'SELECT "email already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add billing_enabled column (if not exists)
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'customers' 
               AND COLUMN_NAME = 'billing_enabled');
SET @sql = IF(@exists = 0, 
              'ALTER TABLE customers ADD COLUMN billing_enabled BOOLEAN DEFAULT TRUE AFTER email',
              'SELECT "billing_enabled already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add status column (if not exists)
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'customers' 
               AND COLUMN_NAME = 'status');
SET @sql = IF(@exists = 0, 
              'ALTER TABLE customers ADD COLUMN status ENUM(\'Active\', \'Inactive\') DEFAULT \'Active\' AFTER billing_enabled',
              'SELECT "status already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Update existing customers to have default values
UPDATE customers SET billing_enabled = TRUE WHERE billing_enabled IS NULL;
UPDATE customers SET status = 'Active' WHERE status IS NULL;
UPDATE customers SET contact_person = name WHERE contact_person IS NULL;

SELECT '✅ SUCCESS! All customer columns added!' AS Status;
SELECT '✅ Customers API should work now!' AS Message;

