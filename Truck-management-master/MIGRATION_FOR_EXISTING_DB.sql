-- =====================================================
-- MIGRATION SCRIPT FOR EXISTING DATABASE
-- =====================================================
-- Ye script sirf EXISTING database ke liye hai
-- Agar aapka database already hai, toh yeh file run karein
-- Agar fresh database banana hai, toh schema.sql use karein
-- =====================================================

-- Step 1: Add equipment_type column (only if not exists)
-- Agar column already hai toh error nahi aayega
SET @dbname = DATABASE();
SET @tablename = 'tickets';
SET @columnname = 'equipment_type';

-- Check if column exists, if not then add it
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT "Column equipment_type already exists" AS Status',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(255) AFTER job_type')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Step 2: Add index for equipment_type (only if not exists)
SET @indexname = 'idx_equipment_type';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (INDEX_NAME = @indexname)
  ) > 0,
  'SELECT "Index idx_equipment_type already exists" AS Status',
  CONCAT('ALTER TABLE ', @tablename, ' ADD INDEX ', @indexname, ' (', @columnname, ')')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Step 3: Create trucks table (if not exists)
CREATE TABLE IF NOT EXISTS trucks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  truck_number VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_truck_number (truck_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 4: Create driver_customers junction table (if not exists)
CREATE TABLE IF NOT EXISTS driver_customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id INT NOT NULL,
  customer_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_driver_customer (driver_id, customer_id),
  INDEX idx_driver_id (driver_id),
  INDEX idx_customer_id (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 5: Insert sample trucks (only if they don't exist)
INSERT INTO trucks (truck_number) VALUES
('TRUCK-001'),
('TRUCK-002'),
('TRUCK-003'),
('TRUCK-004'),
('TRUCK-005')
ON DUPLICATE KEY UPDATE truck_number=truck_number;

-- Success message
SELECT 'Migration completed successfully! All changes have been applied.' AS Status;

