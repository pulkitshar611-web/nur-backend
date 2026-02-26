/**
 * Email Service Utility
 * Sends professional invoice emails via SMTP using nodemailer
 */

const nodemailer = require('nodemailer');

// ─── TRANSPORTER ──────────────────────────────────────────────────────────────
const createTransporter = () => {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';

  if (!smtpUser || !smtpPass) {
    console.warn('[Email] ⚠️  SMTP credentials missing. Set SMTP_USER and SMTP_PASS in .env');
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,       // true for SSL (465), false for TLS (587)
    auth: { user: smtpUser, pass: smtpPass },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    tls: { rejectUnauthorized: false },
  });
};

// ─── PROFESSIONAL EMAIL HTML BUILDER ─────────────────────────────────────────
const buildInvoiceEmailHtml = ({
  customerName,
  invoiceNumber,
  startDate,
  endDate,
  total,
  companyName,
  companyEmail,
  companyPhone,
  companyWebsite,
  companyLogoUrl,
}) => {
  const primaryColor = '#295b52';
  const bgColor = '#f4f6f4';
  const cardColor = '#ffffff';
  const accentLight = '#e8f0ee';

  const logoHtml = companyLogoUrl
    ? `<img src="${companyLogoUrl}" alt="${companyName} Logo"
           style="max-height:70px; max-width:200px; object-fit:contain; margin-bottom:8px;" /><br/>`
    : '';

  const totalFormatted = total != null
    ? `$${parseFloat(total).toFixed(2)}`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Invoice ${invoiceNumber}</title>
</head>
<body style="margin:0;padding:0;background-color:${bgColor};font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${bgColor};padding:30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background-color:${cardColor};border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <!-- HEADER BAND -->
          <tr>
            <td style="background-color:${primaryColor};padding:32px 40px;text-align:center;">
              ${logoHtml}
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:1px;">
                ${companyName}
              </h1>
              ${companyWebsite
      ? `<p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">${companyWebsite}</p>`
      : ''}
            </td>
          </tr>

          <!-- INVOICE BADGE -->
          <tr>
            <td style="background-color:${accentLight};padding:16px 40px;border-bottom:1px solid #d4e0dd;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:20px;font-weight:700;color:${primaryColor};">INVOICE</span>
                    <span style="font-size:14px;color:#666;margin-left:10px;">${invoiceNumber}</span>
                  </td>
                  <td align="right">
                    <span style="font-size:13px;color:#888;">
                      Period: <strong style="color:#444;">${startDate} – ${endDate}</strong>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:36px 40px;">

              <!-- Greeting -->
              <p style="margin:0 0 16px;font-size:15px;color:#333;">
                Dear <strong>${customerName}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
                Please find attached your invoice for the billing period
                <strong>${startDate}</strong> to <strong>${endDate}</strong>.
                The PDF is attached to this email for your records.
              </p>

              <!-- Invoice Summary Box -->
              ${totalFormatted ? `
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background-color:#f9fbfa;border:1px solid #d4e0dd;border-radius:8px;margin-bottom:26px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#888;padding-bottom:6px;">Invoice Number</td>
                        <td align="right" style="font-size:13px;color:#888;padding-bottom:6px;">Total Amount</td>
                      </tr>
                      <tr>
                        <td style="font-size:18px;font-weight:700;color:${primaryColor};">${invoiceNumber}</td>
                        <td align="right" style="font-size:22px;font-weight:700;color:${primaryColor};">${totalFormatted}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Contact note -->
              <p style="margin:0 0 8px;font-size:14px;color:#555;line-height:1.6;">
                If you have any questions about this invoice, please don't hesitate to contact us:
              </p>
              <p style="margin:0 0 28px;font-size:14px;color:#555;">
                📧 <a href="mailto:${companyEmail}" style="color:${primaryColor};text-decoration:none;">${companyEmail}</a>
                ${companyPhone ? `&nbsp;&nbsp;📞 ${companyPhone}` : ''}
              </p>

              <p style="margin:0;font-size:14px;color:#555;">
                Thank you for your business. We look forward to continuing to serve you.
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:${accentLight};padding:22px 40px;border-top:1px solid #d4e0dd;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:13px;color:#666;">Best regards,</p>
                    <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:${primaryColor};">
                      ${companyName}
                    </p>
                    ${companyPhone
      ? `<p style="margin:3px 0 0;font-size:12px;color:#888;">📞 ${companyPhone}</p>`
      : ''}
                    <p style="margin:3px 0 0;font-size:12px;color:#888;">📧 ${companyEmail}</p>
                    ${companyWebsite
      ? `<p style="margin:3px 0 0;font-size:12px;color:#888;">🌐 ${companyWebsite}</p>`
      : ''}
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <p style="margin:0;font-size:11px;color:#aaa;">
                      This is an automated email.<br/>Please do not reply directly.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

// ─── buildInvoiceEmailText ────────────────────────────────────────────────────
const buildInvoiceEmailText = ({
  customerName, invoiceNumber, startDate, endDate,
  total, companyName, companyEmail, companyPhone, companyWebsite,
}) => {
  const totalFormatted = total != null ? `$${parseFloat(total).toFixed(2)}` : '';
  return [
    `Invoice ${invoiceNumber}`,
    ``,
    `Dear ${customerName},`,
    ``,
    `Please find attached your invoice for the period: ${startDate} to ${endDate}.`,
    totalFormatted ? `Total Amount: ${totalFormatted}` : '',
    ``,
    `If you have any questions, please contact us:`,
    `Email: ${companyEmail}`,
    companyPhone ? `Phone: ${companyPhone}` : '',
    companyWebsite ? `Website: ${companyWebsite}` : '',
    ``,
    `Best regards,`,
    companyName,
  ].filter(line => line !== null && line !== undefined).join('\n');
};

// ─── MAIN SEND FUNCTION ───────────────────────────────────────────────────────
/**
 * Send professional invoice email with PDF attachment
 * @param {Object} options
 * @param {string}   options.to           - Recipient email
 * @param {string}   options.customerName
 * @param {string}   options.invoiceNumber
 * @param {string}   options.startDate    - Already formatted readable date
 * @param {string}   options.endDate      - Already formatted readable date
 * @param {number}  [options.total]       - Invoice total amount
 * @param {Buffer}   options.pdfBuffer
 * @param {string}   options.filename
 * @param {Object}  [options.companyInfo] - Prefetched company info (optional)
 */
const sendInvoiceEmail = async ({
  to,
  customerName,
  invoiceNumber,
  startDate,
  endDate,
  total = null,
  pdfBuffer,
  filename,
  companyInfo = null,
}) => {
  try {
    const transporter = createTransporter();

    // Fetch company profile from DB if not already provided
    let company = companyInfo;
    if (!company) {
      try {
        const pool = require('../config/db');
        const [rows] = await pool.execute(
          'SELECT company_name, company_logo, email, phone, website FROM company_settings LIMIT 1'
        );
        if (rows.length > 0) company = rows[0];
      } catch (err) {
        console.error('[Email] DB fetch for company info failed:', err.message);
      }
    }

    const companyName = company?.company_name || 'Noor Trucking Inc.';
    const companyEmail = company?.email || process.env.SMTP_FROM || process.env.SMTP_USER || 'accounting@noortruckinginc.com';
    const companyPhone = company?.phone || '';
    const companyWebsite = company?.website || '';

    // Handle logo — base64 data URL (from DB) or remote http URL
    let companyLogoUrl = '';
    const emailAttachments = [{
      filename,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }];

    if (company?.company_logo) {
      const logoRaw = company.company_logo;
      if (logoRaw.startsWith('data:image')) {
        // base64 data URL — embed as CID inline image (works on Railway, no file system)
        const mimeMatch = logoRaw.match(/^data:(image\/[a-z+]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        const base64Data = logoRaw.replace(/^data:image\/[a-z+]+;base64,/, '');
        const ext = mimeType.split('/')[1] || 'png';
        emailAttachments.push({
          filename: `company_logo.${ext}`,
          content: Buffer.from(base64Data, 'base64'),
          contentType: mimeType,
          cid: 'company_logo_cid',
        });
        companyLogoUrl = 'cid:company_logo_cid';
      } else if (logoRaw.startsWith('http')) {
        companyLogoUrl = logoRaw;
      } else {
        const port = process.env.PORT || 5000;
        companyLogoUrl = `http://localhost:${port}${logoRaw}`;
      }
    }

    // Email subject — "Invoice #INV-001 from Noor Trucking Inc."
    const subject = `Invoice ${invoiceNumber} from ${companyName}`;

    const emailContext = {
      customerName, invoiceNumber, startDate, endDate, total,
      companyName, companyEmail, companyPhone, companyWebsite, companyLogoUrl,
    };

    const htmlBody = buildInvoiceEmailHtml(emailContext);
    const textBody = buildInvoiceEmailText(emailContext);

    const fromAddress = `${companyName} <${process.env.SMTP_FROM || process.env.SMTP_USER || companyEmail}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: textBody,
      html: htmlBody,
      attachments: emailAttachments,
    });

    console.log(`[Email] ✅ Invoice email sent → ${to} (messageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId, message: 'Invoice email sent successfully' };

  } catch (error) {
    console.error('[Email] ❌ Failed to send invoice email:', error.message);
    console.error('[Email] Error code:', error.code);

    let errorMessage = 'Failed to send invoice email.';
    if (error.code === 'EAUTH') {
      errorMessage = 'SMTP authentication failed. Please verify your SMTP_USER and SMTP_PASS in the .env file.';
    } else if (error.code === 'ECONNECTION' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Cannot connect to SMTP server. Check SMTP_HOST and SMTP_PORT settings.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'SMTP connection timed out. Check your internet connection and SMTP settings.';
    } else if (error.responseCode === 535) {
      errorMessage = 'Gmail authentication failed. Use an App Password, not your Gmail password. See: https://support.google.com/accounts/answer/185833';
    } else if (error.message) {
      errorMessage = `Email sending failed: ${error.message}`;
    }

    return { success: false, error: error.message, message: errorMessage };
  }
};

// ─── VERIFY CONNECTION ────────────────────────────────────────────────────────
const verifyConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('[Email] ✅ SMTP connection verified successfully');
    return { success: true };
  } catch (error) {
    console.error('[Email] ❌ SMTP verification failed:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendInvoiceEmail, verifyConnection };
