import nodemailer from 'nodemailer';
import 'dotenv/config';

// Mailtrap SMTP Transporter Configuration
const transporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST || 'live.smtp.mailtrap.io',
  port: process.env.MAILTRAP_PORT || 2525,
  secure: false,
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASS,
  },
});

// Verify transporter
transporter.verify((error, success) => {
  if (error) {
    console.error('Mailtrap SMTP connection failed:', error);
  } else {
    console.log('✅ Mailtrap SMTP connected successfully!');
  }
});

// Send Email Function
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: process.env.MAIL_FROM || 'noreply@kenluk.com',
      to,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
};

export { transporter, sendEmail };
