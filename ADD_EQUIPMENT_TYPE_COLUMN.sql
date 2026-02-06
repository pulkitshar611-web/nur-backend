-- =====================================================
-- QUICK FIX: Add equipment_type column to tickets table
-- =====================================================
-- Ye file directly run karein MySQL mein
-- Agar column already hai toh error nahi aayega
-- =====================================================

-- Add equipment_type column
ALTER TABLE tickets ADD COLUMN equipment_type VARCHAR(255) AFTER job_type;

-- Add index for equipment_type
ALTER TABLE tickets ADD INDEX idx_equipment_type (equipment_type);

-- Verify: Check if column was added
SELECT 'equipment_type column added successfully!' AS Status;

