import sendEmail from '../sendEmail';
import { escapeHtml } from '../escape';
import { json, readBody, serverError } from '../http';
import { str, email as emailField } from '../validate';
import { rateLimit, clientIp, HOUR } from '../rateLimit';

export const submitContact = async (request) => {
  try {
    const body = await readBody(request);
    const name = str(body.name, 'name', 'Name', { max: 80 });
    const from = emailField(body.email);
    const message = str(body.message, 'message', 'Message', { max: 5000 });

    const limited = rateLimit('contact', clientIp(request), { limit: 5, windowMs: HOUR });
    if (limited) return limited;

    try {
      await sendEmail({
        // The email goes TO the site owner
        email: process.env.MY_EMAIL,
        subject: `Marketplace Inquiry from ${name.replace(/[\r\n]+/g, ' ')}`,
        text: `You have a new message from the contact form:\n\nName: ${name}\nEmail: ${from}\nMessage: ${message}`,
        html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
                    <h2 style="color: #1e293b;">New Contact Form Submission</h2>
                    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
                    <p><strong>Email:</strong> ${escapeHtml(from)}</p>
                    <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
                    <p><strong>Message:</strong></p>
                    <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
                </div>
            `,
      });
    } catch (error) {
      console.error('Nodemailer Error:', error.message);
      return json({ success: false, message: 'Server error: Could not send email. Please try again later.' }, 500);
    }

    return json({ success: true, message: 'Thank you! Your message has been sent successfully.' });
  } catch (error) {
    return serverError(error);
  }
};
