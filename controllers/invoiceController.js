/**
 * Invoice Controller
 * Full CRUD for invoices, invoice_items, payments, invoice_payments
 * Safe PATCH updates — no destructive overwrites
 * All deletes = soft delete (deleted_at)
 */

const pool = require('../config/db');

// ─────────────────────────────────────────────────────────
// AUDIT HELPER — logs every change to change_logs table
// ─────────────────────────────────────────────────────────
const logChange = async (conn, tableName, recordId, action, fieldName, oldValue, newValue, changedBy) => {
    try {
        await conn.execute(
            `INSERT INTO change_logs (table_name, record_id, action, field_name, old_value, new_value, changed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [tableName, recordId, action, fieldName || null,
                oldValue !== undefined && oldValue !== null ? String(oldValue) : null,
                newValue !== undefined && newValue !== null ? String(newValue) : null,
                changedBy || null]
        );
    } catch (err) {
        // Audit failure should NOT break main operation
        console.error('[AuditLog] Failed to write change log:', err.message);
    }
};

// ─────────────────────────────────────────────────────────
// INVOICE — Generate next invoice number
// ─────────────────────────────────────────────────────────
const generateInvoiceNumber = async (conn) => {
    const [rows] = await conn.execute(
        `SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1`
    );
    if (rows.length === 0) return 'INV-0001';
    const last = rows[0].invoice_number;
    const match = last.match(/(\d+)$/);
    if (!match) return 'INV-0001';
    const next = parseInt(match[1], 10) + 1;
    return `INV-${String(next).padStart(4, '0')}`;
};

// ─────────────────────────────────────────────────────────
// GET ALL INVOICES
// GET /api/admin/invoices
// ─────────────────────────────────────────────────────────
const getAllInvoices = async (req, res) => {
    try {
        const { status, customer_id, startDate, endDate } = req.query;

        let query = `
      SELECT
        i.id, i.invoice_number, i.invoice_date, i.due_date,
        i.subtotal, i.tax_rate, i.tax_amount, i.total_amount,
        i.amount_paid, i.balance_due, i.status, i.notes,
        i.created_at, i.updated_at,
        c.id   AS customer_id,
        c.name AS customer_name,
        c.email AS customer_email,
        c.gst_number AS customer_gst
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.deleted_at IS NULL
    `;
        const params = [];

        if (status && status !== 'All') {
            query += ` AND i.status = ?`;
            params.push(status);
        }
        if (customer_id) {
            query += ` AND i.customer_id = ?`;
            params.push(customer_id);
        }
        if (startDate) {
            query += ` AND i.invoice_date >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND i.invoice_date <= ?`;
            params.push(endDate);
        }

        query += ` ORDER BY i.invoice_date DESC, i.id DESC`;

        const [invoices] = await pool.execute(query, params);

        return res.json({ success: true, data: invoices });
    } catch (error) {
        console.error('[getAllInvoices]', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch invoices', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────
// GET SINGLE INVOICE (with line items + payments)
// GET /api/admin/invoices/:id
// ─────────────────────────────────────────────────────────
const getInvoiceById = async (req, res) => {
    try {
        const { id } = req.params;

        // Invoice header
        const [invoices] = await pool.execute(
            `SELECT i.*, c.name AS customer_name, c.email AS customer_email, c.gst_number AS customer_gst,
              c.phone AS customer_phone, c.contact_person
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       WHERE i.id = ? AND i.deleted_at IS NULL`,
            [id]
        );

        if (invoices.length === 0) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        // Line items
        const [items] = await pool.execute(
            `SELECT ii.*, t.ticket_number
       FROM invoice_items ii
       LEFT JOIN tickets t ON ii.ticket_id = t.id
       WHERE ii.invoice_id = ? AND ii.deleted_at IS NULL
       ORDER BY ii.id ASC`,
            [id]
        );

        // Payments applied
        const [payments] = await pool.execute(
            `SELECT p.*, ip.amount_applied
       FROM invoice_payments ip
       JOIN payments p ON ip.payment_id = p.id
       WHERE ip.invoice_id = ? AND ip.deleted_at IS NULL AND p.deleted_at IS NULL
       ORDER BY p.payment_date DESC`,
            [id]
        );

        return res.json({
            success: true,
            data: {
                ...invoices[0],
                items,
                payments
            }
        });
    } catch (error) {
        console.error('[getInvoiceById]', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch invoice', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────
// CREATE INVOICE
// POST /api/admin/invoices
// Body: { customer_id, invoice_date, due_date, tax_rate, notes, items: [{description, quantity, unit_price, ticket_id?}] }
// ─────────────────────────────────────────────────────────
const createInvoice = async (req, res) => {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
        const { customer_id, due_date, tax_rate = 5, notes, items = [], ticket_ids = [] } = req.body;
        const invoice_date = req.body.invoice_date || req.body.issue_date;
        const changedBy = req.user?.id || null;

        // Validation
        if (!customer_id || !invoice_date) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ success: false, message: 'customer_id and invoice_date are required' });
        }

        // Verify customer exists
        const [custCheck] = await conn.execute(
            'SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL', [customer_id]
        );
        if (custCheck.length === 0) {
            await conn.rollback();
            conn.release();
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        // Generate invoice number
        const invoiceNumber = await generateInvoiceNumber(conn);

        // Calculate totals from items
        let subtotal = 0;
        for (const item of items) {
            const qty = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.unit_price) || 0;
            subtotal += qty * price;
        }
        const taxAmount = subtotal * (parseFloat(tax_rate) / 100);
        const totalAmount = subtotal + taxAmount;

        // Insert invoice header
        const [invoiceResult] = await conn.execute(
            `INSERT INTO invoices
         (company_id, customer_id, invoice_number, invoice_date, due_date,
          subtotal, tax_rate, tax_amount, total_amount, amount_paid, balance_due,
          status, notes, created_by)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'Draft', ?, ?)`,
            [customer_id, invoiceNumber, invoice_date, due_date || null,
                subtotal, tax_rate, taxAmount, totalAmount, totalAmount, notes || null, changedBy]
        );

        const invoiceId = invoiceResult.insertId;

        // Insert line items
        for (const item of items) {
            const qty = parseFloat(item.quantity) || 1;
            const price = parseFloat(item.unit_price) || 0;
            const total = qty * price;

            await conn.execute(
                `INSERT INTO invoice_items (invoice_id, ticket_id, description, quantity, unit_price, total)
         VALUES (?, ?, ?, ?, ?, ?)`,
                [invoiceId, item.ticket_id || null, item.description, qty, price, total]
            );

            // Mark ticket as invoiced if ticket_id provided
            if (item.ticket_id) {
                await conn.execute(
                    `UPDATE tickets SET invoiced = 1, invoice_id = ?, updated_at = NOW()
           WHERE id = ? AND deleted_at IS NULL`,
                    [invoiceId, item.ticket_id]
                );
            }
        }

        // Audit log
        await logChange(conn, 'invoices', invoiceId, 'INSERT', null, null, 'Invoice created', changedBy);

        await conn.commit();
        conn.release();

        return res.status(201).json({
            success: true,
            message: 'Invoice created successfully',
            data: { id: invoiceId, invoice_number: invoiceNumber, total_amount: totalAmount }
        });
    } catch (error) {
        await conn.rollback();
        conn.release();
        console.error('[createInvoice]', error);
        return res.status(500).json({ success: false, message: 'Failed to create invoice', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────
// UPDATE INVOICE (SAFE PATCH — never overwrites with null)
// PUT /api/admin/invoices/:id
// ─────────────────────────────────────────────────────────
const updateInvoice = async (req, res) => {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
        const { id } = req.params;
        const changedBy = req.user?.id || null;

        // Load existing record first
        const [existing] = await conn.execute(
            'SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
            [id]
        );
        if (existing.length === 0) {
            await conn.rollback();
            conn.release();
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        const current = existing[0];
        const { customer_id, invoice_date, due_date, tax_rate, notes, status } = req.body;

        // PATCH logic — only update fields that were explicitly sent
        const updates = [];
        const values = [];
        const auditFields = [];

        if (customer_id !== undefined && customer_id !== current.customer_id) {
            // Verify customer
            const [c] = await conn.execute('SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL', [customer_id]);
            if (c.length === 0) {
                await conn.rollback(); conn.release();
                return res.status(404).json({ success: false, message: 'Customer not found' });
            }
            updates.push('customer_id = ?'); values.push(customer_id);
            auditFields.push({ field: 'customer_id', old: current.customer_id, new: customer_id });
        }

        if (invoice_date !== undefined && invoice_date !== current.invoice_date) {
            updates.push('invoice_date = ?'); values.push(invoice_date);
            auditFields.push({ field: 'invoice_date', old: current.invoice_date, new: invoice_date });
        }

        if (due_date !== undefined) {
            updates.push('due_date = ?'); values.push(due_date || null);
            if (due_date !== current.due_date) auditFields.push({ field: 'due_date', old: current.due_date, new: due_date });
        }

        if (tax_rate !== undefined) {
            const newTax = parseFloat(tax_rate);
            updates.push('tax_rate = ?'); values.push(newTax);
            if (newTax !== parseFloat(current.tax_rate)) auditFields.push({ field: 'tax_rate', old: current.tax_rate, new: newTax });
        }

        if (notes !== undefined) {
            updates.push('notes = ?'); values.push(notes || null);
        }

        if (status !== undefined && status !== current.status) {
            const validStatuses = ['Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'];
            if (!validStatuses.includes(status)) {
                await conn.rollback(); conn.release();
                return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
            }
            updates.push('status = ?'); values.push(status);
            auditFields.push({ field: 'status', old: current.status, new: status });
        }

        if (updates.length === 0) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        updates.push('updated_at = NOW()');
        values.push(id);

        await conn.execute(`UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`, values);

        // Write audit logs for each changed field
        for (const af of auditFields) {
            await logChange(conn, 'invoices', id, 'UPDATE', af.field, af.old, af.new, changedBy);
        }

        await conn.commit();
        conn.release();

        return res.json({ success: true, message: 'Invoice updated successfully' });
    } catch (error) {
        await conn.rollback();
        conn.release();
        console.error('[updateInvoice]', error);
        return res.status(500).json({ success: false, message: 'Failed to update invoice', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────
// SOFT DELETE INVOICE
// DELETE /api/admin/invoices/:id
// ─────────────────────────────────────────────────────────
const deleteInvoice = async (req, res) => {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
        const { id } = req.params;
        const changedBy = req.user?.id || null;

        const [existing] = await conn.execute(
            'SELECT id, status FROM invoices WHERE id = ? AND deleted_at IS NULL', [id]
        );
        if (existing.length === 0) {
            await conn.rollback(); conn.release();
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        // Do NOT allow deleting a Paid invoice
        if (existing[0].status === 'Paid') {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'Cannot delete a Paid invoice. Please cancel it first.' });
        }

        // Soft delete invoice
        await conn.execute(
            'UPDATE invoices SET deleted_at = NOW(), updated_at = NOW() WHERE id = ?', [id]
        );

        // Soft delete its line items
        await conn.execute(
            'UPDATE invoice_items SET deleted_at = NOW() WHERE invoice_id = ?', [id]
        );

        // Un-mark any tickets that were marked as invoiced
        await conn.execute(
            'UPDATE tickets SET invoiced = 0, invoice_id = NULL, updated_at = NOW() WHERE invoice_id = ?', [id]
        );

        await logChange(conn, 'invoices', id, 'SOFT_DELETE', null, null, null, changedBy);

        await conn.commit();
        conn.release();

        return res.json({ success: true, message: 'Invoice deleted successfully' });
    } catch (error) {
        await conn.rollback();
        conn.release();
        console.error('[deleteInvoice]', error);
        return res.status(500).json({ success: false, message: 'Failed to delete invoice', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────
// UPDATE INVOICE STATUS
// PUT /api/admin/invoices/:id/status
// Body: { status }
// ─────────────────────────────────────────────────────────
const updateInvoiceStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const changedBy = req.user?.id || null;

        const validStatuses = ['Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Valid status required: ${validStatuses.join(', ')}` });
        }

        const [existing] = await pool.execute(
            'SELECT id, status FROM invoices WHERE id = ? AND deleted_at IS NULL', [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        const oldStatus = existing[0].status;
        await pool.execute(
            'UPDATE invoices SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]
        );

        const conn = await pool.getConnection();
        await logChange(conn, 'invoices', id, 'UPDATE', 'status', oldStatus, status, changedBy);
        conn.release();

        return res.json({ success: true, message: 'Invoice status updated successfully' });
    } catch (error) {
        console.error('[updateInvoiceStatus]', error);
        return res.status(500).json({ success: false, message: 'Failed to update invoice status', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────
// ADD LINE ITEM TO INVOICE
// POST /api/admin/invoices/:id/items
// Body: { description, quantity, unit_price, ticket_id? }
// ─────────────────────────────────────────────────────────
const addInvoiceItem = async (req, res) => {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
        const { id } = req.params;
        const { description, quantity, unit_price, ticket_id } = req.body;
        const changedBy = req.user?.id || null;

        if (!description || quantity === undefined || unit_price === undefined) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'description, quantity, and unit_price are required' });
        }

        // Verify invoice
        const [inv] = await conn.execute(
            'SELECT id, subtotal, tax_rate, tax_amount, total_amount, balance_due, amount_paid FROM invoices WHERE id = ? AND deleted_at IS NULL',
            [id]
        );
        if (inv.length === 0) {
            await conn.rollback(); conn.release();
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        const qty = parseFloat(quantity);
        const price = parseFloat(unit_price);
        const total = qty * price;

        // Insert item
        const [result] = await conn.execute(
            `INSERT INTO invoice_items (invoice_id, ticket_id, description, quantity, unit_price, total)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [id, ticket_id || null, description, qty, price, total]
        );

        // Recalculate invoice totals
        const invoice = inv[0];
        const newSubtotal = parseFloat(invoice.subtotal) + total;
        const newTaxAmount = newSubtotal * (parseFloat(invoice.tax_rate) / 100);
        const newTotal = newSubtotal + newTaxAmount;
        const newBalance = newTotal - parseFloat(invoice.amount_paid);

        await conn.execute(
            `UPDATE invoices SET subtotal = ?, tax_amount = ?, total_amount = ?, balance_due = ?, updated_at = NOW()
       WHERE id = ?`,
            [newSubtotal, newTaxAmount, newTotal, newBalance, id]
        );

        // Mark ticket as invoiced
        if (ticket_id) {
            await conn.execute(
                'UPDATE tickets SET invoiced = 1, invoice_id = ?, updated_at = NOW() WHERE id = ?',
                [id, ticket_id]
            );
        }

        await logChange(conn, 'invoice_items', result.insertId, 'INSERT', null, null, `Item added to invoice ${id}`, changedBy);

        await conn.commit();
        conn.release();

        return res.status(201).json({
            success: true,
            message: 'Item added to invoice',
            data: { id: result.insertId, total }
        });
    } catch (error) {
        await conn.rollback();
        conn.release();
        console.error('[addInvoiceItem]', error);
        return res.status(500).json({ success: false, message: 'Failed to add invoice item', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────
// DELETE INVOICE ITEM (soft)
// DELETE /api/admin/invoices/:id/items/:itemId
// ─────────────────────────────────────────────────────────
const deleteInvoiceItem = async (req, res) => {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
        const { id, itemId } = req.params;
        const changedBy = req.user?.id || null;

        const [item] = await conn.execute(
            'SELECT * FROM invoice_items WHERE id = ? AND invoice_id = ? AND deleted_at IS NULL',
            [itemId, id]
        );
        if (item.length === 0) {
            await conn.rollback(); conn.release();
            return res.status(404).json({ success: false, message: 'Invoice item not found' });
        }

        const removedTotal = parseFloat(item[0].total);

        // Soft delete item
        await conn.execute(
            'UPDATE invoice_items SET deleted_at = NOW() WHERE id = ?', [itemId]
        );

        // If item had a ticket_id, un-mark it
        if (item[0].ticket_id) {
            await conn.execute(
                'UPDATE tickets SET invoiced = 0, invoice_id = NULL, updated_at = NOW() WHERE id = ? AND invoice_id = ?',
                [item[0].ticket_id, id]
            );
        }

        // Recalculate invoice totals
        const [inv] = await conn.execute(
            'SELECT subtotal, tax_rate, amount_paid FROM invoices WHERE id = ? AND deleted_at IS NULL', [id]
        );
        if (inv.length > 0) {
            const newSubtotal = Math.max(0, parseFloat(inv[0].subtotal) - removedTotal);
            const newTaxAmount = newSubtotal * (parseFloat(inv[0].tax_rate) / 100);
            const newTotal = newSubtotal + newTaxAmount;
            const newBalance = newTotal - parseFloat(inv[0].amount_paid);

            await conn.execute(
                `UPDATE invoices SET subtotal = ?, tax_amount = ?, total_amount = ?, balance_due = ?, updated_at = NOW()
         WHERE id = ?`,
                [newSubtotal, newTaxAmount, newTotal, newBalance, id]
            );
        }

        await logChange(conn, 'invoice_items', itemId, 'SOFT_DELETE', null, null, null, changedBy);

        await conn.commit();
        conn.release();

        return res.json({ success: true, message: 'Invoice item removed successfully' });
    } catch (error) {
        await conn.rollback();
        conn.release();
        console.error('[deleteInvoiceItem]', error);
        return res.status(500).json({ success: false, message: 'Failed to remove invoice item', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────
// GET UNINVOICED (APPROVED) TICKETS FOR A CUSTOMER
// GET /api/admin/invoices/uninvoiced-tickets?customer_id=X
// ─────────────────────────────────────────────────────────
const getUninvoicedTickets = async (req, res) => {
    try {
        const customer_id = req.query.customer_id || req.query.customerId;
        const { startDate, endDate } = req.query;

        if (!customer_id) {
            return res.status(400).json({ success: false, message: 'customer_id is required' });
        }

        let query = `
      SELECT t.id, t.ticket_number, t.date, t.quantity, t.bill_rate, t.total_bill,
             t.equipment_type, t.job_type, t.truck_number,
             d.name AS driver_name
      FROM tickets t
      LEFT JOIN drivers d ON t.driver_id = d.id
      WHERE t.customer_id = ?
        AND t.status = 'Approved'
        AND t.invoiced = 0
        AND t.deleted_at IS NULL
    `;
        const params = [customer_id];

        if (startDate) { query += ` AND t.date >= ?`; params.push(startDate); }
        if (endDate) { query += ` AND t.date <= ?`; params.push(endDate); }

        query += ` ORDER BY t.date ASC`;

        const [tickets] = await pool.execute(query, params);

        return res.json({ success: true, data: tickets });
    } catch (error) {
        console.error('[getUninvoicedTickets]', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch tickets', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────
// PAYMENTS — CREATE
// POST /api/admin/payments
// Body: { customer_id, payment_date, amount, payment_method, reference_number, notes, invoice_allocations: [{invoice_id, amount_applied}] }
// ─────────────────────────────────────────────────────────
const createPayment = async (req, res) => {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
        const {
            customer_id, payment_date, amount, payment_method = 'Cheque',
            reference_number, notes, invoice_allocations = []
        } = req.body;
        const changedBy = req.user?.id || null;

        if (!customer_id || !payment_date || !amount) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'customer_id, payment_date, and amount are required' });
        }

        let allocationsToProcess = [...invoice_allocations];
        const application_mode = req.body.application_mode || 'Auto';

        const totalAllocated = allocationsToProcess.reduce((sum, a) => sum + parseFloat(a.amount_applied || 0), 0);
        if (totalAllocated > parseFloat(amount)) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: `Cannot allocate $${totalAllocated} — payment is only $${amount}` });
        }

        // If Auto application mode is requested and manual allocations are not provided, auto-fill allocations
        if (application_mode === 'Auto' && allocationsToProcess.length === 0) {
            const [openInvoices] = await conn.execute(
                `SELECT id, balance_due FROM invoices 
                 WHERE customer_id = ? AND balance_due > 0 AND status != 'Cancelled' AND deleted_at IS NULL
                 ORDER BY due_date ASC, id ASC`,
                [customer_id]
            );

            let remainingAmountToScale = parseFloat(amount);
            for (const inv of openInvoices) {
                if (remainingAmountToScale <= 0) break;

                const balanceDue = parseFloat(inv.balance_due);
                const applied = Math.min(balanceDue, remainingAmountToScale);

                allocationsToProcess.push({
                    invoice_id: inv.id,
                    amount_applied: applied
                });

                remainingAmountToScale -= applied;
            }
        }

        // Insert payment
        const [payResult] = await conn.execute(
            `INSERT INTO payments
         (company_id, customer_id, payment_date, amount, payment_method, reference_number, notes, received_by)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
            [customer_id, payment_date, amount, payment_method,
                reference_number || null, notes || null, changedBy]
        );
        const paymentId = payResult.insertId;

        // Apply payment to invoices (many-to-many)
        for (const alloc of allocationsToProcess) {
            if (!alloc.invoice_id || !alloc.amount_applied) continue;

            const applied = parseFloat(alloc.amount_applied);

            // Insert junction record
            await conn.execute(
                `INSERT INTO invoice_payments (invoice_id, payment_id, amount_applied)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE amount_applied = amount_applied + VALUES(amount_applied)`,
                [alloc.invoice_id, paymentId, applied]
            );

            // Update invoice: add to amount_paid, recalculate balance, update status
            const [invRow] = await conn.execute(
                'SELECT total_amount, amount_paid FROM invoices WHERE id = ? AND deleted_at IS NULL',
                [alloc.invoice_id]
            );
            if (invRow.length > 0) {
                const newPaid = parseFloat(invRow[0].amount_paid) + applied;
                const newBalance = parseFloat(invRow[0].total_amount) - newPaid;
                let newStatus = 'Partially Paid';
                if (newBalance <= 0) newStatus = 'Paid';
                if (newPaid <= 0) newStatus = 'Sent';

                await conn.execute(
                    `UPDATE invoices SET amount_paid = ?, balance_due = ?, status = ?, updated_at = NOW()
           WHERE id = ?`,
                    [newPaid, Math.max(0, newBalance), newStatus, alloc.invoice_id]
                );
            }
        }

        await logChange(conn, 'payments', paymentId, 'INSERT', null, null, `Payment of $${amount} recorded`, changedBy);

        await conn.commit();
        conn.release();

        return res.status(201).json({
            success: true,
            message: 'Payment recorded successfully',
            data: { id: paymentId }
        });
    } catch (error) {
        await conn.rollback();
        conn.release();
        console.error('[createPayment]', error);
        return res.status(500).json({ success: false, message: 'Failed to record payment', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────
// PAYMENTS — GET ALL
// GET /api/admin/payments
// ─────────────────────────────────────────────────────────
const getAllPayments = async (req, res) => {
    try {
        const { customer_id, startDate, endDate } = req.query;

        let query = `
      SELECT p.*, c.name AS customer_name,
             COALESCE(SUM(ip.amount_applied), 0) AS total_allocated
      FROM payments p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN invoice_payments ip ON ip.payment_id = p.id AND ip.deleted_at IS NULL
      WHERE p.deleted_at IS NULL
    `;
        const params = [];

        if (customer_id) { query += ` AND p.customer_id = ?`; params.push(customer_id); }
        if (startDate) { query += ` AND p.payment_date >= ?`; params.push(startDate); }
        if (endDate) { query += ` AND p.payment_date <= ?`; params.push(endDate); }

        query += ` GROUP BY p.id ORDER BY p.payment_date DESC`;

        const [payments] = await pool.execute(query, params);

        return res.json({ success: true, data: payments });
    } catch (error) {
        console.error('[getAllPayments]', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch payments', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────
// PAYMENTS — GET BY ID
// GET /api/admin/payments/:id
// ─────────────────────────────────────────────────────────
const getPaymentById = async (req, res) => {
    try {
        const { id } = req.params;

        const [payments] = await pool.execute(
            `SELECT p.*, c.name AS customer_name
       FROM payments p
       LEFT JOIN customers c ON p.customer_id = c.id
       WHERE p.id = ? AND p.deleted_at IS NULL`,
            [id]
        );

        if (payments.length === 0) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        // Invoices this payment is applied to
        const [allocations] = await pool.execute(
            `SELECT ip.amount_applied, i.id AS invoice_id, i.invoice_number, i.total_amount, i.status
       FROM invoice_payments ip
       JOIN invoices i ON ip.invoice_id = i.id
       WHERE ip.payment_id = ? AND ip.deleted_at IS NULL`,
            [id]
        );

        return res.json({
            success: true,
            data: { ...payments[0], allocations }
        });
    } catch (error) {
        console.error('[getPaymentById]', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch payment', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────
// PAYMENTS — SOFT DELETE
// DELETE /api/admin/payments/:id
// ─────────────────────────────────────────────────────────
const deletePayment = async (req, res) => {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
        const { id } = req.params;
        const changedBy = req.user?.id || null;

        const [existing] = await conn.execute(
            'SELECT * FROM payments WHERE id = ? AND deleted_at IS NULL', [id]
        );
        if (existing.length === 0) {
            await conn.rollback(); conn.release();
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        // Reverse payment allocations
        const [allocations] = await conn.execute(
            'SELECT * FROM invoice_payments WHERE payment_id = ? AND deleted_at IS NULL', [id]
        );

        for (const alloc of allocations) {
            const applied = parseFloat(alloc.amount_applied);

            // Soft delete allocation
            await conn.execute(
                'UPDATE invoice_payments SET deleted_at = NOW() WHERE id = ?', [alloc.id]
            );

            // Reverse invoice amount_paid
            const [invRow] = await conn.execute(
                'SELECT total_amount, amount_paid FROM invoices WHERE id = ? AND deleted_at IS NULL',
                [alloc.invoice_id]
            );
            if (invRow.length > 0) {
                const newPaid = Math.max(0, parseFloat(invRow[0].amount_paid) - applied);
                const newBalance = parseFloat(invRow[0].total_amount) - newPaid;
                let newStatus = newPaid <= 0 ? 'Sent' : (newBalance <= 0 ? 'Paid' : 'Partially Paid');

                await conn.execute(
                    `UPDATE invoices SET amount_paid = ?, balance_due = ?, status = ?, updated_at = NOW() WHERE id = ?`,
                    [newPaid, newBalance, newStatus, alloc.invoice_id]
                );
            }
        }

        // Soft delete payment
        await conn.execute(
            'UPDATE payments SET deleted_at = NOW(), updated_at = NOW() WHERE id = ?', [id]
        );

        await logChange(conn, 'payments', id, 'SOFT_DELETE', null, null, null, changedBy);

        await conn.commit();
        conn.release();

        return res.json({ success: true, message: 'Payment deleted and invoice balances reversed' });
    } catch (error) {
        await conn.rollback();
        conn.release();
        console.error('[deletePayment]', error);
        return res.status(500).json({ success: false, message: 'Failed to delete payment', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────
// DASHBOARD STATS FOR INVOICES
// GET /api/admin/invoices/stats
// ─────────────────────────────────────────────────────────
const getInvoiceStats = async (req, res) => {
    try {
        const [totals] = await pool.execute(`
      SELECT
        COUNT(*)                                              AS total_invoices,
        COALESCE(SUM(total_amount), 0)                       AS total_billed,
        COALESCE(SUM(amount_paid), 0)                        AS total_collected,
        COALESCE(SUM(balance_due), 0)                        AS total_outstanding,
        COUNT(CASE WHEN status = 'Overdue'        THEN 1 END) AS overdue_count,
        COUNT(CASE WHEN status = 'Draft'          THEN 1 END) AS draft_count,
        COUNT(CASE WHEN status = 'Sent'           THEN 1 END) AS sent_count,
        COUNT(CASE WHEN status = 'Partially Paid' THEN 1 END) AS partial_count,
        COUNT(CASE WHEN status = 'Paid'           THEN 1 END) AS paid_count
      FROM invoices
      WHERE deleted_at IS NULL
    `);

        return res.json({ success: true, data: totals[0] });
    } catch (error) {
        console.error('[getInvoiceStats]', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch invoice stats', error: error.message });
    }
};

module.exports = {
    getAllInvoices,
    getInvoiceById,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    updateInvoiceStatus,
    addInvoiceItem,
    deleteInvoiceItem,
    getUninvoicedTickets,
    createPayment,
    getAllPayments,
    getPaymentById,
    deletePayment,
    getInvoiceStats
};
