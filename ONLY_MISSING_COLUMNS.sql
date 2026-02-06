-- ============================================
-- ONLY ADD MISSING COLUMNS
-- ============================================
-- Ye script sirf un columns ko add karega jo missing hain
-- Jo already hain unko skip kar dega

USE truck_management;

-- Companies table ensure karo
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO companies (id, name) VALUES (1, 'Noor Trucking Inc.');

-- TICKETS TABLE - YEH MAIN HAI
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'tickets' 
               AND COLUMN_NAME = 'company_id');
               
IF @exists = 0 THEN
  ALTER TABLE tickets ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER id;
  UPDATE tickets SET company_id = 1;
END IF;

-- DRIVERS TABLE
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'drivers' 
               AND COLUMN_NAME = 'company_id');
               
IF @exists = 0 THEN
  ALTER TABLE drivers ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER user_id;
  UPDATE drivers SET company_id = 1;
END IF;

-- CUSTOMERS TABLE
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'customers' 
               AND COLUMN_NAME = 'company_id');
               
IF @exists = 0 THEN
  ALTER TABLE customers ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER id;
  UPDATE customers SET company_id = 1;
END IF;

-- TRUCKS TABLE
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'trucks' 
               AND COLUMN_NAME = 'company_id');
               
IF @exists = 0 THEN
  ALTER TABLE trucks ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER id;
  UPDATE trucks SET company_id = 1;
END IF;

SELECT '✅ Missing columns added successfully!' AS Status;

