/**
 * Email templates for the Kenluk application
 */

/**
 * Generate email verification template with OTP code
 * @param {string} name - User's name
 * @param {string} otpCode - 6-digit OTP code
 * @returns {string} HTML email template
 */
const generateVerificationEmail = (name, otpCode) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .otp-code {
          font-size: 32px;
          font-weight: bold;
          color: #007bff;
          text-align: center;
          letter-spacing: 8px;
          background: #e9ecef;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          font-family: 'Courier New', monospace;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          color: #666;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Kenluk!</h1>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>Thank you for registering with Kenluk. To complete your registration, please verify your email address using the verification code below:</p>

          <div class="otp-code">${otpCode}</div>

          <p>Enter this 6-digit code in the verification form to activate your account.</p>

          <p><strong>Important:</strong> This code will expire in 10 minutes for security reasons.</p>

          <p>If you didn't create an account with Kenluk, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Kenluk. All rights reserved.</p>
          <p>Contact us: Info@kenluk.com | +234 708 832 9998</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate password reset template
 * @param {string} name - User's name
 * @param {string} resetUrl - Password reset URL
 * @returns {string} HTML email template
 */
const generatePasswordResetEmail = (name, resetUrl) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .button { 
          display: inline-block; 
          padding: 12px 24px; 
          background: #dc3545; 
          color: white; 
          text-decoration: none; 
          border-radius: 5px; 
          margin: 20px 0; 
        }
        .footer { 
          text-align: center; 
          margin-top: 30px; 
          color: #666; 
          font-size: 12px; 
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>We received a request to reset your Kenluk account password. Click the button below to create a new password:</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </div>
          
          <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #dc3545;">${resetUrl}</p>
          
          <p>This password reset link will expire in 1 hour for security reasons.</p>
          
          <p>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Kenluk. All rights reserved.</p>
          <p>Contact us: Info@kenluk.com | +234 708 832 9998</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate welcome email template
 * @param {string} name - User's name
 * @returns {string} HTML email template
 */
const generateWelcomeEmail = (name) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #28a745; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .footer { 
          text-align: center; 
          margin-top: 30px; 
          color: #666; 
          font-size: 12px; 
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Kenluk!</h1>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>Congratulations! Your Kenluk account has been successfully verified and is now active.</p>
          
          <p>You can now enjoy all the features of our platform:</p>
          <ul>
            <li>Secure authentication and authorization</li>
            <li>User profile management</li>
            <li>And much more!</li>
          </ul>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          
          <p>Happy exploring!</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Kenluk. All rights reserved.</p>
          <p>Contact us: Info@kenluk.com | +234 708 832 9998</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export {
  generateVerificationEmail,
  generatePasswordResetEmail,
  generateWelcomeEmail
};

// ─── Reap Payment Notification Templates ─────────────────────────────────────

/**
 * Shared base styles used across all payment email templates
 */
const sharedStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', Arial, sans-serif;
    background-color: #f0f2f5;
    color: #1a1a2e;
    -webkit-font-smoothing: antialiased;
  }
  .wrapper {
    background-color: #f0f2f5;
    padding: 40px 20px;
  }
  .container {
    max-width: 620px;
    margin: 0 auto;
    background: #ffffff;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(0,0,0,0.10);
  }
  .header {
    padding: 36px 40px 28px;
    text-align: center;
  }
  .brand {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    opacity: 0.85;
    margin-bottom: 16px;
  }
  .header h1 {
    font-size: 26px;
    font-weight: 700;
    line-height: 1.3;
    margin-bottom: 8px;
  }
  .header p {
    font-size: 15px;
    opacity: 0.80;
  }
  .status-badge {
    display: inline-block;
    padding: 6px 20px;
    border-radius: 50px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin: 16px 0 0;
  }
  .body {
    padding: 32px 40px;
  }
  .greeting {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 10px;
    color: #1a1a2e;
  }
  .intro-text {
    font-size: 14px;
    color: #555;
    line-height: 1.7;
    margin-bottom: 28px;
  }
  .section-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #888;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #eef0f4;
  }
  .info-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 28px;
  }
  .info-table tr td {
    padding: 10px 0;
    font-size: 14px;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: top;
  }
  .info-table tr:last-child td {
    border-bottom: none;
  }
  .info-table td:first-child {
    color: #888;
    font-weight: 500;
    width: 46%;
    padding-right: 12px;
  }
  .info-table td:last-child {
    color: #1a1a2e;
    font-weight: 600;
    text-align: right;
  }
  .amount-box {
    border-radius: 12px;
    padding: 24px 28px;
    margin-bottom: 28px;
    text-align: center;
  }
  .amount-box .label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .amount-box .amount {
    font-size: 36px;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 4px;
  }
  .amount-box .sub {
    font-size: 13px;
    opacity: 0.75;
  }
  .receipt-id-box {
    background: #f8f9fc;
    border: 1px dashed #d0d5e0;
    border-radius: 8px;
    padding: 14px 18px;
    margin-bottom: 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .receipt-id-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #888;
  }
  .receipt-id-value {
    font-family: 'Courier New', monospace;
    font-size: 13px;
    font-weight: 700;
    color: #1a1a2e;
    word-break: break-all;
    text-align: right;
  }
  .notice-box {
    border-radius: 10px;
    padding: 16px 18px;
    margin-bottom: 28px;
    font-size: 13px;
    line-height: 1.6;
  }
  .footer {
    background: #f8f9fc;
    border-top: 1px solid #eef0f4;
    padding: 24px 40px;
    text-align: center;
  }
  .footer p {
    font-size: 12px;
    color: #999;
    line-height: 1.8;
  }
  .footer a { color: #999; text-decoration: none; }
  .divider {
    height: 1px;
    background: #eef0f4;
    margin: 24px 0;
  }
`;

/**
 * Generate payment initiated email
 * Sent immediately when a user submits a new payment request.
 * @param {string} name - User's full name
 * @param {Object} payment - Payment document object
 * @returns {string} HTML email template
 */
const generatePaymentInitiatedEmail = (name, payment) => {
  const submittedAt = new Date(payment.submittedAt || payment.createdAt).toLocaleString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });
  const localAmountFormatted = Number(payment.localAmount).toLocaleString('en-NG', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  const foreignAmountFormatted = Number(payment.foreignAmount).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Request Initiated – Reap by Kenluk</title>
  <style>${sharedStyles}
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%); color: #fff; }
    .status-badge { background: rgba(255,255,255,0.18); color: #fff; border: 1px solid rgba(255,255,255,0.3); }
    .amount-box { background: linear-gradient(135deg, #e8f4fd 0%, #dbeafe 100%); border: 1px solid #bfdbfe; color: #1e40af; }
    .notice-box { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="container">
    <div class="header">
      <div class="brand">⚡ Reap by Kenluk</div>
      <h1>Payment Request Initiated</h1>
      <p>We've received your payment request and it's under review</p>
      <div class="status-badge">⏳ Pending Admin Approval</div>
    </div>

    <div class="body">
      <p class="greeting">Hello, ${name}!</p>
      <p class="intro-text">
        Your international payment request has been successfully submitted to the Kenluk platform.
        Our team will review and process your request shortly. You'll receive another email once your
        payment has been processed.
      </p>

      <!-- Receipt ID -->
      <div class="receipt-id-box">
        <span class="receipt-id-label">Transaction Ref</span>
        <span class="receipt-id-value">${payment._id}</span>
      </div>

      <!-- Amount -->
      <div class="amount-box">
        <div class="label">Payment Amount</div>
        <div class="amount">${payment.foreignCurrency} ${foreignAmountFormatted}</div>
        <div class="sub">Equivalent to ₦${localAmountFormatted} at rate ${Number(payment.exchangeRate).toLocaleString()}</div>
      </div>

      <!-- Recipient Details -->
      <div class="section-label">Recipient Details</div>
      <table class="info-table">
        <tr><td>Company / Name</td><td>${payment.recipientCompany}</td></tr>
        <tr><td>Bank Name</td><td>${payment.recipientBank}</td></tr>
        <tr><td>Account Number</td><td>${payment.accountNumber}</td></tr>
        <tr><td>SWIFT / BIC</td><td>${payment.recipientBankSwiftCode}</td></tr>
        <tr><td>Country</td><td>${payment.recipientBankCountry}</td></tr>
      </table>

      <!-- Transaction Meta -->
      <div class="section-label">Submission Details</div>
      <table class="info-table">
        <tr><td>Submitted At</td><td>${submittedAt}</td></tr>
        <tr><td>Invoice File</td><td>${payment.invoiceOriginalFileName || payment.invoiceFileName || 'N/A'}</td></tr>
        <tr><td>Status</td><td>Pending Admin Approval</td></tr>
      </table>

      <div class="notice-box">
        ⚠️ <strong>Important:</strong> Please do not submit a duplicate payment request. Our admin team typically reviews requests within 1–2 business days. If you have any concerns, please contact us at <a href="mailto:Info@kenluk.com" style="color: #92400e;">Info@kenluk.com</a>.
      </div>
    </div>

    <div class="footer">
      <p>© ${new Date().getFullYear()} Kenluk &nbsp;|&nbsp; <a href="mailto:Info@kenluk.com">Info@kenluk.com</a> &nbsp;|&nbsp; +234 708 832 9998</p>
      <p style="margin-top: 6px;">Powered by Reap Payments &nbsp;·&nbsp; This is an automated notification. Please do not reply.</p>
    </div>
  </div>
</div>
</body>
</html>`;
};

/**
 * Generate payment successful email (includes receipt)
 * Sent when a payment is marked as completed.
 * @param {string} name - User's full name
 * @param {Object} payment - Payment document object
 * @returns {string} HTML email template
 */
const generatePaymentSuccessEmail = (name, payment) => {
  const completedAt = new Date(payment.completedAt || payment.updatedAt).toLocaleString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });
  const submittedAt = new Date(payment.submittedAt || payment.createdAt).toLocaleString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });
  const localAmountFormatted = Number(payment.localAmount).toLocaleString('en-NG', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  const foreignAmountFormatted = Number(payment.foreignAmount).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Successful – Official Receipt – Reap by Kenluk</title>
  <style>${sharedStyles}
    .header { background: linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%); color: #fff; }
    .status-badge { background: rgba(255,255,255,0.20); color: #fff; border: 1px solid rgba(255,255,255,0.35); }
    .amount-box { background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border: 1px solid #6ee7b7; color: #064e3b; }
    .receipt-strip {
      background: linear-gradient(90deg, #064e3b 0%, #047857 100%);
      color: #fff;
      text-align: center;
      padding: 12px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    .checkmark {
      width: 56px;
      height: 56px;
      background: rgba(255,255,255,0.18);
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="container">
    <div class="header">
      <div class="brand">⚡ Reap by Kenluk</div>
      <div class="checkmark">✅</div>
      <h1>Payment Successful!</h1>
      <p>Your international payment has been completed</p>
      <div class="status-badge">✔ COMPLETED</div>
    </div>

    <!-- Official Receipt Strip -->
    <div class="receipt-strip">🧾 &nbsp; Official Payment Receipt &nbsp; 🧾</div>

    <div class="body">
      <p class="greeting">Hello, ${name}!</p>
      <p class="intro-text">
        Great news! Your payment has been successfully processed and sent to the recipient via Reap Payments.
        This email serves as your <strong>official payment receipt</strong>. Please save it for your records.
      </p>

      <!-- Receipt ID -->
      <div class="receipt-id-box">
        <span class="receipt-id-label">Receipt / Transaction ID</span>
        <span class="receipt-id-value">${payment._id}</span>
      </div>

      <!-- Amount Sent -->
      <div class="amount-box">
        <div class="label">Amount Sent</div>
        <div class="amount">${payment.foreignCurrency} ${foreignAmountFormatted}</div>
        <div class="sub">Debited: ₦${localAmountFormatted} &nbsp;·&nbsp; Exchange Rate: ₦${Number(payment.exchangeRate).toLocaleString()} per ${payment.foreignCurrency}</div>
      </div>

      <!-- Recipient Information -->
      <div class="section-label">Recipient Information</div>
      <table class="info-table">
        <tr><td>Company / Name</td><td>${payment.recipientCompany}</td></tr>
        <tr><td>Bank Name</td><td>${payment.recipientBank}</td></tr>
        <tr><td>Account Number</td><td>${payment.accountNumber}</td></tr>
        <tr><td>SWIFT / BIC Code</td><td>${payment.recipientBankSwiftCode}</td></tr>
        <tr><td>Bank Country</td><td>${payment.recipientBankCountry}</td></tr>
      </table>

      <!-- Transaction Details -->
      <div class="section-label">Transaction Details</div>
      <table class="info-table">
        <tr><td>Amount Sent</td><td>${payment.foreignCurrency} ${foreignAmountFormatted}</td></tr>
        <tr><td>Naira Equivalent</td><td>₦${localAmountFormatted}</td></tr>
        <tr><td>Exchange Rate</td><td>₦${Number(payment.exchangeRate).toLocaleString()} / ${payment.foreignCurrency}</td></tr>
        <tr><td>Invoice File</td><td>${payment.invoiceOriginalFileName || payment.invoiceFileName || 'N/A'}</td></tr>
        <tr><td>Submitted At</td><td>${submittedAt}</td></tr>
        <tr><td>Completed At</td><td>${completedAt}</td></tr>
        <tr><td>Status</td><td>✅ Completed</td></tr>
      </table>

      <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:16px 18px; font-size:13px; line-height:1.6; color:#14532d;">
        🎉 <strong>Payment Delivered!</strong> Funds have been successfully dispatched to the recipient's bank account via the Reap Payments network. If the recipient has not received the funds within 2–3 business days, please contact us immediately.
      </div>
    </div>

    <div class="footer">
      <p><strong>Keep this email as your official payment receipt.</strong></p>
      <p style="margin-top: 8px;">© ${new Date().getFullYear()} Kenluk &nbsp;|&nbsp; <a href="mailto:Info@kenluk.com">Info@kenluk.com</a> &nbsp;|&nbsp; +234 708 832 9998</p>
      <p style="margin-top: 6px;">Powered by Reap Payments &nbsp;·&nbsp; This is an automated notification. Please do not reply.</p>
    </div>
  </div>
</div>
</body>
</html>`;
};

/**
 * Generate payment failed / rejected email
 * Sent when a payment fails at any stage (rejected, Reap API failure, or webhook failure).
 * @param {string} name - User's full name
 * @param {Object} payment - Payment document object
 * @param {string} [reason] - Optional specific failure/rejection reason override
 * @returns {string} HTML email template
 */
const generatePaymentFailedEmail = (name, payment, reason) => {
  const failedAt = new Date(payment.updatedAt || new Date()).toLocaleString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });
  const submittedAt = new Date(payment.submittedAt || payment.createdAt).toLocaleString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });
  const localAmountFormatted = Number(payment.localAmount).toLocaleString('en-NG', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  const foreignAmountFormatted = Number(payment.foreignAmount).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  // Determine the failure reason to display
  const failureReason = reason ||
    payment.rejectionReason ||
    payment.reapErrorMessage ||
    'An unexpected error occurred during payment processing. Please try again or contact support.';

  const isRejected = payment.status === 'rejected';
  const statusLabel = isRejected ? '✖ REJECTED BY ADMIN' : '✖ PAYMENT FAILED';
  const headerTitle = isRejected ? 'Payment Request Rejected' : 'Payment Failed';
  const headerSubtitle = isRejected
    ? 'Your payment request was not approved by our team'
    : 'Something went wrong while processing your payment';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment ${isRejected ? 'Rejected' : 'Failed'} – Reap by Kenluk</title>
  <style>${sharedStyles}
    .header { background: linear-gradient(135deg, #450a0a 0%, #7f1d1d 60%, #991b1b 100%); color: #fff; }
    .status-badge { background: rgba(255,255,255,0.15); color: #fff; border: 1px solid rgba(255,255,255,0.3); }
    .amount-box { background: linear-gradient(135deg, #fff5f5 0%, #fee2e2 100%); border: 1px solid #fca5a5; color: #7f1d1d; }
    .reason-box {
      background: #fff1f2;
      border-left: 4px solid #e11d48;
      border-radius: 0 10px 10px 0;
      padding: 16px 18px;
      margin-bottom: 28px;
      font-size: 14px;
      line-height: 1.7;
      color: #881337;
    }
    .reason-box strong { display: block; margin-bottom: 6px; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #e11d48; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="container">
    <div class="header">
      <div class="brand">⚡ Reap by Kenluk</div>
      <h1>${headerTitle}</h1>
      <p>${headerSubtitle}</p>
      <div class="status-badge">${statusLabel}</div>
    </div>

    <div class="body">
      <p class="greeting">Hello, ${name},</p>
      <p class="intro-text">
        We regret to inform you that your payment request could not be completed.
        Please review the reason below and feel free to submit a new request or contact our support team for assistance.
      </p>

      <!-- Receipt ID -->
      <div class="receipt-id-box">
        <span class="receipt-id-label">Transaction Ref</span>
        <span class="receipt-id-value">${payment._id}</span>
      </div>

      <!-- Failure Reason -->
      <div class="reason-box">
        <strong>${isRejected ? 'Rejection Reason' : 'Failure Reason'}</strong>
        ${failureReason}
      </div>

      <!-- Amount -->
      <div class="amount-box">
        <div class="label">Attempted Payment Amount</div>
        <div class="amount">${payment.foreignCurrency} ${foreignAmountFormatted}</div>
        <div class="sub">Equivalent to ₦${localAmountFormatted}</div>
      </div>

      <!-- Payment Details -->
      <div class="section-label">Payment Details</div>
      <table class="info-table">
        <tr><td>Recipient</td><td>${payment.recipientCompany}</td></tr>
        <tr><td>Bank Name</td><td>${payment.recipientBank}</td></tr>
        <tr><td>Account Number</td><td>${payment.accountNumber}</td></tr>
        <tr><td>SWIFT / BIC</td><td>${payment.recipientBankSwiftCode}</td></tr>
        <tr><td>Submitted At</td><td>${submittedAt}</td></tr>
        <tr><td>${isRejected ? 'Rejected At' : 'Failed At'}</td><td>${failedAt}</td></tr>
        <tr><td>Status</td><td>${isRejected ? '✖ Rejected' : '✖ Failed'}</td></tr>
      </table>

      <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:16px 18px; font-size:13px; line-height:1.6; color:#374151;">
        💡 <strong>What to do next:</strong><br>
        ${isRejected
          ? 'If you believe this rejection was made in error or you\'d like to provide additional documentation, please contact our support team at <a href="mailto:Info@kenluk.com" style="color:#1d4ed8;">Info@kenluk.com</a> or call +234 708 832 9998.'
          : 'Your funds have <strong>not been debited</strong>. You can try submitting a new payment request. If the issue persists, please contact us at <a href="mailto:Info@kenluk.com" style="color:#1d4ed8;">Info@kenluk.com</a> or call +234 708 832 9998.'
        }
      </div>
    </div>

    <div class="footer">
      <p>We apologize for any inconvenience this may have caused.</p>
      <p style="margin-top: 8px;">© ${new Date().getFullYear()} Kenluk &nbsp;|&nbsp; <a href="mailto:Info@kenluk.com">Info@kenluk.com</a> &nbsp;|&nbsp; +234 708 832 9998</p>
      <p style="margin-top: 6px;">Powered by Reap Payments &nbsp;·&nbsp; This is an automated notification. Please do not reply.</p>
    </div>
  </div>
</div>
</body>
</html>`;
};

export {
  generatePaymentInitiatedEmail,
  generatePaymentSuccessEmail,
  generatePaymentFailedEmail
};
