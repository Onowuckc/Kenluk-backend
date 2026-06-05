import { sendEmail } from '../config/mailer.js';

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const submitContactMessage = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    const supportEmail = process.env.CONTACT_TO_EMAIL || process.env.MAIL_FROM || 'Info@kenluk.com';
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br />');

    await sendEmail(
      supportEmail,
      `Kenluk Contact Form: ${subject}`,
      `
        <div style="font-family: Arial, sans-serif; color: #122034; line-height: 1.6;">
          <h2>New contact form message</h2>
          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Subject:</strong> ${safeSubject}</p>
          <hr style="border: none; border-top: 1px solid #d8e3f3;" />
          <p>${safeMessage}</p>
        </div>
      `
    );

    res.status(200).json({
      success: true,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to send message right now. Please try again later.'
    });
  }
};

export { submitContactMessage };
