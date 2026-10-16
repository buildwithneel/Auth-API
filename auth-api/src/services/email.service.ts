import dotenv from "dotenv";
dotenv.config();

import nodemailer from "nodemailer";

const sendEmail = async (
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<void> => {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error("SMTP_USER and SMTP_PASS must be configured in .env");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  await transporter.sendMail({
    from: `"Auth API" <${smtpUser}>`,
    to,
    subject,
    text,
    html
  });
};

export { sendEmail };
