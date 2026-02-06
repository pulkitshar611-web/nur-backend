# Installation Guide

## Step-by-Step Setup Instructions

### 1. Install Dependencies

```bash
cd truck-backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `truck-backend` directory:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=truck_management
JWT_SECRET=your_jwt_secret_key_here_change_this_in_production
```

**Important:** 
- Replace `yourpassword` with your MySQL root password
- Replace `your_jwt_secret_key_here_change_this_in_production` with a strong random string (at least 32 characters)

### 3. Create MySQL Database

Open MySQL command line or MySQL Workbench and run:

```sql
CREATE DATABASE truck_management;
```

### 4. Run Database Schema

Import the schema file to create all tables:

**Option A: Using MySQL command line**
```bash
mysql -u root -p truck_management < schema.sql
```

**Option B: Using MySQL Workbench**
1. Open MySQL Workbench
2. Connect to your MySQL server
3. Select the `truck_management` database
4. File → Open SQL Script → Select `schema.sql`
5. Execute the script

**Option C: Copy and paste**
1. Open `schema.sql` file
2. Copy all contents
3. Paste into MySQL Workbench query window
4. Execute

### 5. Setup Admin User (Optional but Recommended)

The schema includes a default admin user, but you can regenerate the password hash:

```bash
node setup-admin.js
```

This will create/update the admin user with:
- **Email:** `admin@m.com`
- **Password:** `password`

**⚠️ Security Note:** Change the default password in production!

### 6. Create Uploads Directory

The uploads directory should already exist, but if not:

**Windows (PowerShell):**
```powershell
New-Item -ItemType Directory -Path uploads -Force
```

**Linux/Mac:**
```bash
mkdir -p uploads
```

### 7. Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:5000`

### 8. Verify Installation

Test the health endpoint:
```bash
curl http://localhost:5000/api/health
```

Or open in browser: `http://localhost:5000/api/health`

You should see:
```json
{
  "status": "OK",
  "message": "Server is running"
}
```

## Testing the API

### Test Admin Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "loginType": "admin",
    "email": "admin@m.com",
    "password": "password"
  }'
```

### Test Driver Login (after creating a driver)

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "loginType": "driver",
    "user_id_code": "DRV001",
    "pin": "1234"
  }'
```

## Troubleshooting

### Database Connection Error

**Error:** `Database connection error: Access denied`

**Solution:**
1. Check your MySQL credentials in `.env`
2. Ensure MySQL server is running
3. Verify database `truck_management` exists

### Port Already in Use

**Error:** `Port 5000 is already in use`

**Solution:**
1. Change `PORT` in `.env` to a different port (e.g., 5001)
2. Or stop the process using port 5000

### Module Not Found

**Error:** `Cannot find module 'express'`

**Solution:**
```bash
npm install
```

### Uploads Directory Error

**Error:** `ENOENT: no such file or directory, open 'uploads/...'`

**Solution:**
```bash
mkdir uploads
```

## Next Steps

1. **Connect Frontend:** Update your frontend API base URL to `http://localhost:5000/api`
2. **Create Drivers:** Use the admin panel to create driver accounts
3. **Create Customers:** Add customers with default bill rates
4. **Test Workflow:** Create tickets, generate invoices, and settlements

## Production Deployment

Before deploying to production:

1. ✅ Change `JWT_SECRET` to a strong random string
2. ✅ Change default admin password
3. ✅ Use environment-specific `.env` files
4. ✅ Set up database backups
5. ✅ Configure CORS for specific origins
6. ✅ Enable HTTPS
7. ✅ Set up error logging and monitoring
8. ✅ Configure rate limiting
9. ✅ Review and update file upload limits
10. ✅ Set up proper file storage (consider cloud storage)

## Support

If you encounter any issues:
1. Check the error logs in the console
2. Verify database connection
3. Ensure all environment variables are set correctly
4. Check that all dependencies are installed

