import nodemailer from 'nodemailer';

// Create transporter with Mailtrap SMTP configuration
const transporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST || 'send.api.mailtrap.io',
  port: parseInt(process.env.MAILTRAP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.MAILTRAP_USER || 'api',
    pass: process.env.MAILTRAP_PASS,
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
