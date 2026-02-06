-- Migration Script for Customer and Truck Management Updates
-- This script adds new fields to customers and trucks tables

-- ============================================
-- CUSTOMERS TABLE UPDATES
-- ============================================

-- Add contact_person column to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255) NULL AFTER name;

-- Add phone column to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NULL AFTER contact_person;

-- Add email column to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL AFTER phone;

-- Add billing_enabled column to customers table (default: true)
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS billing_enabled BOOLEAN DEFAULT TRUE AFTER email;

-- Add status column to customers table (default: 'Active')
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS status ENUM('Active', 'Inactive') DEFAULT 'Active' AFTER billing_enabled;

-- Update existing customers to have default values
UPDATE customers 
SET contact_person = name 
WHERE contact_person IS NULL;

UPDATE customers 
SET billing_enabled = TRUE 
WHERE billing_enabled IS NULL;

UPDATE customers 
SET status = 'Active' 
WHERE status IS NULL;

-- ============================================
-- TRUCKS TABLE UPDATES
-- ============================================

-- Add truck_type column to trucks table
ALTER TABLE trucks 
ADD COLUMN IF NOT EXISTS truck_type ENUM('Box Truck', 'Semi', 'Pickup') NULL AFTER truck_number;

-- Add assigned_customer_id column to trucks table (FK to customers)
ALTER TABLE trucks 
ADD COLUMN IF NOT EXISTS assigned_customer_id INT NULL AFTER truck_type;

-- Add status column to trucks table (default: 'Active')
ALTER TABLE trucks 
ADD COLUMN IF NOT EXISTS status ENUM('Active', 'Inactive') DEFAULT 'Active' AFTER assigned_customer_id;

-- Add notes column to trucks table
ALTER TABLE trucks 
ADD COLUMN IF NOT EXISTS notes TEXT NULL AFTER status;

-- Add foreign key constraint for assigned_customer_id
-- First, check if the foreign key already exists
SET @fk_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'trucks' 
  AND CONSTRAINT_NAME = 'fk_trucks_customer'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE trucks ADD CONSTRAINT fk_trucks_customer FOREIGN KEY (assigned_customer_id) REFERENCES customers(id) ON DELETE SET NULL',
  'SELECT "Foreign key fk_trucks_customer already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing trucks to have default status
UPDATE trucks 
SET status = 'Active' 
WHERE status IS NULL;

-- Add indexes for better performance
ALTER TABLE customers ADD INDEX IF NOT EXISTS idx_billing_enabled (billing_enabled);
ALTER TABLE customers ADD INDEX IF NOT EXISTS idx_status (status);
ALTER TABLE trucks ADD INDEX IF NOT EXISTS idx_truck_type (truck_type);
ALTER TABLE trucks ADD INDEX IF NOT EXISTS idx_assigned_customer (assigned_customer_id);
ALTER TABLE trucks ADD INDEX IF NOT EXISTS idx_truck_status (status);

-- Success message
SELECT 'Migration completed successfully! Customer and Truck tables have been updated.' AS Status;

