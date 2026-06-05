import nodemailer from 'nodemailer';

// Create transporter with SMTP configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true' || false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || process.env.MAIL_FROM,
    pass: process.env.SMTP_PASS,
  },
});

const sender = { 
  email: process.env.MAIL_FROM || 'payments@kenluk.com', 
  name: process.env.MAIL_FROM_NAME || 'Kenluk' 
};

/**
 * Send email using nodemailer
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML content
 */
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: `${sender.name} <${sender.email}>`,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.response);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email: ' + error.message);
  }
};

/**
 * Verify SMTP connection (call once on server startup)
 */
const verifyConnection = async () => {
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified and ready to send emails');
  } catch (error) {
    console.error('❌ SMTP connection error:', error);
    throw new Error('Failed to verify SMTP connection: ' + error.message);
  }
};

export { sendEmail, verifyConnection, transporter };
