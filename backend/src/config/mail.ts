import nodemailer from 'nodemailer';
import { env } from './env.js';
import { mailTransportOptions } from './mailOptions.js';

// Provider-agnostic SMTP transport: Mailpit defaults to 1025 without auth;
// Brevo on 587 uses STARTTLS with SMTP_REQUIRE_TLS=true.
const transport = nodemailer.createTransport(mailTransportOptions(env));
export default transport;
