/** Pure transport configuration: the same options are used by OTP, reset and notification mail. */
export type SmtpSettings = {
    SMTP_HOST: string;
    SMTP_PORT: number;
    SMTP_REQUIRE_TLS: boolean;
    SMTP_USER?: string | undefined;
    SMTP_PASS?: string | undefined;
};

export function mailTransportOptions(settings: SmtpSettings) {
    return {
        host: settings.SMTP_HOST,
        port: settings.SMTP_PORT,
        secure: settings.SMTP_PORT === 465,
        requireTLS: settings.SMTP_REQUIRE_TLS,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
        ...(settings.SMTP_USER ? { auth: { user: settings.SMTP_USER, pass: settings.SMTP_PASS } } : {}),
    };
}
