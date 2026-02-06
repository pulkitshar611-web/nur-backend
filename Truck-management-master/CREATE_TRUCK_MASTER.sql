USE truck_management;

-- Create truck_master table if it doesn't exist
CREATE TABLE IF NOT EXISTS truck_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  truck_number VARCHAR(50) NOT NULL UNIQUE,
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_truck_number (truck_number),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default truck numbers
INSERT INTO truck_master (truck_number, status) VALUES
('9727', 'Active'),
('9728', 'Active'),
('4184', 'Active'),
('6635', 'Active'),
('9780', 'Active'),
('7354', 'Active'),
('7396', 'Active'),
('7860', 'Active')
ON DUPLICATE KEY UPDATE truck_number=truck_number;

SELECT '✅ truck_master table created successfully!' AS Status;
SELECT '✅ Default truck numbers inserted!' AS Message;

