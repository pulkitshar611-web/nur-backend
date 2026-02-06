/**
 * Email Service Utility
 * Handles sending emails via SMTP using nodemailer
 */

const nodemailer = require('nodemailer');

// Create reusable transporter object using SMTP transport
// For production, configure these via environment variables
// Default configuration uses GoDaddy SMTP settings


const createTransporter = () => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    throw new Error('SMTP environment variables are missing');
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // ✅ AUTO secure
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
  });

  return transporter;
};



/**
 * Send invoice email with PDF attachment
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.customerName - Customer name
 * @param {string} options.invoiceNumber - Invoice number
 * @param {string} options.startDate - Invoice start date
 * @param {string} options.endDate - Invoice end date
 * @param {Buffer} options.pdfBuffer - PDF file buffer
 * @param {string} options.filename - PDF filename
 * @returns {Promise<Object>} - Email send result
 */
const sendInvoiceEmail = async ({
  to,
  customerName,
  invoiceNumber,
  startDate,
  endDate,
  pdfBuffer,
  filename,
}) => {
  try {
    const transporter = createTransporter();

    // Email content
    const subject = `Invoice ${invoiceNumber} - ${customerName}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #295b52;">Invoice ${invoiceNumber}</h2>
        <p>Dear ${customerName},</p>
        <p>Please find attached your invoice for the period:</p>
        <p><strong>${startDate} to ${endDate}</strong></p>
        <p>The invoice PDF is attached to this email.</p>
        <p>If you have any questions, please contact us.</p>
        <br>
        <p>Best regards,<br>Noor Trucking Inc.</p>
      </div>
    `;

    const textBody = `
Invoice ${invoiceNumber}

Dear ${customerName},

Please find attached your invoice for the period:
${startDate} to ${endDate}

The invoice PDF is attached to this email.

If you have any questions, please contact us.

Best regards,
Noor Trucking Inc.
    `;

    // Send email
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'info@noortruckinginc.com',
      to: to,
      subject: subject,
      text: textBody,
      html: htmlBody,
      attachments: [
        {
          filename: filename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    console.log('[Email Service] Invoice email sent successfully:', info.messageId);
    return {
      success: true,
      messageId: info.messageId,
      message: 'Invoice email sent successfully',
    };
  } catch (error) {
    console.error('[Email Service] Error sending invoice email:', error);
    
    // Provide more helpful error messages
    let errorMessage = 'Failed to send invoice email';
    if (error.code === 'EAUTH') {
      errorMessage = 'SMTP authentication failed. Please check your SMTP_USER and SMTP_PASS credentials.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Could not connect to SMTP server. Please check your SMTP_HOST and SMTP_PORT settings.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'SMTP connection timed out. Please check your network connection and SMTP settings.';
    } else if (error.message) {
      errorMessage = `Email sending failed: ${error.message}`;
    }
    
    return {
      success: false,
      error: error.message || 'Unknown error',
      message: errorMessage,
    };
  }
};

/**
 * Verify SMTP connection
 * @returns {Promise<boolean>} - True if connection is successful
 */
const verifyConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('[Email Service] SMTP connection verified');
    return true;
  } catch (error) {
    console.error('[Email Service] SMTP connection failed:', error);
    return false;
  }
};

module.exports = {
  sendInvoiceEmail,
  verifyConnection,
};

