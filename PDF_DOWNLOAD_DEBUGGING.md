# PDF Download Error Debugging Guide

## Common Error: "Failed to download invoice PDF"

This guide helps you debug and fix PDF download issues.

## Step 1: Check Browser Console

Open browser DevTools (F12) → Console tab, and look for:
- `[PDF Download]` log messages
- Error messages with details
- Network request status

## Step 2: Check Network Tab

1. Open DevTools → Network tab
2. Click "Download PDF" button
3. Find the request to `/admin/invoices/download/:customerId`
4. Check:
   - **Status Code**: Should be `200` for success
   - **Content-Type**: Should be `application/pdf`
   - **Response**: Should show binary data (not text/JSON)

### If Status is 400 (Bad Request):
- Check request URL parameters
- Verify `startDate` and `endDate` are in `YYYY-MM-DD` format
- Verify `customerId` is a valid number

### If Status is 404 (Not Found):
- Customer doesn't exist, OR
- No approved tickets found for the date range
- Check backend logs for specific message

### If Status is 500 (Server Error):
- Check backend server logs
- Look for `[PDF Download]` error messages
- Verify `pdf-lib` is installed: `npm list pdf-lib`

## Step 3: Check Backend Logs

Look for these log messages in your backend console:

```
[PDF Download] Request received: customerId=X, startDate=YYYY-MM-DD, endDate=YYYY-MM-DD
[PDF Download] Customer found: CustomerName
[PDF Download] Found X tickets
[PDF Download] Totals calculated: subtotal=$X.XX, gst=$X.XX, total=$X.XX
[PDF Download] Starting PDF generation...
[PDF Download] Saving PDF document...
[PDF Download] PDF generated successfully: X bytes
[PDF Download] Sending PDF response: X bytes
```

### Common Backend Errors:

1. **"Customer not found"**
   - Verify customer ID exists in database
   - Check: `SELECT * FROM customers WHERE id = ?`

2. **"No approved tickets found"**
   - Verify tickets exist for customer in date range
   - Check ticket status is 'Approved'
   - Query: `SELECT * FROM tickets WHERE customer = ? AND status = 'Approved' AND date >= ? AND date <= ?`

3. **"PDF bytes are empty"**
   - PDF generation failed silently
   - Check if `pdf-lib` is installed correctly
   - Verify no errors during PDF creation

4. **"Invalid PDF header"**
   - PDF generation returned invalid data
   - Check backend error logs for PDF generation errors

## Step 4: Test Backend Endpoint Directly

### Using curl (Command Line):
```bash
curl -X GET "http://localhost:5000/api/admin/invoices/download/1?startDate=2025-11-01&endDate=2025-11-30" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o test-invoice.pdf \
  -v
```

Check:
- Response headers include `Content-Type: application/pdf`
- File `test-invoice.pdf` is created
- File size > 0 bytes
- File opens correctly in PDF viewer

### Using Postman:
1. Method: GET
2. URL: `http://localhost:5000/api/admin/invoices/download/1?startDate=2025-11-01&endDate=2025-11-30`
3. Headers:
   - `Authorization: Bearer YOUR_JWT_TOKEN`
4. Send request
5. Check:
   - Status: 200 OK
   - Body tab shows binary data
   - Save response as PDF file
   - Verify file opens correctly

## Step 5: Verify Frontend Request

Check the frontend is sending correct request:

```javascript
// Expected request:
GET /admin/invoices/download/1?startDate=2025-11-01&endDate=2025-11-30
Headers:
  Authorization: Bearer <token>
  Cache-Control: no-cache
  Pragma: no-cache
```

## Step 6: Common Fixes

### Fix 1: Missing pdf-lib Package
```bash
cd truck-backend
npm install pdf-lib --save
```

### Fix 2: Invalid Date Format
Ensure dates are in `YYYY-MM-DD` format:
- ✅ Correct: `2025-11-30`
- ❌ Wrong: `11/30/2025` or `30-11-2025`

### Fix 3: Authentication Token Missing
- Verify token exists in `localStorage.getItem('token')`
- Check token hasn't expired
- Verify token is being sent in request headers

### Fix 4: CORS Issues
If you see CORS errors:
- Verify backend CORS is configured correctly
- Check `server.js` has CORS middleware enabled

### Fix 5: Database Connection Issues
- Verify database is running
- Check database connection in `config/db.js`
- Verify customer and ticket data exists

## Step 7: Enable Detailed Logging

Add more logging to backend:

```javascript
// In downloadInvoice function, add:
console.log('[PDF Download] Request params:', { customerId, startDate, endDate });
console.log('[PDF Download] Customer query result:', customers);
console.log('[PDF Download] Tickets query result:', tickets);
console.log('[PDF Download] PDF bytes length:', pdfBytes.length);
console.log('[PDF Download] PDF header:', pdfBytes.slice(0, 10).toString());
```

## Step 8: Test with Minimal Data

Create a test scenario:
1. Ensure at least one customer exists
2. Ensure at least one approved ticket exists for that customer
3. Use a date range that includes that ticket
4. Try downloading PDF

## Quick Checklist

- [ ] Backend server is running (`npm run dev`)
- [ ] Frontend is running (`npm run dev`)
- [ ] Database is connected
- [ ] Customer exists in database
- [ ] Approved tickets exist for customer in date range
- [ ] `pdf-lib` package is installed
- [ ] JWT token is valid and not expired
- [ ] Dates are in `YYYY-MM-DD` format
- [ ] No CORS errors in browser console
- [ ] Network request shows `200 OK` status

## Still Having Issues?

1. **Check browser console** for detailed error messages
2. **Check backend logs** for `[PDF Download]` messages
3. **Test endpoint directly** with curl or Postman
4. **Verify data exists** in database
5. **Check network tab** for request/response details

## Error Message Reference

| Error Message | Cause | Solution |
|--------------|-------|----------|
| "Customer ID, start date, and end date are required" | Missing parameters | Check frontend is sending all required params |
| "Dates must be in YYYY-MM-DD format" | Invalid date format | Format dates correctly before sending |
| "Customer not found" | Invalid customer ID | Verify customer exists in database |
| "No approved tickets found" | No data for date range | Check tickets exist and are approved |
| "Failed to generate PDF: Empty PDF bytes" | PDF generation failed | Check backend logs for PDF errors |
| "Invalid PDF header" | PDF generation returned invalid data | Check pdf-lib installation and backend logs |
| "Network error" | Connection issue | Check backend server is running |
| "Failed to download PDF: 401" | Authentication failed | Check JWT token is valid |
| "Failed to download PDF: 403" | Permission denied | Verify user has admin role |

