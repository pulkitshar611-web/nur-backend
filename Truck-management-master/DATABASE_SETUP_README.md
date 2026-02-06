# Database Setup Guide

## 📋 Files Overview

Ab aapke paas sirf **2 SQL files** hain:

### 1. `schema.sql` 
**Kab use karein:** Agar aap **FRESH/NEW database** bana rahe hain
- Complete database schema hai
- Saari tables create karega
- Sample data insert karega
- **Use karein:** Fresh installation ke liye

### 2. `MIGRATION_FOR_EXISTING_DB.sql`
**Kab use karein:** Agar aapka database **ALREADY EXIST** karta hai
- Sirf missing columns/tables add karega
- Safe hai - multiple times run kar sakte hain
- Existing data ko touch nahi karega
- **Use karein:** Existing database update karne ke liye

---

## 🚀 Quick Start Guide

### Scenario 1: Fresh Database Setup
```sql
-- Step 1: MySQL mein database create karein
CREATE DATABASE truck_management;
USE truck_management;

-- Step 2: schema.sql file run karein
-- MySQL Workbench ya phpMyAdmin mein schema.sql ka content paste karein aur execute karein
```

### Scenario 2: Existing Database Update
```sql
-- Step 1: Apna existing database select karein
USE your_existing_database_name;

-- Step 2: MIGRATION_FOR_EXISTING_DB.sql file run karein
-- MySQL Workbench ya phpMyAdmin mein file ka content paste karein aur execute karein
```

---

## ✅ What Gets Added/Updated

### New Tables:
- ✅ `trucks` - Truck numbers ke liye
- ✅ `driver_customers` - Driver-specific customers ke liye

### Updated Tables:
- ✅ `tickets` - `equipment_type` column add hoga

### Sample Data:
- ✅ Sample trucks (TRUCK-001 to TRUCK-005)
- ✅ Sample customers
- ✅ Admin user (email: admin@m.com, password: password)

---

## 🔧 How to Run SQL Files

### Method 1: MySQL Workbench
1. MySQL Workbench open karein
2. Database connect karein
3. File → Open SQL Script → `schema.sql` ya `MIGRATION_FOR_EXISTING_DB.sql` select karein
4. Execute button click karein

### Method 2: phpMyAdmin
1. phpMyAdmin open karein
2. Database select karein
3. SQL tab click karein
4. File ka content copy-paste karein
5. Go button click karein

### Method 3: Command Line
```bash
mysql -u your_username -p your_database_name < schema.sql
# ya
mysql -u your_username -p your_database_name < MIGRATION_FOR_EXISTING_DB.sql
```

---

## ⚠️ Important Notes

1. **Backup lein:** Migration run karne se pehle database ka backup zaroor lein
2. **Existing DB:** Agar existing database hai, toh sirf `MIGRATION_FOR_EXISTING_DB.sql` use karein
3. **Fresh DB:** Agar fresh database hai, toh `schema.sql` use karein
4. **Multiple runs:** `MIGRATION_FOR_EXISTING_DB.sql` safe hai - multiple times run kar sakte hain

---

## 🐛 Troubleshooting

### Error: "Column already exists"
- Matlab column already hai - koi problem nahi
- Migration successfully complete hai

### Error: "Table already exists"
- Matlab table already hai - koi problem nahi
- Migration successfully complete hai

### Error: "Unknown column 'equipment_type'"
- Matlab migration run nahi hui
- `MIGRATION_FOR_EXISTING_DB.sql` run karein

---

## 📞 Need Help?

Agar koi problem aaye toh:
1. Error message check karein
2. Database ka backup hai ya nahi verify karein
3. SQL file ka syntax check karein

