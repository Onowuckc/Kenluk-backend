import { MailtrapClient } from 'mailtrap';

const TOKEN = process.env.MAILTRAP_TOKEN;

const client = new MailtrapClient({ token: TOKEN });

const sender = { email: process.env.MAIL_FROM || 'Info@kenluk.com', name: 'Kenluk' };

const sendEmail = async (to, subject, html) => {
  try {
    await client.send({
      from: sender,
      to: [{ email: to }],
      subject,
      html,
      category: 'Kenluk Auth',
    });
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
};

export { sendEmail };
