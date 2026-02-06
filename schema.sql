-- Truck Management System Database Schema
-- MySQL Database Schema

-- Create database (uncomment if needed)
-- CREATE DATABASE IF NOT EXISTS truck_management;
-- USE truck_management;

-- Companies table (Multi-tenancy support)
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users table (for authentication)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'driver', 'company') NOT NULL,
  company_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  company_id INT NOT NULL,
  user_id_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  default_pay_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  pin VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_company_user_id_code (company_id, user_id_code),
  INDEX idx_user_id_code (user_id_code),
  INDEX idx_name (name),
  INDEX idx_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  default_bill_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_company_customer (company_id, name),
  INDEX idx_name (name),
  INDEX idx_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trucks table (for truck number dropdown)
CREATE TABLE IF NOT EXISTS trucks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  truck_number VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_company_truck (company_id, truck_number),
  INDEX idx_truck_number (truck_number),
  INDEX idx_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Driver Customers table (junction table for driver-specific customers)
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

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  driver_id INT NOT NULL,
  date DATE NOT NULL,
  truck_number VARCHAR(50),
  customer VARCHAR(255) NOT NULL,
  job_type VARCHAR(255),
  equipment_type VARCHAR(255),
  ticket_number VARCHAR(100) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  photo_path VARCHAR(500),
  bill_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  pay_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_bill DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_pay DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  status ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  INDEX idx_driver_id (driver_id),
  INDEX idx_date (date),
  INDEX idx_customer (customer),
  INDEX idx_ticket_number (ticket_number),
  INDEX idx_status (status),
  INDEX idx_equipment_type (equipment_type),
  INDEX idx_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default company "Noor Trucking Inc."
INSERT INTO companies (name) VALUES ('Noor Trucking Inc.')
ON DUPLICATE KEY UPDATE name=name;

-- Get company ID for sample data
SET @default_company_id = LAST_INSERT_ID();
-- If company already exists, get its ID
SET @default_company_id = (SELECT id FROM companies WHERE name = 'Noor Trucking Inc.' LIMIT 1);

-- Insert sample admin user
-- Password: 'password' (hashed with bcrypt)
-- Hash generated using: bcrypt.hash('password', 10)
-- Default admin credentials: email: admin@m.com, password: password
INSERT INTO users (email, password, role, company_id) VALUES 
('admin@m.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin', @default_company_id)
ON DUPLICATE KEY UPDATE email=email;

-- Insert sample company admin user for "Noor Trucking Inc."
-- Password: 'password' (hashed with bcrypt)
-- Company admin credentials: email: company@noor.com, password: password
INSERT INTO users (email, password, role, company_id) VALUES 
('company@noor.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'company', @default_company_id)
ON DUPLICATE KEY UPDATE email=email;

-- Insert sample customers
INSERT INTO customers (company_id, name, default_bill_rate) VALUES
(@default_company_id, 'Aecon', 135.00),
(@default_company_id, 'PCL Construction', 120.00),
(@default_company_id, 'EllisDon', 110.00),
(@default_company_id, 'GrindStone', 140.00)
ON DUPLICATE KEY UPDATE name=name;

-- Insert sample trucks (you can add more truck numbers as needed)
INSERT INTO trucks (company_id, truck_number) VALUES
(@default_company_id, 'TRUCK-001'),
(@default_company_id, 'TRUCK-002'),
(@default_company_id, 'TRUCK-003'),
(@default_company_id, 'TRUCK-004'),
(@default_company_id, 'TRUCK-005')
ON DUPLICATE KEY UPDATE truck_number=truck_number;

-- Note: The admin password hash above is a placeholder
-- In production, generate a proper hash using bcrypt.hash('password', 10)
-- Example hash for 'password': $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

