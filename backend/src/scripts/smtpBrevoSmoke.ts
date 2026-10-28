/**
 * One-time REAL SMTP delivery smoke test for the configured Brevo account.
 * Run explicitly: npm run test:smtp:brevo
 * Never stores passwords or recipient addresses in Git.
 *
 * Requires local backend/.env:
 *  SMTP_HOST=smtp-relay.brevo.com, SMTP_PORT=587, SMTP_REQUIRE_TLS=true,
 *  SMTP_USER, SMTP_PASS (SMTP key), MAIL_FROM (verified sender),
 *  SMTP_TEST_TO (comma-separated real inboxes, maximum two).
 *
 * This proves Brevo accepted a message, NOT that it arrived in Inbox.
 * The recipient must independently check Inbox/Spam.
 */
import 'dotenv/config';
import transport from '../config/mail.js';
import { env } from '../config/env.js';

function recipientsFromEnvironment(): string[] {
    const recipients = (process.env['SMTP_TEST_TO'] ?? '')
        .split(',').map(x => x.trim()).filter(Boolean);
    if (recipients.length < 1 || recipients.length > 2
        || new Set(recipients.map(x => x.toLowerCase())).size !== recipients.length
        || recipients.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        throw new Error('Set SMTP_TEST_TO to one or two DISTINCT valid addresses in local .env');
    }
    return recipients;
}

function verifyConfiguration(): string[] {
    if (env.SMTP_HOST !== 'smtp-relay.brevo.com' || env.SMTP_PORT !== 587 || !env.SMTP_REQUIRE_TLS)
        throw new Error('Brevo smoke test requires smtp-relay.brevo.com:587 with SMTP_REQUIRE_TLS=true');
    if (!env.SMTP_USER || !env.SMTP_PASS)
        throw new Error('Brevo SMTP Login and SMTP KEY must both be set in local .env');
    if (!env.MAIL_FROM || /@ltms\.local/i.test(env.MAIL_FROM))
        throw new Error('MAIL_FROM must be a real verified Brevo sender, not ltms.local');
    return recipientsFromEnvironment();
}

async function main(): Promise<void> {
    const recipients = verifyConfiguration();
    await transport.verify();
    console.log('Brevo SMTP connection and authentication accepted.');
    for (const recipient of recipients) {
        const stamp = new Date().toISOString();
        const result = await transport.sendMail({
            from: env.MAIL_FROM,
            to: recipient,
            subject: '[LTMS SMTP Test] ' + stamp,
            text: 'LTMS Brevo SMTP delivery test.\n\nGenerated at: ' + stamp
                + '\nNo OTP or account changes were made.\n',
            html: '<p>LTMS Brevo SMTP delivery test.</p><p>Generated at: ' + stamp
                + '</p><p>No OTP or account changes were made.</p>',
        });
        if (!result.accepted?.some(x => x.toLowerCase() === recipient.toLowerCase())
            || result.rejected?.length) {
            throw new Error('Brevo did not accept delivery to ' + recipient);
        }
        console.log('SMTP accepted message for ' + recipient
            + ' (Message-ID: ' + result.messageId + '). CHECK INBOX/SPAM to confirm delivery.');
    }
    console.log('SMTP accepted all messages; actual Inbox delivery remains to be verified.');
}

try {
    await main();
} catch (error) {
    // Some SMTP errors contain credential detail. Never print raw SMTP exception or local .env.
    const message = error instanceof Error ? error.message : String(error);
    if (/SMTP_TEST_TO|smtp-relay\.brevo|MAIL_FROM|smtp key|SMTP KEY|SMTP Login|SMTP_REQUIRE_TLS/i.test(message)) {
        console.error('SMTP smoke preflight failed: ' + message);
    } else {
        console.error('SMTP smoke test failed; inspect Brevo SMTP activation, sender verification and credentials.');
    }
    process.exitCode = 1;
} finally {
    transport.close();
}
