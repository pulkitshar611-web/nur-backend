# Truck Management System - Backend API

Complete backend API for the Truck Management System built with Node.js, Express, and MySQL.

## Features

- **Authentication**: JWT-based authentication for Admin and Driver roles
- **Admin Features**:
  - CRUD operations for Drivers
  - CRUD operations for Customers
  - Ticket management with filters
  - Invoice generation
  - Driver settlement generation
  - Dashboard statistics
  - Default bill rate configuration

- **Driver Features**:
  - Dashboard with weekly snapshot
  - Create tickets with photo upload
  - View pay history
  - View own tickets

## Tech Stack

- **Node.js** with Express.js
- **MySQL** database with mysql2 (raw SQL queries, no ORM)
- **JWT** for authentication
- **Multer** for file uploads
- **bcryptjs** for password hashing

## Project Structure

```
truck-backend/
├── config/
│   └── db.js                 # Database connection pool
├── middleware/
│   └── auth.js               # Authentication middleware
├── routes/
│   ├── authRoutes.js         # Authentication routes
│   ├── adminRoutes.js        # Admin routes
│   └── driverRoutes.js       # Driver routes
├── controllers/
│   ├── authController.js     # Authentication logic
│   ├── adminController.js    # Admin operations
│   ├── driverController.js   # Driver operations
│   └── utilsController.js    # Utility functions
├── uploads/                  # Photo uploads directory
├── .env                      # Environment variables
├── package.json
├── schema.sql               # Database schema
└── server.js                 # Main server file
```

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=yourpassword
   DB_NAME=truck_management
   JWT_SECRET=your_jwt_secret_key_here_change_this_in_production
   ```

3. **Create MySQL database:**
   ```sql
   CREATE DATABASE truck_management;
   ```

4. **Run the schema:**
   ```bash
   mysql -u root -p truck_management < schema.sql
   ```
   Or import `schema.sql` using MySQL Workbench or phpMyAdmin.

5. **Create uploads directory:**
   ```bash
   mkdir uploads
   ```

## Running the Server

**Development mode (with nodemon):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login (Admin or Driver)

### Admin Routes (require admin authentication)
- `GET /api/admin/drivers` - Get all drivers
- `POST /api/admin/drivers` - Create driver
- `PUT /api/admin/drivers/:id` - Update driver
- `DELETE /api/admin/drivers/:id` - Delete driver

- `GET /api/admin/customers` - Get all customers
- `POST /api/admin/customers` - Create customer
- `PUT /api/admin/customers/:id` - Update customer
- `DELETE /api/admin/customers/:id` - Delete customer

- `GET /api/admin/tickets` - Get all tickets (with filters)
- `GET /api/admin/tickets/:id` - Get ticket by ID
- `PUT /api/admin/tickets/:id` - Update ticket
- `PUT /api/admin/tickets/:id/status` - Update ticket status

- `GET /api/admin/dashboard/stats` - Get dashboard statistics

- `GET /api/admin/invoices/generate` - Generate invoice
- `GET /api/admin/settlements/generate` - Generate settlement

- `GET /api/admin/settings/bill-rates` - Get bill rates
- `PUT /api/admin/settings/bill-rates` - Update bill rates

### Driver Routes (require driver authentication)
- `GET /api/driver/dashboard` - Get dashboard data
- `GET /api/driver/tickets` - Get my tickets
- `POST /api/driver/tickets` - Create ticket (with photo upload)
- `GET /api/driver/tickets/:id` - Get ticket by ID
- `GET /api/driver/pay` - Get pay history
- `GET /api/driver/customers` - Get customers list

## Authentication

### Admin Login
```json
POST /api/auth/login
{
  "loginType": "admin",
  "email": "admin@m.com",
  "password": "password"
}
```

### Driver Login
```json
POST /api/auth/login
{
  "loginType": "driver",
  "user_id_code": "DRV001",
  "pin": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "admin@m.com",
    "role": "admin"
  }
}
```

**Note:** Include the token in subsequent requests:
```
Authorization: Bearer <token>
```

## Database Schema

### Tables:
- **users**: User accounts (admin and driver)
- **drivers**: Driver information
- **customers**: Customer information with default bill rates
- **tickets**: Work tickets with billing and pay information

See `schema.sql` for complete schema definition.

## File Uploads

Photo uploads are stored in the `uploads/` directory. The API endpoint returns the path relative to the server root (e.g., `/uploads/photo-1234567890.jpg`).

The server serves uploaded files statically at `/uploads/*`.

## Error Handling

All endpoints return consistent error responses:
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error (development only)"
}
```

## Testing

You can test the API using:
- **Postman**
- **curl**
- **Thunder Client** (VS Code extension)
- **Frontend application**

## Notes

- All SQL queries use raw SQL with mysql2 (no ORM)
- Passwords and PINs are hashed using bcryptjs
- JWT tokens expire after 7 days
- Photo uploads are limited to 5MB
- Only image files (jpeg, jpg, png, gif) are allowed for uploads

## Production Considerations

1. Change `JWT_SECRET` to a strong random string
2. Use environment-specific `.env` files
3. Set up proper database backups
4. Configure CORS for specific origins
5. Add rate limiting
6. Set up logging (Winston, Morgan)
7. Use HTTPS
8. Implement proper error logging and monitoring

## License

ISC

