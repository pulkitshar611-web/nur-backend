-- Migration to add 'company' role to users table
-- Run this AFTER COMPANY_MIGRATION.sql if you need to add company role support

-- Step 1: Modify the role ENUM to include 'company'
-- Note: MySQL doesn't support ALTER ENUM directly, so we need to recreate the column

-- First, create a temporary column
ALTER TABLE users ADD COLUMN role_new VARCHAR(20) NOT NULL DEFAULT 'driver';

-- Copy data with validation
UPDATE users SET role_new = role WHERE role IN ('admin', 'driver');

-- Drop old column
ALTER TABLE users DROP COLUMN role;

-- Rename new column
ALTER TABLE users CHANGE COLUMN role_new role VARCHAR(20) NOT NULL;

-- Add check constraint (MySQL 8.0.16+)
ALTER TABLE users ADD CONSTRAINT chk_role CHECK (role IN ('admin', 'driver', 'company'));

-- Add index back
ALTER TABLE users ADD INDEX idx_role (role);

-- Success message
SELECT 'Company role added successfully to users table!' AS Status;

