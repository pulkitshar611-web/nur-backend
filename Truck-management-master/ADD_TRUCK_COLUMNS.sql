-- ============================================
-- ADD MISSING COLUMNS TO TRUCKS TABLE
-- ============================================
-- Ye script trucks table mein missing columns add karega

USE truck_management;

-- Add truck_type column (if not exists)
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'trucks' 
               AND COLUMN_NAME = 'truck_type');
SET @sql = IF(@exists = 0, 
              'ALTER TABLE trucks ADD COLUMN truck_type ENUM(\'Box Truck\', \'Semi\', \'Pickup\') NULL AFTER truck_number',
              'SELECT "truck_type already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add assigned_customer_id column (if not exists)
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'trucks' 
               AND COLUMN_NAME = 'assigned_customer_id');
SET @sql = IF(@exists = 0, 
              'ALTER TABLE trucks ADD COLUMN assigned_customer_id INT NULL AFTER truck_type',
              'SELECT "assigned_customer_id already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add status column (if not exists)
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'trucks' 
               AND COLUMN_NAME = 'status');
SET @sql = IF(@exists = 0, 
              'ALTER TABLE trucks ADD COLUMN status ENUM(\'Active\', \'Inactive\') DEFAULT \'Active\' AFTER assigned_customer_id',
              'SELECT "status already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add notes column (if not exists)
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'trucks' 
               AND COLUMN_NAME = 'notes');
SET @sql = IF(@exists = 0, 
              'ALTER TABLE trucks ADD COLUMN notes TEXT NULL AFTER status',
              'SELECT "notes already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Update existing trucks to have default status
UPDATE trucks SET status = 'Active' WHERE status IS NULL;

SELECT '✅ SUCCESS! All truck columns added!' AS Status;
SELECT '✅ Trucks API should work now!' AS Message;

