# Settlements API Documentation

## Overview

Settlements are **generated dynamically** from tickets in the database. There is no `settlements` table - settlements are calculated on-demand based on driver ID and date range.

---

## Endpoints

### 1. Generate Settlement (Preview)

**Endpoint:** `GET /api/admin/settlements/generate`

**Description:** Generates settlement data for preview in the UI. Returns JSON with ticket details and totals.

**Query Parameters:**
- `driverId` (required): Driver ID (integer)
- `startDate` (required): Start date in `YYYY-MM-DD` format
- `endDate` (required): End date in `YYYY-MM-DD` format

**Example Request:**
```
GET /api/admin/settlements/generate?driverId=1&startDate=2025-11-01&endDate=2025-11-30
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "driver": {
      "id": 1,
      "name": "John Doe",
      "user_id_code": "DRV001"
    },
    "startDate": "2025-11-01",
    "endDate": "2025-11-30",
    "tickets": [...],
    "totalPay": 4500.00
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Start date is required (format: YYYY-MM-DD)",
  "missing": "startDate"
}
```

---

### 2. Download Settlement PDF

**Endpoint:** `GET /api/admin/settlements/download/:driverId`

**Description:** Downloads settlement as PDF file. Requires driver ID in URL path and date range as query parameters.

**URL Parameters:**
- `driverId` (required): Driver ID (integer) - in URL path

**Query Parameters:**
- `startDate` (required): Start date in `YYYY-MM-DD` format
- `endDate` (required): End date in `YYYY-MM-DD` format

**Example Request:**
```
GET /api/admin/settlements/download/1?startDate=2025-11-01&endDate=2025-11-30
```

**Success Response (200):**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename=STMT-{driverId}-{startDate}-{endDate}.pdf`
- Body: PDF file binary data

**Error Response (400):**
```json
{
  "success": false,
  "message": "Start date and end date are required as query parameters. Format: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD",
  "required": {
    "driverId": "URL path parameter (e.g., /settlements/download/1)",
    "startDate": "Query parameter in YYYY-MM-DD format",
    "endDate": "Query parameter in YYYY-MM-DD format"
  }
}
```

---

## Important Notes

1. **No Settlement Storage**: Settlements are not stored in the database. They are generated dynamically from tickets.

2. **Required Parameters**: Both endpoints require all three parameters:
   - Driver ID
   - Start Date (YYYY-MM-DD)
   - End Date (YYYY-MM-DD)

3. **Date Format**: Dates must be in `YYYY-MM-DD` format (ISO 8601 date format).

4. **Frontend Integration**: The frontend automatically sends all required parameters when generating or downloading settlements.

---

## Testing in Postman

### Generate Settlement:
```
GET {{baseUrl}}/admin/settlements/generate?driverId=1&startDate=2025-11-01&endDate=2025-11-30
Headers:
  Authorization: Bearer {{adminToken}}
```

### Download Settlement PDF:
```
GET {{baseUrl}}/admin/settlements/download/1?startDate=2025-11-01&endDate=2025-11-30
Headers:
  Authorization: Bearer {{adminToken}}
```

**Note:** Make sure to include query parameters (`?startDate=...&endDate=...`) when testing the download endpoint!

