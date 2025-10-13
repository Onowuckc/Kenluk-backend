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
