import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.MY_EMAIL,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  const mailOptions = {
    from: `"LetRank Marketplace" <${process.env.MY_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    html: options.html || options.text,
    text: options.text,
  };

  await transporter.sendMail(mailOptions);
};

export default sendEmail;


// For notification emails the user doesn't need to wait for: the API replies
// straight away and the email is sent afterwards. Failures are only logged.
// (The site runs as a long-lived Node server, so the send finishes after the
// response; on a serverless host this would need a queue instead.)
export const sendEmailInBackground = (options, label = 'Email') => {
  sendEmail(options).catch((err) => console.error(`${label} failed:`, err.message));
};
