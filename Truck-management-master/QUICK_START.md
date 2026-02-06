# Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Create `.env` File
Create a file named `.env` in the `truck-backend` directory with:
```
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=truck_management
JWT_SECRET=change_this_to_a_random_string_at_least_32_characters_long
```

### 3. Create Database
```sql
CREATE DATABASE truck_management;
```

### 4. Import Schema
```bash
mysql -u root -p truck_management < schema.sql
```

### 5. Start Server
```bash
npm run dev
```

## ✅ Verify It Works

Test the health endpoint:
```bash
curl http://localhost:5000/api/health
```

Test admin login:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginType":"admin","email":"admin@m.com","password":"password"}'
```

## 📋 Default Credentials

**Admin:**
- Email: `admin@m.com`
- Password: `password`

**⚠️ Change these in production!**

## 🔗 API Base URL

All API endpoints are prefixed with: `http://localhost:5000/api`

## 📚 Full Documentation

See `README.md` for complete API documentation and `INSTALLATION.md` for detailed setup instructions.

